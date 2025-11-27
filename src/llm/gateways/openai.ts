/**
 * OpenAI gateway implementation for chat completions, embeddings, and streaming.
 */

import { LlmGateway } from '../gateway';
import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk, ToolCall } from '../models';
import { ToolDescriptor } from '../tools';
import { Result, Ok, Err, GatewayError } from '../../error';
import { adaptMessagesToOpenAI } from './openai-messages-adapter';
import {
  getModelRegistry,
  getTokenLimitParam,
  supportsTemperature,
  ModelType,
} from './openai-model-registry';
import { TokenizerGateway } from './tokenizerGateway';

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: OpenAIStreamDelta;
    finish_reason: string | null;
  }>;
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

  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    try {
      // Build args object for adaptation
      const args: Record<string, unknown> = {
        model,
        messages,
        objectModel: config?.responseFormat?.schema,
        tools,
        temperature: config?.temperature ?? 1.0,
        numCtx: config?.numCtx ?? 32768,
        maxTokens: config?.maxTokens ?? 16384,
        numPredict: config?.numPredict,
      };

      // Adapt parameters based on model type
      const adaptedArgs = this.adaptParametersForModel(model, args);

      // Validate parameters after adaptation
      this.validateModelParameters(model, adaptedArgs);

      // Build OpenAI request
      const openaiMessages = adaptMessagesToOpenAI(messages);

      const requestBody: Record<string, unknown> = {
        model: adaptedArgs.model,
        messages: openaiMessages,
      };

      // Add temperature if specified
      if ('temperature' in adaptedArgs) {
        requestBody.temperature = adaptedArgs.temperature;
      }

      // Handle response format for structured output
      if (config?.responseFormat?.type === 'json_object' && config?.responseFormat?.schema) {
        requestBody.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            schema: config.responseFormat.schema,
          },
        };
      }

      // Add tools if provided
      if (adaptedArgs.tools && Array.isArray(adaptedArgs.tools) && adaptedArgs.tools.length > 0) {
        requestBody.tools = (adaptedArgs.tools as ToolDescriptor[]).map((t) => ({
          type: 'function',
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }));
      }

      // Handle token limit parameters
      if ('maxTokens' in adaptedArgs && adaptedArgs.maxTokens !== undefined) {
        requestBody.max_tokens = adaptedArgs.maxTokens;
      } else if (
        'maxCompletionTokens' in adaptedArgs &&
        adaptedArgs.maxCompletionTokens !== undefined
      ) {
        requestBody.max_completion_tokens = adaptedArgs.maxCompletionTokens;
      }

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

      // Parse tool calls if present
      let toolCalls: ToolCall[] | undefined;
      if (message.tool_calls && message.tool_calls.length > 0) {
        toolCalls = message.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      const gatewayResponse: GatewayResponse = {
        content: message.content || '',
        toolCalls,
        finishReason: data.choices[0]?.finish_reason as GatewayResponse['finishReason'],
        model: data.model,
      };

      if (data.usage) {
        gatewayResponse.usage = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
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
      // Build args object for adaptation
      const args: Record<string, unknown> = {
        model,
        messages,
        objectModel: config?.responseFormat?.schema,
        tools,
        temperature: config?.temperature ?? 1.0,
        numCtx: config?.numCtx ?? 32768,
        maxTokens: config?.maxTokens ?? 16384,
        numPredict: config?.numPredict,
      };

      // Adapt parameters based on model type
      const adaptedArgs = this.adaptParametersForModel(model, args);

      // Validate parameters after adaptation
      this.validateModelParameters(model, adaptedArgs);

      // Check if model supports streaming
      const capabilities = this.modelRegistry.getModelCapabilities(model);
      if (!capabilities.supportsStreaming) {
        yield Err(new GatewayError(`Model ${model} does not support streaming`));
        return;
      }

      // Structured output doesn't work with streaming
      if (config?.responseFormat?.type === 'json_object' && config?.responseFormat?.schema) {
        yield Err(
          new GatewayError('Streaming with structured output (responseFormat) is not supported')
        );
        return;
      }

      // Build OpenAI request
      const openaiMessages = adaptMessagesToOpenAI(messages);

      const requestBody: Record<string, unknown> = {
        model: adaptedArgs.model,
        messages: openaiMessages,
        stream: true,
      };

      // Add temperature if specified
      if ('temperature' in adaptedArgs) {
        requestBody.temperature = adaptedArgs.temperature;
      }

      // Add tools if provided
      if (adaptedArgs.tools && Array.isArray(adaptedArgs.tools) && adaptedArgs.tools.length > 0) {
        requestBody.tools = (adaptedArgs.tools as ToolDescriptor[]).map((t) => ({
          type: 'function',
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        }));
      }

      // Handle token limit parameters
      if ('maxTokens' in adaptedArgs && adaptedArgs.maxTokens !== undefined) {
        requestBody.max_tokens = adaptedArgs.maxTokens;
      } else if (
        'maxCompletionTokens' in adaptedArgs &&
        adaptedArgs.maxCompletionTokens !== undefined
      ) {
        requestBody.max_completion_tokens = adaptedArgs.maxCompletionTokens;
      }

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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Accumulate tool calls as they stream in
      // OpenAI streams tool arguments incrementally, indexed by tool call index
      const toolCallsAccumulator: Map<
        number,
        { id: string | null; name: string | null; arguments: string }
      > = new Map();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6)) as OpenAIStreamChunk;
              const choice = data.choices[0];
              if (!choice) continue;

              const delta = choice.delta;
              const finishReason = choice.finish_reason;

              // Yield content chunks as they arrive
              if (delta.content) {
                yield Ok({ content: delta.content, done: false });
              }

              // Accumulate tool call chunks
              if (delta.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;

                  // Initialize accumulator for this tool call if needed
                  if (!toolCallsAccumulator.has(index)) {
                    toolCallsAccumulator.set(index, { id: null, name: null, arguments: '' });
                  }

                  // We just ensured the key exists above, so this is guaranteed to be defined
                  const acc = toolCallsAccumulator.get(index);
                  if (!acc) continue;

                  // First chunk has id and name
                  if (toolCallDelta.id) {
                    acc.id = toolCallDelta.id;
                  }

                  if (toolCallDelta.function?.name) {
                    acc.name = toolCallDelta.function.name;
                  }

                  // All chunks may have argument fragments
                  if (toolCallDelta.function?.arguments) {
                    acc.arguments += toolCallDelta.function.arguments;
                  }
                }
              }

              // When stream is complete with tool_calls, yield accumulated tool calls
              if (finishReason === 'tool_calls' && toolCallsAccumulator.size > 0) {
                const completeToolCalls: ToolCall[] = [];

                // Sort by index to maintain order
                const sortedIndices = Array.from(toolCallsAccumulator.keys()).sort((a, b) => a - b);

                for (const index of sortedIndices) {
                  const tc = toolCallsAccumulator.get(index);
                  if (!tc) continue;
                  // Keep arguments as string for ToolCall interface
                  completeToolCalls.push({
                    id: tc.id || '',
                    type: 'function' as const,
                    function: {
                      name: tc.name || '',
                      arguments: tc.arguments,
                    },
                  });
                }

                if (completeToolCalls.length > 0) {
                  yield Ok({
                    toolCalls: completeToolCalls,
                    done: true,
                    finishReason: 'tool_calls',
                  });
                }
              }

              if (finishReason && finishReason !== 'tool_calls') {
                yield Ok({ done: true, finishReason: finishReason as StreamChunk['finishReason'] });
              }
            } catch (parseError) {
              console.error(`Failed to parse stream chunk: ${trimmedLine}`, parseError);
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
      const lengths: number[] = [];

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
          lengths.push(embedding.length);
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

      // Average the embeddings weighted by length
      const average = this.weightedAverageEmbeddings(allEmbeddings, lengths);
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
