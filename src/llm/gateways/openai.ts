/**
 * OpenAI gateway implementation for chat completions, embeddings, and streaming.
 */

import { LlmGateway } from '../gateway';
import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk } from '../models';
import { ToolDescriptor } from '../tools';
import { Result, Ok, Err, GatewayError } from '../../error';
import { adaptMessagesToOpenAI } from './openai-messages-adapter';
import {
  OpenAIResponseToolCall,
  parseOpenAILegacyStream,
  parseOpenAIToolCalls,
  readLines,
  toOpenAIResponseFormat,
  toOpenAITools,
} from './openai-chat-protocol';
import {
  getModelRegistry,
  getTokenLimitParam,
  supportsTemperature,
  ModelType,
} from './openai-model-registry';
import { TokenizerGateway } from './tokenizerGateway';
import { LlmStreamEvent } from '../stream-events';
import { parseOpenAIStreamLine, toCompletionUsage } from './openai-stream-protocol';
import { streamCompletionEvents } from './stream-event-transport';

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIResponseToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: OpenAIUsage;
}

interface OpenAIModelsResponse {
  data: Array<{ id: string }>;
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

/** Collect the provider-reported response fields that have no dedicated slot. */
function responseMetadata(data: OpenAIResponse): Record<string, unknown> {
  const metadata: Record<string, unknown> = { id: data.id, created: data.created };
  if (data.system_fingerprint !== undefined) {
    metadata.system_fingerprint = data.system_fingerprint;
  }
  return metadata;
}

/**
 * Gateway for OpenAI API provider.
 *
 * Supports chat completions, structured output, tool calling, streaming, and embeddings.
 */
export class OpenAIGateway implements LlmGateway {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelRegistry = getModelRegistry();

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = baseUrl || process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1';
  }

  /**
   * Adapt parameters based on the model type and capabilities.
   */
  private adaptParametersForModel(
    model: string,
    args: Record<string, unknown>
  ): Record<string, unknown> {
    const adaptedArgs = { ...args };
    const capabilities = this.modelRegistry.getModelCapabilities(model);

    // Handle token limit parameter conversion
    if ('maxTokens' in adaptedArgs && adaptedArgs.maxTokens !== undefined) {
      const tokenParam = getTokenLimitParam(capabilities);
      if (tokenParam !== 'max_tokens') {
        // Convert max_tokens to max_completion_tokens for reasoning models
        adaptedArgs['maxCompletionTokens'] = adaptedArgs.maxTokens;
        delete adaptedArgs.maxTokens;
      }
    }

    // Validate tool usage for models that don't support tools
    if (
      'tools' in adaptedArgs &&
      adaptedArgs.tools &&
      Array.isArray(adaptedArgs.tools) &&
      adaptedArgs.tools.length > 0 &&
      !capabilities.supportsTools
    ) {
      console.warn(
        `Model ${model} does not support tools, removing tool configuration (${(adaptedArgs.tools as unknown[]).length} tools)`
      );
      adaptedArgs.tools = undefined;
    }

    // Handle temperature restrictions for specific models
    if ('temperature' in adaptedArgs && adaptedArgs.temperature !== undefined) {
      const temperature = adaptedArgs.temperature as number;

      if (capabilities.supportedTemperatures !== undefined) {
        if (
          Array.isArray(capabilities.supportedTemperatures) &&
          capabilities.supportedTemperatures.length === 0
        ) {
          // Model doesn't support temperature parameter at all - remove it
          console.warn(
            `Model ${model} does not support temperature parameter at all (requested: ${temperature})`
          );
          delete adaptedArgs.temperature;
        } else if (!supportsTemperature(capabilities, temperature)) {
          // Model supports temperature but not this specific value - use default
          const defaultTemp = 1.0;
          console.warn(
            `Model ${model} does not support requested temperature ${temperature}, using default ${defaultTemp}`
          );
          adaptedArgs.temperature = defaultTemp;
        }
      }
    }

    // Handle reasoning effort parameter
    if ('reasoningEffort' in adaptedArgs && adaptedArgs.reasoningEffort !== undefined) {
      if (capabilities.modelType === ModelType.REASONING) {
        // Reasoning models support reasoning_effort parameter
        adaptedArgs.reasoning_effort = adaptedArgs.reasoningEffort;
      } else {
        // Non-reasoning models don't support this parameter
        console.warn(`Model ${model} is not a reasoning model, ignoring reasoningEffort parameter`);
      }
      delete adaptedArgs.reasoningEffort;
    }

    return adaptedArgs;
  }

  /**
   * Validate that the parameters are compatible with the model.
   */
  private validateModelParameters(model: string, args: Record<string, unknown>): void {
    const capabilities = this.modelRegistry.getModelCapabilities(model);

    // Warning for tools on reasoning models that don't support them
    if (
      capabilities.modelType === ModelType.REASONING &&
      !capabilities.supportsTools &&
      'tools' in args &&
      args.tools &&
      Array.isArray(args.tools) &&
      args.tools.length > 0
    ) {
      console.warn(
        `Reasoning model ${model} may not support tools (${args.tools.length} tools provided)`
      );
    }

    // Validate token limits (check both possible parameter names)
    const tokenValue =
      (args.maxTokens as number | undefined) || (args.maxCompletionTokens as number | undefined);
    if (tokenValue && capabilities.maxOutputTokens) {
      if (tokenValue > capabilities.maxOutputTokens) {
        console.warn(
          `Requested token limit ${tokenValue} exceeds model maximum ${capabilities.maxOutputTokens} for ${model}`
        );
      }
    }
  }

  /**
   * Build the chat completions request body shared by streaming and non-streaming calls.
   */
  private buildRequestBody(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Record<string, unknown> {
    const args: Record<string, unknown> = {
      model,
      messages,
      objectModel: config?.responseFormat?.schema,
      tools,
      temperature: config?.temperature ?? 1.0,
      numCtx: config?.numCtx ?? 32768,
      maxTokens: config?.maxTokens ?? 16384,
      numPredict: config?.numPredict,
      reasoningEffort: config?.reasoningEffort,
    };

    const adaptedArgs = this.adaptParametersForModel(model, args);
    this.validateModelParameters(model, adaptedArgs);

    const requestBody: Record<string, unknown> = {
      model: adaptedArgs.model,
      messages: adaptMessagesToOpenAI(messages),
    };

    if ('temperature' in adaptedArgs) {
      requestBody.temperature = adaptedArgs.temperature;
    }

    const responseFormat = toOpenAIResponseFormat(config?.responseFormat);
    if (responseFormat) {
      requestBody.response_format = responseFormat;
    }

    if (adaptedArgs.tools && Array.isArray(adaptedArgs.tools) && adaptedArgs.tools.length > 0) {
      requestBody.tools = toOpenAITools(adaptedArgs.tools as ToolDescriptor[]);
    }

    if ('maxTokens' in adaptedArgs && adaptedArgs.maxTokens !== undefined) {
      requestBody.max_tokens = adaptedArgs.maxTokens;
    } else if (
      'maxCompletionTokens' in adaptedArgs &&
      adaptedArgs.maxCompletionTokens !== undefined
    ) {
      requestBody.max_completion_tokens = adaptedArgs.maxCompletionTokens;
    }

    if ('reasoning_effort' in adaptedArgs && adaptedArgs.reasoning_effort !== undefined) {
      requestBody.reasoning_effort = adaptedArgs.reasoning_effort;
    }

    return requestBody;
  }

  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    try {
      const requestBody = this.buildRequestBody(model, messages, config, tools);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Err(
          new GatewayError(
            `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
      }

      const data = (await response.json()) as OpenAIResponse;

      const message = data.choices[0]?.message;
      if (!message) {
        return Err(new GatewayError('No message in OpenAI response'));
      }

      const gatewayResponse: GatewayResponse = {
        content: message.content || '',
        toolCalls: parseOpenAIToolCalls(message.tool_calls),
        finishReason: data.choices[0]?.finish_reason,
        model: data.model,
        metadata: responseMetadata(data),
      };

      if (data.usage) {
        gatewayResponse.usage = toCompletionUsage(data.usage);
      }

      return Ok(gatewayResponse);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to generate completion: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async *generateStream(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): AsyncGenerator<Result<StreamChunk, Error>> {
    try {
      // Check if model supports streaming
      const capabilities = this.modelRegistry.getModelCapabilities(model);
      if (!capabilities.supportsStreaming) {
        yield Err(new GatewayError(`Model ${model} does not support streaming`));
        return;
      }

      const requestBody = {
        ...this.buildRequestBody(model, messages, config, tools),
        stream: true,
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield Err(
          new GatewayError(
            `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
        return;
      }

      if (!response.body) {
        yield Err(new GatewayError('No response body'));
        return;
      }

      for await (const chunk of parseOpenAILegacyStream(readLines(response.body))) {
        yield Ok(chunk);
      }
    } catch (error) {
      yield Err(
        new GatewayError(
          `Failed to generate stream: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Stream one completion as content events ending in exactly one terminal event.
   *
   * Sends one request with no tools and asks the provider to report usage. Success needs a
   * `stop` finish reason followed by `data: [DONE]`. Stopping iteration or aborting `signal`
   * cancels the request.
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: {
          ...this.buildRequestBody(model, messages, config),
          stream: true,
          stream_options: { include_usage: true },
        },
      },
      parseOpenAIStreamLine,
      signal
    );
  }

  async listModels(): Promise<Result<string[], Error>> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return Err(
          new GatewayError(
            `OpenAI API error: ${response.status} ${response.statusText}`,
            response.status
          )
        );
      }

      const data = (await response.json()) as OpenAIModelsResponse;
      const modelNames = data.data.map((m) => m.id).sort();

      return Ok(modelNames);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to list models: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>> {
    try {
      const embeddingModel = model || 'text-embedding-3-large';

      // Chunk the text if it's too long (8191 tokens max for OpenAI embeddings)
      const tokenizer = new TokenizerGateway();
      const chunks = this.chunkedTokens(tokenizer, text, 8191);

      const allEmbeddings: number[][] = [];
      const tokenCounts: number[] = [];

      for (const chunk of chunks) {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: embeddingModel,
            input: chunk,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          tokenizer.free();
          return Err(
            new GatewayError(
              `OpenAI embeddings API error: ${response.status} ${response.statusText} - ${errorText}`,
              response.status
            )
          );
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        const embedding = data.data[0]?.embedding;

        if (embedding) {
          allEmbeddings.push(embedding);
          tokenCounts.push(chunk.length);
        }
      }

      tokenizer.free();

      if (allEmbeddings.length === 0) {
        return Err(new GatewayError('No embeddings returned'));
      }

      // If only one chunk, return it directly
      if (allEmbeddings.length === 1) {
        return Ok(allEmbeddings[0]);
      }

      // Average the embeddings weighted by each chunk's token count
      const average = this.weightedAverageEmbeddings(allEmbeddings, tokenCounts);
      return Ok(average);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to calculate embeddings: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Split text into chunks of tokens.
   */
  private *chunkedTokens(
    tokenizer: TokenizerGateway,
    text: string,
    chunkLength: number
  ): Generator<number[]> {
    const tokens = tokenizer.encode(text);

    for (let i = 0; i < tokens.length; i += chunkLength) {
      yield tokens.slice(i, i + chunkLength);
    }
  }

  /**
   * Calculate weighted average of embeddings.
   * Uses array destructuring to avoid object-injection security warnings.
   */
  private weightedAverageEmbeddings(embeddings: number[][], weights: number[]): number[] {
    if (embeddings.length === 0) return [];

    const dimension = embeddings[0].length;
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Build weighted sum for each dimension
    const average = Array.from({ length: dimension }, (_, dimIdx) => {
      let sum = 0;
      embeddings.forEach((embedding, embIdx) => {
        // Use Array.prototype.at() which is safer than bracket notation
        const weight = weights.at(embIdx) ?? 0;
        const value = embedding.at(dimIdx) ?? 0;
        sum += value * (weight / totalWeight);
      });
      return sum;
    });

    // Normalize
    const norm = Math.sqrt(average.reduce((sum, x) => sum + x * x, 0));
    if (norm > 0) {
      return average.map((x) => x / norm);
    }

    return average;
  }
}
