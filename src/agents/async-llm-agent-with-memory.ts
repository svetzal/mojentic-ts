/**
 * Async LLM Agent with Memory - Base class for agents that use shared memory
 */

import { AsyncLlmAgent, AsyncLlmAgentConfig } from './async-llm-agent';
import { SharedWorkingMemory } from '../context';
import { Message, LlmMessage } from '../llm/models';
import { Result, Ok, isOk } from '../error';

/**
 * Configuration for AsyncLlmAgentWithMemory
 */
export interface AsyncLlmAgentWithMemoryConfig extends Omit<AsyncLlmAgentConfig, 'responseModel'> {
  /** Shared working memory instance for reading and writing context */
  memory: SharedWorkingMemory;
  /** Instructions for the agent on how to process events and use memory */
  instructions: string;
  /** JSON schema for the agent's response (required for memory agents) */
  responseModel: Record<string, unknown>;
}

/**
 * Base class for async agents that use an LLM with shared working memory.
 *
 * This agent extends AsyncLlmAgent to add memory capabilities. The agent
 * automatically includes current memory in its context and can update memory
 * based on new information learned during processing.
 *
 * Memory is provided to the LLM in the system messages, and the LLM response
 * includes a memory field that is merged back into the shared memory.
 *
 * @example
 * ```typescript
 * interface QuestionResponse {
 *   answer: string;
 * }
 *
 * class QuestionAgent extends AsyncLlmAgentWithMemory {
 *   constructor(broker: LlmBroker, memory: SharedWorkingMemory) {
 *     super({
 *       broker,
 *       memory,
 *       behaviour: 'You are a helpful assistant who remembers what you learn.',
 *       instructions: 'Answer questions using your memory and remember new facts.',
 *       responseModel: {
 *         type: 'object',
 *         properties: {
 *           answer: { type: 'string' }
 *         },
 *         required: ['answer']
 *       }
 *     });
 *   }
 *
 *   async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
 *     if (isQuestionEvent(event)) {
 *       const result = await this.generateResponseWithMemory<QuestionResponse>(
 *         event.question
 *       );
 *       if (isOk(result)) {
 *         return Ok([new AnswerEvent({ answer: result.value.answer })]);
 *       }
 *     }
 *     return Ok([]);
 *   }
 * }
 * ```
 */
export abstract class AsyncLlmAgentWithMemory extends AsyncLlmAgent {
  protected readonly memory: SharedWorkingMemory;
  protected readonly instructions: string;

  constructor(config: AsyncLlmAgentWithMemoryConfig) {
    super({
      ...config,
      // Memory agents always need a response model for structured memory updates
      responseModel: config.responseModel,
    });
    this.memory = config.memory;
    this.instructions = config.instructions;
  }

  /**
   * Create the initial message set including memory context.
   *
   * This includes:
   * 1. System message with behaviour
   * 2. Memory context with current working memory
   * 3. Instructions on how to use memory
   *
   * @returns Array of messages to send to the LLM
   */
  protected createInitialMessagesWithMemory(): LlmMessage[] {
    const currentMemory = this.memory.getWorkingMemory();

    return [
      Message.system(this.behaviour),
      Message.user(
        `This is what you remember:\n${JSON.stringify(currentMemory, null, 2)}\n\n` +
          `Remember anything new you learn by storing it to your working memory in your response.`
      ),
      Message.user(this.instructions),
    ];
  }

  /**
   * Generate a response from the LLM with memory context and update memory.
   *
   * This method:
   * 1. Includes current memory in the context
   * 2. Requests a response with updated memory
   * 3. Merges new memory into shared memory
   * 4. Returns the response without the memory field
   *
   * @param content - The user message content to send to the LLM
   * @returns Result containing the LLM response or an error
   */
  protected async generateResponseWithMemory<T>(content: string): Promise<Result<T, Error>> {
    // Create augmented response model that includes memory field
    const responseWithMemorySchema = {
      type: 'object',
      properties: {
        ...(this.responseModel?.properties as Record<string, unknown>),
        memory: {
          type: 'object',
          description: 'Add anything new that you have learned here.',
          default: this.memory.getWorkingMemory(),
        },
      },
      required: [...((this.responseModel?.required as string[]) || [])],
    };

    // Build messages with memory context
    const messages: LlmMessage[] = [
      ...this.createInitialMessagesWithMemory(),
      Message.user(content),
    ];

    // Generate structured response
    const result = await this.broker.generateObject<T & { memory?: Record<string, unknown> }>(
      messages,
      responseWithMemorySchema
    );

    if (isOk(result)) {
      const responseWithMemory = result.value;

      // Extract and merge memory if present
      if (responseWithMemory.memory) {
        this.memory.mergeToWorkingMemory(responseWithMemory.memory);
      }

      // Remove memory field from response before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { memory: _memory, ...responseWithoutMemory } = responseWithMemory;

      return Ok(responseWithoutMemory as T);
    }

    return result as Result<T, Error>;
  }
}
