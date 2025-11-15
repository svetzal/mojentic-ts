/**
 * Tool Wrapper - Wraps agents as tools for agent delegation
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Result } from '../../error';
import { Agent } from '../agent';
import { Message } from '../models';

/**
 * Wraps an agent as a tool, enabling agent delegation patterns.
 *
 * This allows one agent (coordinator) to use other agents (specialists)
 * as tools, delegating specific tasks to domain experts.
 *
 * @example
 * ```typescript
 * const specialist = new Agent(
 *   new LlmBroker('qwen3:7b', gateway),
 *   [new DateResolverTool()],
 *   'You are a temporal specialist...'
 * );
 *
 * const coordinator = new Agent(
 *   new LlmBroker('qwen3:32b', gateway),
 *   [new ToolWrapper(specialist, 'temporal_specialist', 'A historian...')],
 *   'You are a coordinator...'
 * );
 * ```
 */
export class ToolWrapper extends BaseTool {
  /**
   * Creates a new tool wrapper.
   *
   * @param agent - The agent to wrap as a tool
   * @param toolName - Name for the tool (used in function calls)
   * @param toolDescription - Description of what this agent does
   */
  constructor(
    private readonly agent: Agent,
    private readonly toolName: string,
    private readonly toolDescription: string
  ) {
    super();
  }

  /**
   * Execute the wrapped agent with the given input.
   *
   * @param args - Tool arguments (must contain 'input' field)
   * @returns Result containing the agent's response
   */
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const input = args.input as string;
    if (!input) {
      return { ok: true, value: { error: 'input is required' } };
    }

    // Create initial messages from agent's behavior
    const messages = this.agent.createInitialMessages();

    // Append the input as a user message
    messages.push(Message.user(input));

    // Call the agent's broker with the agent's tools
    return this.agent.getBroker().generate(messages, this.agent.getTools());
  }

  /**
   * Get the tool descriptor for LLM.
   *
   * @returns Tool descriptor with single 'input' parameter
   */
  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: this.toolName,
        description: this.toolDescription,
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Instructions for this agent.',
            },
          },
          required: ['input'],
        },
      },
    };
  }
}
