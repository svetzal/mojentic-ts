/**
 * Agent - Simple agent with LLM broker, tools, and behavior
 */

import { LlmBroker } from './broker';
import { LlmTool } from './tools';
import { Message, LlmMessage } from './models';
import { Result } from '../error';

/**
 * A simple agent that combines an LLM broker with tools and behavior.
 * Agents can be composed and used as tools by other agents through ToolWrapper.
 *
 * @example
 * ```typescript
 * const agent = new Agent(
 *   new LlmBroker('qwen3:32b', gateway),
 *   [new DateResolverTool()],
 *   'You are a helpful assistant that can resolve dates.'
 * );
 *
 * const result = await agent.generate('What day is next Friday?');
 * ```
 */
export class Agent {
  /**
   * Creates a new agent instance.
   *
   * @param broker - The LLM broker to use for generation
   * @param tools - Array of tools available to the agent
   * @param behavior - System message defining agent's personality and behavior
   */
  constructor(
    private readonly broker: LlmBroker,
    private readonly tools: LlmTool[] = [],
    private readonly behavior: string = 'You are a helpful assistant.'
  ) {}

  /**
   * Generate a response to user input.
   *
   * @param input - User input string
   * @returns Result containing the agent's response or an error
   */
  async generate(input: string): Promise<Result<string, Error>> {
    const messages = this.createInitialMessages();
    messages.push(Message.user(input));
    return this.broker.generate(messages, this.tools);
  }

  /**
   * Create initial messages with system behavior.
   * Can be used by ToolWrapper to set up agent context.
   *
   * @internal
   */
  createInitialMessages(): LlmMessage[] {
    return [Message.system(this.behavior)];
  }

  /**
   * Get the agent's broker.
   *
   * @internal
   */
  getBroker(): LlmBroker {
    return this.broker;
  }

  /**
   * Get the agent's tools.
   *
   * @internal
   */
  getTools(): LlmTool[] {
    return this.tools;
  }

  /**
   * Get the agent's behavior.
   *
   * @internal
   */
  getBehavior(): string {
    return this.behavior;
  }
}
