/**
 * Ollama gateway implementation
 */

import { LlmGateway } from '../gateway';
import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk, ToolCall } from '../models';
import { ToolDescriptor } from '../tools';
import { Result, Ok, Err, GatewayError } from '../../error';

interface OllamaMessage {
  role: string;
  content: string;
  images?: string[];
  tool_calls?: ToolCall[];
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
    thinking?: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
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

/**
 * Gateway for Ollama local LLM provider
 */
export class OllamaGateway implements LlmGateway {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
  }

  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    try {
      const ollamaMessages = this.adaptMessages(messages);
      const ollamaTools = tools?.map(this.adaptTool);

      const requestBody: Record<string, unknown> = {
        model,
        messages: ollamaMessages,
        stream: false,
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

      const gatewayResponse: GatewayResponse = {
        content: data.message.content,
        toolCalls: data.message.tool_calls,
        finishReason: data.done ? 'stop' : undefined,
        model: data.model,
        thinking: data.message.thinking,
      };

      if (data.prompt_eval_count !== undefined && data.eval_count !== undefined) {
        gatewayResponse.usage = {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: data.prompt_eval_count + data.eval_count,
        };
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
      const ollamaMessages = this.adaptMessages(messages);
      const ollamaTools = tools?.map(this.adaptTool);

      const requestBody: Record<string, unknown> = {
        model,
        messages: ollamaMessages,
        stream: true,
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
                toolCalls: data.message?.tool_calls,
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
        ollamaMsg.tool_calls = msg.tool_calls;
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
