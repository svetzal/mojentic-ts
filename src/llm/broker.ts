/**
 * LLM Broker - Main interface for LLM interactions with tool support
 */

import { LlmGateway } from './gateway';
import { LlmMessage, CompletionConfig, Message, ToolCall } from './models';
import { LlmTool } from './tools';
import { Result, Ok, Err, isOk, ParseError, ToolError } from '../error';

/**
 * Main broker for LLM interactions
 */
export class LlmBroker {
  constructor(
    private readonly model: string,
    private readonly gateway: LlmGateway
  ) {}

  /**
   * Generate a text completion
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
   * Generate a structured object using JSON schema
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
   * Generate a streaming completion with full tool calling support
   *
   * Yields content chunks as they arrive, and handles tool calls automatically.
   * When tool calls are detected, the broker executes them and recursively
   * streams the LLM's follow-up response.
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
   * List available models from the gateway
   */
  async listModels(): Promise<Result<string[], Error>> {
    return this.gateway.listModels();
  }

  /**
   * Get the current model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the gateway instance
   */
  getGateway(): LlmGateway {
    return this.gateway;
  }
}
