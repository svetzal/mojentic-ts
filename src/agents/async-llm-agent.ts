/**
 * Async LLM Agent - Base class for agents that use LLMs to generate responses
 */

import { BaseAsyncAgent } from './base-async-agent';
import { Event } from './event';
import { LlmBroker } from '../llm/broker';
import { LlmTool } from '../llm/tools';
import { Message } from '../llm/models';
import { Result, Ok, isOk } from '../error';

/**
 * Configuration for AsyncLlmAgent
 */
export interface AsyncLlmAgentConfig {
  /** The LLM broker to use for generating responses */
  broker: LlmBroker;
  /** System prompt defining the agent's behavior and personality */
  behaviour: string;
  /** Optional JSON schema for structured output */
  responseModel?: Record<string, unknown>;
  /** Optional tools the agent can use */
  tools?: LlmTool[];
}

/**
 * Base class for async agents that use an LLM to generate responses.
 *
 * This agent wraps an LLM broker and provides convenient methods for
 * generating text or structured responses. Subclasses implement
 * `receiveEventAsync` to define their event handling logic.
 *
 * @example
 * ```typescript
 * class FactCheckerAgent extends AsyncLlmAgent {
 *   constructor(broker: LlmBroker) {
 *     super({
 *       broker,
 *       behaviour: 'You are a fact-checking assistant.',
 *       responseModel: factCheckSchema
 *     });
 *   }
 *
 *   async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
 *     if (isQuestionEvent(event)) {
 *       const result = await this.generateResponse<FactCheckResponse>(
 *         `Check facts about: ${event.question}`
 *       );
 *       if (isOk(result)) {
 *         return Ok([new FactCheckEvent({ facts: result.value.facts })]);
 *       }
 *     }
 *     return Ok([]);
 *   }
 * }
 * ```
 */
export abstract class AsyncLlmAgent implements BaseAsyncAgent {
  protected readonly broker: LlmBroker;
  protected readonly behaviour: string;
  protected readonly responseModel?: Record<string, unknown>;
  protected readonly tools: LlmTool[];

  constructor(config: AsyncLlmAgentConfig) {
    this.broker = config.broker;
    this.behaviour = config.behaviour;
    this.responseModel = config.responseModel;
    this.tools = config.tools || [];
  }

  /**
   * Add a tool to the agent's available tools.
   *
   * @param tool - The tool to add
   */
  addTool(tool: LlmTool): void {
    this.tools.push(tool);
  }

  /**
   * Generate a response from the LLM.
   *
   * If a responseModel is configured, returns structured output conforming to the schema.
   * Otherwise, returns plain text.
   *
   * @param content - The user message content to send to the LLM
   * @returns Result containing the LLM response or an error
   */
  protected async generateResponse<T = string>(content: string): Promise<Result<T, Error>> {
    const messages = [Message.system(this.behaviour), Message.user(content)];

    if (this.responseModel) {
      // Generate structured object
      const result = await this.broker.generateObject<T>(messages, this.responseModel);
      return result;
    } else {
      // Generate text with optional tools
      const result = await this.broker.generate(messages, this.tools);
      if (isOk(result)) {
        return Ok(result.value as T);
      }
      return result as Result<T, Error>;
    }
  }

  /**
   * Process an incoming event and optionally produce new events.
   * Must be implemented by subclasses.
   *
   * @param event - The event to process
   * @returns Result containing array of new events or an error
   */
  abstract receiveEventAsync(event: Event): Promise<Result<Event[], Error>>;
}
