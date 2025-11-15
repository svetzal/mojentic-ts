/**
 * LLM Broker - Main interface for LLM interactions with tool support
 */

import { LlmGateway } from './gateway';
import { LlmMessage, CompletionConfig, Message, ToolCall } from './models';
import { LlmTool } from './tools';
import { Result, Ok, Err, isOk, ParseError, ToolError } from '../error';

/**
 * Main broker for LLM interactions with automatic tool execution and streaming support.
 *
 * @example
 * ```typescript
 * const gateway = new OllamaGateway();
 * const broker = new LlmBroker('qwen3:32b', gateway);
 *
 * const result = await broker.generate(
 *   [Message.user('What is TypeScript?')],
 *   [new DateResolverTool()]
 * );
 * ```
 */
export class LlmBroker {
  /**
   * Creates a new LLM broker instance.
   *
   * @param model - The model name to use (e.g., 'qwen3:32b', 'gpt-4')
   * @param gateway - The gateway implementation for the LLM provider
   */
  constructor(
    private readonly model: string,
    private readonly gateway: LlmGateway
  ) {}

  /**
   * Generate a text completion from the LLM with automatic recursive tool execution.
   *
   * When the LLM requests tool calls, this method automatically executes them and
   * recursively calls the LLM with the results until a final text response is obtained.
   *
   * @param messages - Conversation history as an array of messages
   * @param tools - Optional array of tools the LLM can call
   * @param config - Optional completion configuration (temperature, tokens, etc.)
   * @param maxToolIterations - Maximum number of recursive tool call iterations (default: 10)
   * @returns Result containing the final text response or an error
   *
   * @example
   * ```typescript
   * const result = await broker.generate(
   *   [Message.user('What day is next Friday?')],
   *   [new DateResolverTool()],
   *   { temperature: 0.7 }
   * );
   *
   * if (isOk(result)) {
   *   console.log(result.value);
   * }
   * ```
   */
  async generate(
    messages: LlmMessage[],
    tools?: LlmTool[],
    config?: CompletionConfig,
    maxToolIterations: number = 10
  ): Promise<Result<string, Error>> {
    try {
      const toolDescriptors = tools?.map((t) => t.descriptor());
      const currentMessages = [...messages];
      let iterations = 0;

      while (iterations < maxToolIterations) {
        const result = await this.gateway.generate(
          this.model,
          currentMessages,
          config,
          toolDescriptors
        );

        if (!isOk(result)) {
          return result;
        }

        const response = result.value;

        // If no tool calls, we're done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          return Ok(response.content);
        }

        // Add assistant message with tool calls
        currentMessages.push(Message.assistant(response.content || '', response.toolCalls));

        // Execute tools
        if (!tools) {
          return Err(new ToolError('LLM requested tool calls but no tools provided'));
        }

        for (const toolCall of response.toolCalls) {
          const tool = tools.find((t) => t.name() === toolCall.function.name);

          if (!tool) {
            currentMessages.push(
              Message.tool(
                JSON.stringify({ error: `Tool ${toolCall.function.name} not found` }),
                toolCall.id,
                toolCall.function.name
              )
            );
            continue;
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await tool.run(args);

            if (!isOk(toolResult)) {
              currentMessages.push(
                Message.tool(
                  JSON.stringify({ error: toolResult.error.message }),
                  toolCall.id,
                  toolCall.function.name
                )
              );
              continue;
            }

            currentMessages.push(
              Message.tool(JSON.stringify(toolResult.value), toolCall.id, toolCall.function.name)
            );
          } catch (error) {
            currentMessages.push(
              Message.tool(
                JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
                toolCall.id,
                toolCall.function.name
              )
            );
          }
        }

        iterations++;
      }

      return Err(new ToolError(`Maximum tool iterations (${maxToolIterations}) exceeded`));
    } catch (error) {
      return Err(
        new Error(`Failed to generate: ${error instanceof Error ? error.message : String(error)}`)
      );
    }
  }

  /**
   * Generate a structured object that conforms to a JSON schema.
   *
   * Forces the LLM to return a JSON object matching the provided schema.
   * The response is automatically parsed and type-cast to the specified type.
   *
   * @param messages - Conversation history as an array of messages
   * @param schema - JSON schema the response must conform to
   * @param config - Optional completion configuration
   * @returns Result containing the parsed object or an error
   *
   * @example
   * ```typescript
   * interface Sentiment {
   *   sentiment: 'positive' | 'negative' | 'neutral';
   *   confidence: number;
   * }
   *
   * const schema = {
   *   type: 'object',
   *   properties: {
   *     sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
   *     confidence: { type: 'number' }
   *   },
   *   required: ['sentiment', 'confidence']
   * };
   *
   * const result = await broker.generateObject<Sentiment>(
   *   [Message.user('I love TypeScript!')],
   *   schema
   * );
   * ```
   */
  async generateObject<T = Record<string, unknown>>(
    messages: LlmMessage[],
    schema: Record<string, unknown>,
    config?: CompletionConfig
  ): Promise<Result<T, Error>> {
    try {
      const objectConfig: CompletionConfig = {
        ...config,
        responseFormat: {
          type: 'json_object',
          schema,
        },
      };

      const result = await this.gateway.generate(this.model, messages, objectConfig);

      if (!isOk(result)) {
        return result;
      }

      const response = result.value;

      try {
        const parsed = JSON.parse(response.content) as T;
        return Ok(parsed);
      } catch (parseError) {
        return Err(
          new ParseError(
            `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
          )
        );
      }
    } catch (error) {
      return Err(
        new Error(
          `Failed to generate object: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Generate a streaming completion with full recursive tool calling support.
   *
   * Yields content chunks as they arrive in real-time. When the LLM requests tool calls,
   * this method automatically executes them and recursively streams the follow-up response.
   * This provides immediate user feedback while still supporting complex tool workflows.
   *
   * @param messages - Conversation history as an array of messages
   * @param config - Optional completion configuration
   * @param tools - Optional array of tools the LLM can call
   * @yields Result containing content chunks or errors
   *
   * @example
   * ```typescript
   * for await (const chunk of broker.generateStream(
   *   [Message.user('Tell me about tomorrow')],
   *   { temperature: 0.7 },
   *   [new DateResolverTool()]
   * )) {
   *   if (isOk(chunk)) {
   *     process.stdout.write(chunk.value);
   *   }
   * }
   * ```
   */
  async *generateStream(
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: LlmTool[]
  ): AsyncGenerator<Result<string, Error>> {
    const toolDescriptors = tools?.map((t) => t.descriptor());
    const currentMessages = [...messages];
    let accumulatedContent = '';
    const accumulatedToolCalls: ToolCall[] = [];

    // Stream from gateway and accumulate
    for await (const chunkResult of this.gateway.generateStream(
      this.model,
      currentMessages,
      config,
      toolDescriptors
    )) {
      if (!isOk(chunkResult)) {
        yield chunkResult;
        continue;
      }

      const chunk = chunkResult.value;

      // Yield content chunks immediately
      if (chunk.content) {
        accumulatedContent += chunk.content;
        yield Ok(chunk.content);
      }

      // Accumulate tool calls
      if (chunk.toolCalls) {
        accumulatedToolCalls.push(...chunk.toolCalls);
      }

      // Check if stream is done
      if (chunk.done && accumulatedToolCalls.length > 0) {
        // Tool calls present - execute and recursively stream
        if (!tools) {
          yield Err(new ToolError('LLM requested tool calls but no tools provided'));
          return;
        }

        // Add assistant message with tool calls
        currentMessages.push(Message.assistant(accumulatedContent, accumulatedToolCalls));

        // Execute all tool calls
        for (const toolCall of accumulatedToolCalls) {
          const tool = tools.find((t) => t.name() === toolCall.function.name);

          if (!tool) {
            currentMessages.push(
              Message.tool(
                JSON.stringify({ error: `Tool ${toolCall.function.name} not found` }),
                toolCall.id,
                toolCall.function.name
              )
            );
            continue;
          }

          try {
            const args = JSON.parse(toolCall.function.arguments);
            const toolResult = await tool.run(args);

            if (!isOk(toolResult)) {
              currentMessages.push(
                Message.tool(
                  JSON.stringify({ error: toolResult.error.message }),
                  toolCall.id,
                  toolCall.function.name
                )
              );
              continue;
            }

            currentMessages.push(
              Message.tool(JSON.stringify(toolResult.value), toolCall.id, toolCall.function.name)
            );
          } catch (error) {
            currentMessages.push(
              Message.tool(
                JSON.stringify({
                  error: error instanceof Error ? error.message : String(error),
                }),
                toolCall.id,
                toolCall.function.name
              )
            );
          }
        }

        // Recursively stream with updated messages
        yield* this.generateStream(currentMessages, config, tools);
      }
    }
  }

  /**
   * List all available models from the gateway.
   *
   * @returns Result containing array of model names or an error
   *
   * @example
   * ```typescript
   * const result = await broker.listModels();
   * if (isOk(result)) {
   *   console.log('Available models:', result.value);
   * }
   * ```
   */
  async listModels(): Promise<Result<string[], Error>> {
    return this.gateway.listModels();
  }

  /**
   * Get the current model name being used by this broker.
   *
   * @returns The model name string
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the gateway instance used by this broker.
   *
   * @returns The LlmGateway implementation
   */
  getGateway(): LlmGateway {
    return this.gateway;
  }
}
