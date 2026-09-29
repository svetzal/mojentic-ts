/**
 * oMLX gateway: chat completions, streaming, model loading and embeddings against an oMLX server.
 *
 * oMLX (https://github.com/jundot/omlx) is an LLM server for Apple Silicon that speaks the
 * OpenAI chat completions protocol. This gateway composes the OpenAI message adapter and the
 * OpenAI-compatible stream parsers. It does not use the OpenAI model registry and never adapts
 * parameters per model.
 */

import { z } from 'zod';
import { LlmGateway } from '../gateway';
import { CompletionConfig, GatewayResponse, LlmMessage, StreamChunk } from '../models';
import { ToolDescriptor } from '../tools';
import { LlmStreamEvent } from '../stream-events';
import { Err, GatewayError, Ok, Result, TimeoutError, ValidationError } from '../../error';
import { adaptMessagesToOpenAI } from './openai-messages-adapter';
import {
  parseOpenAILegacyStream,
  parseOpenAIToolCalls,
  readLines,
  toOpenAIResponseFormat,
  toOpenAITools,
} from './openai-chat-protocol';
import { toCompletionUsage } from './openai-stream-protocol';
import { parseOMLXStreamLine, reportedUsage, withoutKeepAlives } from './omlx-stream-protocol';
import { streamCompletionEvents } from './stream-event-transport';

/** Host used when neither the constructor nor `OMLX_HOST` names one. */
export const OMLX_DEFAULT_HOST = 'http://localhost:8000';

/**
 * Timeout, in milliseconds, used when neither the constructor nor `OMLX_TIMEOUT` sets one.
 *
 * Local models are slow: a 16384-token reply at 16 tokens a second takes 17 minutes.
 */
export const OMLX_DEFAULT_TIMEOUT_MS = 600_000;

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_TOKENS = 16384;

const usageCountsSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

const chatResponseSchema = z.object({
  id: z.string().optional(),
  created: z.number().optional(),
  model: z.string().optional(),
  system_fingerprint: z.string().nullish(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal('function'),
                function: z.object({ name: z.string(), arguments: z.string() }),
              })
            )
            .nullish(),
        }),
        finish_reason: z.string().nullish(),
      })
    )
    .min(1),
  usage: usageCountsSchema.nullish(),
});

const modelsResponseSchema = z.object({ data: z.array(z.object({ id: z.string() })) });

const embeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
});

type ChatResponse = z.infer<typeof chatResponseSchema>;

function timeoutFromEnvironment(): number | undefined {
  const milliseconds = Number(process.env.OMLX_TIMEOUT);
  return Number.isInteger(milliseconds) && milliseconds > 0 ? milliseconds : undefined;
}

function withoutEmptyValues(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== null)
  );
}

function isTimeout(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError'
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A request that never produced a provider response: a timeout or a connection failure. */
function requestFailure(action: string, error: unknown): Error {
  if (isTimeout(error)) return new TimeoutError(`oMLX timed out while trying to ${action}`);
  return new GatewayError(`Failed to ${action}: ${describe(error)}`);
}

/** A non-success HTTP response, carrying its status and body unchanged. */
async function providerError(response: Response): Promise<GatewayError> {
  const body = await response.text();
  return new GatewayError(
    `oMLX API error: ${response.status} ${response.statusText} - ${body}`,
    response.status,
    body
  );
}

function invalidResponse(what: string): GatewayError {
  return new GatewayError(`Invalid oMLX ${what} response`);
}

/**
 * The response format warning, when a structured request came back with a `Warning` header.
 *
 * oMLX sends the header when it could not compile a grammar and fell back to prompt instructions.
 * Several `Warning` headers arrive joined with `, `. The response is still returned; the header is
 * evidence for the caller.
 */
function responseFormatWarning(
  headers: Headers,
  config: CompletionConfig | undefined
): string | undefined {
  if (config?.responseFormat?.type !== 'json_object') return undefined;
  const warning = headers.get('warning') ?? undefined;
  if (warning !== undefined) {
    console.warn(`oMLX did not enforce the requested response format: ${warning}`);
  }
  return warning;
}

function toGatewayResponse(
  data: ChatResponse,
  rawUsage: Record<string, unknown> | undefined,
  warning: string | undefined
): GatewayResponse {
  const [{ message, finish_reason }] = data.choices;
  return {
    content: message.content ?? '',
    toolCalls: parseOpenAIToolCalls(message.tool_calls ?? undefined),
    finishReason: finish_reason ?? undefined,
    usage: data.usage ? toCompletionUsage(data.usage) : undefined,
    model: data.model,
    thinking: message.reasoning_content ?? undefined,
    metadata: withoutEmptyValues({
      id: data.id,
      created: data.created,
      system_fingerprint: data.system_fingerprint,
      usage: rawUsage,
      response_format_warning: warning,
    }),
  };
}

/**
 * Gateway for an oMLX server.
 *
 * Configuration comes from the constructor, then the environment, then the defaults:
 *
 * | Setting | Environment | Default |
 * | ------- | ----------- | ------- |
 * | `host` | `OMLX_HOST` | `http://localhost:8000` |
 * | `apiKey` | `OMLX_API_KEY` | none: no `Authorization` header |
 * | `timeout` (milliseconds) | `OMLX_TIMEOUT` | 600000 (10 minutes) |
 *
 * The host has no `/v1` suffix; the gateway adds it. The timeout bounds each non-streaming
 * request, model load included. Streams are not bounded by it, because a fetch timeout covers
 * the whole body and would cut off a long reply; stop iterating, or abort the signal passed to
 * `generateStreamEvents`, to end one.
 *
 * `reasoningEffort` goes unchanged to the model's chat template, so its effect depends on the
 * model. Leaving it unset keeps the model's default; Qwen 3 models think by default.
 *
 * Responses map `reasoning_content` to `thinking`. When generation stops for any reason other
 * than `stop`, `content` is not an answer: a response truncated during thinking holds the partial
 * reasoning in `content`. Response metadata keeps the `usage` object oMLX reported, unchanged,
 * and `response_format_warning` when oMLX did not enforce a requested JSON format.
 */
export class OMLXGateway implements LlmGateway {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;

  /**
   * @param host - Server address without `/v1`. Falls back to `OMLX_HOST`, then localhost:8000.
   * @param apiKey - Sent as a bearer token when set. Falls back to `OMLX_API_KEY`.
   * @param timeout - Milliseconds allowed for each non-streaming request. Falls back to
   *   `OMLX_TIMEOUT`, then 600000.
   */
  constructor(host?: string, apiKey?: string, timeout?: number) {
    const resolvedHost = host || process.env.OMLX_HOST || OMLX_DEFAULT_HOST;
    this.baseUrl = `${resolvedHost.replace(/\/+$/, '')}/v1`;
    this.apiKey = apiKey || process.env.OMLX_API_KEY || undefined;
    this.timeout = timeout ?? timeoutFromEnvironment() ?? OMLX_DEFAULT_TIMEOUT_MS;
  }

  private headers(hasBody: boolean): Record<string, string> {
    return {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private send(
    method: 'GET' | 'POST',
    path: string,
    timeoutMs: number | undefined,
    body?: unknown
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs),
    });
  }

  /**
   * Build the chat completions body from the configuration, with no per-model adaptation.
   *
   * `num_ctx` and `num_predict` are never sent: oMLX sets context length per model.
   */
  private buildRequestBody(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Record<string, unknown> {
    return {
      model,
      messages: adaptMessagesToOpenAI(messages),
      temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: config?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...withoutEmptyValues({
        top_p: config?.topP,
        top_k: config?.topK,
        reasoning_effort: config?.reasoningEffort,
        response_format: toOpenAIResponseFormat(config?.responseFormat),
        tools: tools && tools.length > 0 ? toOpenAITools(tools) : undefined,
      }),
    };
  }

  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    try {
      const body = this.buildRequestBody(model, messages, config, tools);
      const response = await this.send('POST', '/chat/completions', this.timeout, body);
      if (!response.ok) return Err(await providerError(response));

      const json: unknown = await response.json();
      const data = chatResponseSchema.safeParse(json);
      if (!data.success) return Err(invalidResponse('chat completion'));

      const warning = responseFormatWarning(response.headers, config);
      return Ok(toGatewayResponse(data.data, reportedUsage(json), warning));
    } catch (error) {
      return Err(requestFailure('generate completion', error));
    }
  }

  /**
   * Stream a completion as chunks, as the OpenAI gateway does.
   *
   * Keep-alive frames and `reasoning_content` deltas are dropped. Tool calls arrive as one chunk,
   * complete, when the finish reason is `tool_calls`.
   */
  async *generateStream(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): AsyncGenerator<Result<StreamChunk, Error>> {
    try {
      const body = { ...this.buildRequestBody(model, messages, config, tools), stream: true };
      const response = await this.send('POST', '/chat/completions', undefined, body);
      if (!response.ok) {
        yield Err(await providerError(response));
        return;
      }
      if (!response.body) {
        yield Err(new GatewayError('No response body'));
        return;
      }

      const lines = withoutKeepAlives(readLines(response.body));
      for await (const chunk of parseOpenAILegacyStream(lines)) {
        yield Ok(chunk);
      }
    } catch (error) {
      yield Err(requestFailure('generate stream', error));
    }
  }

  /**
   * Stream one completion as content events ending in exactly one terminal event.
   *
   * Sends one request with no tools and asks oMLX to report usage. Success needs a `stop` finish
   * reason followed by `data: [DONE]`. Keep-alive frames are dropped, and `reasoning_content`
   * produces no events. Stopping iteration or aborting `signal` cancels the request.
   */
  async *generateStreamEvents(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    signal?: AbortSignal
  ): AsyncGenerator<LlmStreamEvent> {
    yield* streamCompletionEvents(
      {
        url: `${this.baseUrl}/chat/completions`,
        headers: this.headers(true),
        body: {
          ...this.buildRequestBody(model, messages, config),
          stream: true,
          stream_options: { include_usage: true },
        },
      },
      parseOMLXStreamLine,
      signal
    );
  }

  /** List the ids of the models the server offers, sorted. */
  async listModels(): Promise<Result<string[], Error>> {
    try {
      const response = await this.send('GET', '/models', this.timeout);
      if (!response.ok) return Err(await providerError(response));

      const data = modelsResponseSchema.safeParse(await response.json());
      if (!data.success) return Err(invalidResponse('models'));
      return Ok(data.data.data.map((m) => m.id).sort());
    } catch (error) {
      return Err(requestFailure('list models', error));
    }
  }

  /**
   * Load a model into memory ahead of use. Resolves once the model is in memory.
   *
   * A chat request loads its model automatically; this only warms it up. Loading from cold can
   * take minutes; the gateway timeout covers it.
   */
  async loadModel(model: string): Promise<Result<void, Error>> {
    return this.changeModelResidency(model, 'load');
  }

  /**
   * Unload a model from memory. Unloading a model that is not loaded is a provider error (400).
   */
  async unloadModel(model: string): Promise<Result<void, Error>> {
    return this.changeModelResidency(model, 'unload');
  }

  private async changeModelResidency(
    model: string,
    action: 'load' | 'unload'
  ): Promise<Result<void, Error>> {
    try {
      const path = `/models/${encodeURIComponent(model)}/${action}`;
      const response = await this.send('POST', path, this.timeout);
      if (!response.ok) return Err(await providerError(response));
      return Ok(undefined);
    } catch (error) {
      return Err(requestFailure(`${action} model ${model}`, error));
    }
  }

  /**
   * Calculate an embedding with one request and no client-side chunking.
   *
   * @throws ValidationError when `model` is missing: oMLX has no default embedding model.
   */
  async calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>> {
    if (model === undefined || model === '') {
      throw new ValidationError('oMLX embeddings need a model; oMLX has no default', 'model');
    }

    try {
      const response = await this.send('POST', '/embeddings', this.timeout, {
        model,
        input: text,
      });
      if (!response.ok) return Err(await providerError(response));

      const data = embeddingResponseSchema.safeParse(await response.json());
      if (!data.success) return Err(invalidResponse('embeddings'));
      return Ok(data.data.data[0].embedding);
    } catch (error) {
      return Err(requestFailure('calculate embeddings', error));
    }
  }
}
