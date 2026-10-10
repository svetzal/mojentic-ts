import { z } from 'zod';
/**
 * Ollama gateway implementation
 */

import { recoverCompletion, completionRecoveryCapabilities } from '../recovery';
import { LlmGateway } from '../gateway';
import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk, ToolCall } from '../models';
import { ToolDescriptor } from '../tools';
import { Result, Ok, Err, GatewayError } from '../../error';
import { LlmStreamEvent } from '../stream-events';
import {
  OllamaCompletionStats,
  ollamaMetadata,
  ollamaUsage,
  parseOllamaStreamLine,
} from './ollama-stream-protocol';
import { streamCompletionEvents } from './stream-event-transport';

interface OllamaToolCall {
  id?: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

/** Convert provider arguments to the broker's JSON-string contract. */
function normalizeToolCall(call: OllamaToolCall): ToolCall {
  return {
    // Elixir keeps missing IDs absent. The TypeScript contract needs a string.
    id: call.id ?? '',
    type: 'function',
    function: {
      name: call.function.name,
      arguments:
        typeof call.function.arguments === 'string'
          ? call.function.arguments
          : JSON.stringify(call.function.arguments),
    },
  };
}

interface OllamaMessage {
  role: string;
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaResponse extends OllamaCompletionStats {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
    thinking?: string;
  };
  done: boolean;
}

interface OllamaStreamResponse extends OllamaCompletionStats {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
    thinking?: string;
  };
  done: boolean;
}

interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export type PullProgressCallback = (progress: OllamaPullProgress) => void;

const recoveredOllamaSchema = z.object({
  model: z.string().optional(),
  done: z.literal(true),
  done_reason: z.string().optional(),
  message: z.object({
    role: z.string(),
    content: z.string(),
    thinking: z.string().optional(),
    tool_calls: z
      .array(
        z.object({
          id: z.string().optional(),
          type: z.literal('function').optional(),
          function: z.object({
            name: z.string(),
            arguments: z.union([z.string(), z.record(z.string(), z.unknown())]),
          }),
        })
      )
      .optional(),
  }),
  eval_count: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_duration: z.number().optional(),
});
function decodeRecoveredOllama(json: unknown): GatewayResponse {
  return toGatewayResponse(recoveredOllamaSchema.parse(json));
}
function toGatewayResponse(
  data: Pick<OllamaResponse, 'message' | 'done'> & OllamaCompletionStats & { model?: string }
): GatewayResponse {
  return {
    content: data.message.content,
    toolCalls: data.message.tool_calls?.map(normalizeToolCall),
    finishReason: data.done_reason ?? (data.done ? 'stop' : undefined),
    model: data.model,
    thinking: data.message.thinking,
    usage: ollamaUsage(data),
    metadata: ollamaMetadata(data),
  };
}

/** Gateway for the Ollama local provider; recovery is opt-in through CompletionConfig. */
export class OllamaGateway implements LlmGateway {
  readonly recoveryCapabilities = completionRecoveryCapabilities;
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  /**
   * Build the `/api/chat` request body shared by every chat call, without the `stream` flag.
   */
  private buildRequestBody(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Record<string, unknown> {
    const ollamaMessages = this.adaptMessages(messages);
    const ollamaTools = tools?.map(this.adaptTool);

    const requestBody: Record<string, unknown> = {
      model,
      messages: ollamaMessages,
      options: {},
    };

    if (config?.temperature !== undefined) {
      (requestBody.options as Record<string, unknown>).temperature = config.temperature;
    }

    // numPredict takes precedence over maxTokens for Ollama-specific control
    if (config?.numPredict !== undefined) {
      (requestBody.options as Record<string, unknown>).num_predict = config.numPredict;
    } else if (config?.maxTokens !== undefined) {
      (requestBody.options as Record<string, unknown>).num_predict = config.maxTokens;
    }

    if (config?.topP !== undefined) {
      (requestBody.options as Record<string, unknown>).top_p = config.topP;
    }

    if (config?.topK !== undefined) {
      (requestBody.options as Record<string, unknown>).top_k = config.topK;
    }

    if (config?.numCtx !== undefined) {
      (requestBody.options as Record<string, unknown>).num_ctx = config.numCtx;
    }

    if (config?.stop) {
      (requestBody.options as Record<string, unknown>).stop = config.stop;
    }

    if (ollamaTools && ollamaTools.length > 0) {
      requestBody.tools = ollamaTools;
    }

    if (config?.responseFormat?.type === 'json_object') {
      // Pass the schema to Ollama's format field for structured output
      requestBody.format = config.responseFormat.schema || 'json';
    }

    if (config?.reasoningEffort) {
      requestBody.think = true;
    }

    return requestBody;
  }

  /**
   * Stream one completion as content events ending in exactly one terminal event.
   *
   * Sends one request with no tools. Success needs a final frame whose `done_reason` is `stop`.
   * Stopping iteration or aborting `signal` cancels the request.
   */
  async *generateStreamEvents(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    signal?: AbortSignal
  ): AsyncGenerator<LlmStreamEvent> {
    yield* streamCompletionEvents(
      {
        url: `${this.baseUrl}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        body: { ...this.buildRequestBody(model, messages, config), stream: true },
      },
      parseOllamaStreamLine,
      signal
    );
  }

  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    if (config?.recovery) {
      return recoverCompletion(
        'ollama',
        `${this.baseUrl}/api/chat`,
        { 'Content-Type': 'application/json' },
        { ...this.buildRequestBody(model, messages, config, tools), stream: false },
        config.recovery,
        decodeRecoveredOllama,
        config.responseFormat?.type === 'json_object'
      );
    }
    try {
      const requestBody = {
        ...this.buildRequestBody(model, messages, config, tools),
        stream: false,
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Err(
          new GatewayError(
            `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
      }

      const data = (await response.json()) as OllamaResponse;

      return Ok(toGatewayResponse(data));
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
      const requestBody = {
        ...this.buildRequestBody(model, messages, config, tools),
        stream: true,
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield Err(
          new GatewayError(
            `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
        return;
      }

      if (!response.body) {
        yield Err(new GatewayError('No response body'));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line) as OllamaStreamResponse;
              const chunk: StreamChunk = {
                content: data.message?.content,
                toolCalls: data.message?.tool_calls?.map(normalizeToolCall),
                done: data.done,
              };
              if (data.done) {
                chunk.finishReason = 'stop';
              }
              yield Ok(chunk);
            } catch (parseError) {
              yield Err(
                new GatewayError(
                  `Failed to parse stream chunk: ${parseError instanceof Error ? parseError.message : String(parseError)}`
                )
              );
            }
          }
        }
      }
    } catch (error) {
      yield Err(
        new GatewayError(
          `Failed to generate stream: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async listModels(): Promise<Result<string[], Error>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);

      if (!response.ok) {
        return Err(
          new GatewayError(
            `Ollama API error: ${response.status} ${response.statusText}`,
            response.status
          )
        );
      }

      const data = (await response.json()) as { models: Array<{ name: string }> };
      const modelNames = data.models.map((m) => m.name);

      return Ok(modelNames);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to list models: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private adaptMessages(messages: LlmMessage[]): OllamaMessage[] {
    return messages.map((msg) => {
      const ollamaMsg: OllamaMessage = {
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : '',
      };

      // Handle array content (multimodal)
      if (Array.isArray(msg.content)) {
        const textParts: string[] = [];
        const images: string[] = [];

        for (const item of msg.content) {
          if (item.type === 'text' && item.text) {
            textParts.push(item.text);
          } else if (item.type === 'image_url' && item.image_url) {
            // Ollama expects base64-encoded images
            // If the URL is a data URI (data:image/...;base64,...), extract the base64 part
            // If it's a file path, we need to read and encode it (handled in example)
            const url = item.image_url.url;
            if (url.startsWith('data:image')) {
              // Extract base64 from data URI: data:image/jpeg;base64,<base64data>
              const base64Part = url.split(',')[1];
              if (base64Part) {
                images.push(base64Part);
              }
            } else {
              // Assume it's already base64-encoded or will be handled by caller
              images.push(url);
            }
          }
        }

        ollamaMsg.content = textParts.join('\n');
        if (images.length > 0) {
          ollamaMsg.images = images;
        }
      }

      // Handle tool calls
      if (msg.tool_calls) {
        ollamaMsg.tool_calls = msg.tool_calls.map((call) => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
          },
        }));
      }

      return ollamaMsg;
    });
  }

  private adaptTool(tool: ToolDescriptor): OllamaTool {
    return {
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    };
  }

  async calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>> {
    try {
      const embeddingModel = model || 'nomic-embed-text';

      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Err(
          new GatewayError(
            `Ollama embeddings API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
      }

      const data = (await response.json()) as { embedding: number[] };

      return Ok(data.embedding);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to calculate embeddings: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  async pullModel(
    modelName: string,
    onProgress?: PullProgressCallback
  ): Promise<Result<void, Error>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return Err(
          new GatewayError(
            `Ollama pull API error: ${response.status} ${response.statusText} - ${errorText}`,
            response.status
          )
        );
      }

      if (!response.body) {
        return Err(new GatewayError('No response body from pull endpoint'));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();

        if (done) {
          streamDone = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const progress = JSON.parse(line) as OllamaPullProgress;
              if (onProgress) {
                onProgress(progress);
              }
            } catch (parseError) {
              return Err(
                new GatewayError(
                  `Failed to parse pull progress: ${parseError instanceof Error ? parseError.message : String(parseError)}`
                )
              );
            }
          }
        }
      }

      return Ok(undefined);
    } catch (error) {
      return Err(
        new GatewayError(
          `Failed to pull model: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }
}
