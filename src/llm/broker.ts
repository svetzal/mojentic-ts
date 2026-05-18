/**
 * LLM Broker - Main interface for LLM interactions with tool support
 */

import { LlmGateway } from './gateway';
import { LlmMessage, CompletionConfig, Message, ToolCall } from './models';
import { LlmTool, SerialToolRunner, ToolCallExecution, ToolCallOutcome, ToolRunner } from './tools';
import { Result, Ok, Err, isOk, ParseError, ToolError } from '../error';
import { TracerSystem } from '../tracer';
import { randomUUID } from 'crypto';

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
  private readonly tracer?: TracerSystem;
  private readonly toolRunner: ToolRunner;

  /**
   * Creates a new LLM broker instance.
   *
   * @param model - The model name to use (e.g., 'qwen3:32b', 'gpt-4')
   * @param gateway - The gateway implementation for the LLM provider
   * @param tracer - Optional tracer system for recording LLM calls and responses
   * @param toolRunner - Optional tool execution strategy. Defaults to {@link SerialToolRunner}
   *   for backward compatibility; pass {@link ParallelToolRunner} to dispatch
   *   tool calls concurrently within a single assistant turn.
   */
  constructor(
    private readonly model: string,
    private readonly gateway: LlmGateway,
    tracer?: TracerSystem,
    toolRunner?: ToolRunner
  ) {
    this.tracer = tracer;
    this.toolRunner = toolRunner ?? new SerialToolRunner();
  }

  private async runToolBatch(
    toolCalls: readonly ToolCall[],
    tools: readonly LlmTool[],
    corrId: string,
    source: string
  ): Promise<{ outcomes: ToolCallOutcome[]; messages: LlmMessage[]; parseFailures: number }> {
    const executions: ToolCallExecution[] = [];
    const argsByCallId = new Map<string, Record<string, unknown>>();
    const parseFailureMessages: LlmMessage[] = [];

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        argsByCallId.set(toolCall.id, args);
        executions.push({ id: toolCall.id, name: toolCall.function.name, args });
      } catch (err) {
        parseFailureMessages.push(
          Message.tool(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
            toolCall.id,
            toolCall.function.name
          )
        );
      }
    }

    const batchId = randomUUID();
    const batchStart = Date.now();

    const outcomes = await this.toolRunner.runBatch(executions, tools, {
      correlationId: corrId,
      source,
      onCallComplete: (outcome) => {
        if (!this.tracer) return;
        const args = argsByCallId.get(outcome.id) ?? {};
        const result = outcome.ok ? outcome.result : { error: outcome.error.message };
        this.tracer.recordToolCall(
          outcome.name,
          args,
          result,
          'LlmBroker',
          outcome.durationMs,
          corrId,
          source
        );
      },
    });

    const successCount = outcomes.filter((o) => o.ok).length;
    const failureCount = outcomes.length - successCount;

    if (this.tracer && (outcomes.length > 0 || parseFailureMessages.length > 0)) {
      this.tracer.recordToolBatch(
        batchId,
        executions.map((e) => e.name),
        successCount,
        failureCount + parseFailureMessages.length,
        Date.now() - batchStart,
        corrId,
        source
      );
    }

    const outcomeById = new Map(outcomes.map((o) => [o.id, o]));
    const messages: LlmMessage[] = [];
    for (const toolCall of toolCalls) {
      const outcome = outcomeById.get(toolCall.id);
      if (!outcome) {
        // Argument-parse failures were captured above in input order;
        // pull the next one.
        const parseMsg = parseFailureMessages.shift();
        if (parseMsg) {
          messages.push(parseMsg);
        }
        continue;
      }
      const content = outcome.ok
        ? JSON.stringify(outcome.result)
        : JSON.stringify({ error: outcome.error.message });
      messages.push(Message.tool(content, toolCall.id, toolCall.function.name));
    }

    return { outcomes, messages, parseFailures: parseFailureMessages.length };
  }

  /**
   * Generate a text completion from the LLM with automatic recursive tool execution.
   *
   * When the LLM requests tool calls, this method automatically executes them and
   * recursively calls the LLM with the results until a final text response is obtained.
   *
   * @param messages - Conversation history as an array of messages
   * @param tools - Optional array of tools the LLM can call
   * @param config - Optional completion configuration (temperature, tokens, etc.)
   * @param correlationId - UUID for tracing related events
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
    correlationId?: string
  ): Promise<Result<string, Error>> {
    try {
      const toolDescriptors = tools?.map((t) => t.descriptor());
      const currentMessages = [...messages];
      let iterations = 0;

      const maxToolIterations = config?.maxToolIterations ?? 10;

      // Generate correlationId if not provided
      const corrId = correlationId || randomUUID();

      while (iterations < maxToolIterations) {
        // Record LLM call in tracer
        if (this.tracer) {
          this.tracer.recordLlmCall(
            this.model,
            currentMessages,
            config?.temperature ?? 1.0,
            toolDescriptors as Record<string, unknown>[] | undefined,
            corrId,
            'LlmBroker.generate'
          );
        }

        const startTime = Date.now();
        const result = await this.gateway.generate(
          this.model,
          currentMessages,
          config,
          toolDescriptors
        );
        const callDurationMs = Date.now() - startTime;

        if (!isOk(result)) {
          return result;
        }

        const response = result.value;

        // Record LLM response in tracer
        if (this.tracer) {
          this.tracer.recordLlmResponse(
            this.model,
            response.content,
            response.toolCalls,
            callDurationMs,
            corrId,
            'LlmBroker.generate'
          );
        }

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

        const { messages: toolMessages } = await this.runToolBatch(
          response.toolCalls,
          tools,
          corrId,
          'LlmBroker.generate'
        );
        currentMessages.push(...toolMessages);

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
   * @param correlationId - UUID for tracing related events
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
    config?: CompletionConfig,
    correlationId?: string
  ): Promise<Result<T, Error>> {
    try {
      const corrId = correlationId || randomUUID();

      const objectConfig: CompletionConfig = {
        ...config,
        responseFormat: {
          type: 'json_object',
          schema,
        },
      };

      // Record LLM call in tracer
      if (this.tracer) {
        this.tracer.recordLlmCall(
          this.model,
          messages,
          config?.temperature ?? 1.0,
          undefined,
          corrId,
          'LlmBroker.generateObject'
        );
      }

      const startTime = Date.now();
      const result = await this.gateway.generate(this.model, messages, objectConfig);
      const callDurationMs = Date.now() - startTime;

      if (!isOk(result)) {
        return result;
      }

      const response = result.value;

      // Record LLM response in tracer
      if (this.tracer) {
        this.tracer.recordLlmResponse(
          this.model,
          response.content,
          undefined,
          callDurationMs,
          corrId,
          'LlmBroker.generateObject'
        );
      }

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
   * @param correlationId - UUID for tracing related events
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
    tools?: LlmTool[],
    correlationId?: string
  ): AsyncGenerator<Result<string, Error>> {
    const maxToolIterations = config?.maxToolIterations ?? 10;
    const corrId = correlationId || randomUUID();
    yield* this.generateStreamWithTools(messages, config, tools, corrId, maxToolIterations);
  }

  private async *generateStreamWithTools(
    messages: LlmMessage[],
    config: CompletionConfig | undefined,
    tools: LlmTool[] | undefined,
    corrId: string,
    iterationsRemaining: number
  ): AsyncGenerator<Result<string, Error>> {
    const maxToolIterations = config?.maxToolIterations ?? 10;

    if (iterationsRemaining <= 0) {
      yield Err(new ToolError(`Maximum tool iterations (${maxToolIterations}) exceeded`));
      return;
    }

    const toolDescriptors = tools?.map((t) => t.descriptor());
    const currentMessages = [...messages];
    let accumulatedContent = '';
    const accumulatedToolCalls: ToolCall[] = [];

    // Record LLM call in tracer
    if (this.tracer) {
      this.tracer.recordLlmCall(
        this.model,
        currentMessages,
        config?.temperature ?? 1.0,
        toolDescriptors as Record<string, unknown>[] | undefined,
        corrId,
        'LlmBroker.generateStream'
      );
    }

    const startTime = Date.now();

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
        const callDurationMs = Date.now() - startTime;

        // Record LLM response in tracer
        if (this.tracer) {
          this.tracer.recordLlmResponse(
            this.model,
            accumulatedContent,
            accumulatedToolCalls,
            callDurationMs,
            corrId,
            'LlmBroker.generateStream'
          );
        }

        // Tool calls present - execute and recursively stream
        if (!tools) {
          yield Err(new ToolError('LLM requested tool calls but no tools provided'));
          return;
        }

        // Add assistant message with tool calls
        currentMessages.push(Message.assistant(accumulatedContent, accumulatedToolCalls));

        const { messages: toolMessages } = await this.runToolBatch(
          accumulatedToolCalls,
          tools,
          corrId,
          'LlmBroker.generateStream'
        );
        currentMessages.push(...toolMessages);

        // Recursively stream with updated messages
        yield* this.generateStreamWithTools(
          currentMessages,
          config,
          tools,
          corrId,
          iterationsRemaining - 1
        );
      } else if (chunk.done) {
        // Stream done without tool calls
        const callDurationMs = Date.now() - startTime;

        // Record LLM response in tracer
        if (this.tracer) {
          this.tracer.recordLlmResponse(
            this.model,
            accumulatedContent,
            undefined,
            callDurationMs,
            corrId,
            'LlmBroker.generateStream'
          );
        }
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
