/**
 * IterativeProblemSolver - An agent that iteratively solves problems using available tools
 */

import { ChatSession } from '../llm/chat-session';
import { LlmBroker } from '../llm/broker';
import { LlmTool } from '../llm/tools';

/**
 * Configuration for IterativeProblemSolver
 */
export interface IterativeProblemSolverConfig {
  broker: LlmBroker;
  tools?: LlmTool[];
  maxIterations?: number;
  systemPrompt?: string;
  temperature?: number;
}

/**
 * An agent that iteratively attempts to solve a problem using available tools.
 *
 * This solver uses a chat-based approach to break down and solve complex problems.
 * It continues attempting to solve the problem until it either succeeds,
 * fails explicitly, or reaches the maximum number of iterations.
 *
 * @example
 * ```typescript
 * const broker = new LlmBroker('qwen3:32b', new OllamaGateway());
 * const solver = new IterativeProblemSolver({
 *   broker,
 *   tools: [new DateResolverTool()],
 *   maxIterations: 5
 * });
 *
 * const result = await solver.solve("What's the date next Friday?");
 * console.log(result);
 * ```
 */
export class IterativeProblemSolver {
  private readonly chat: ChatSession;
  private readonly maxIterations: number;

  /**
   * Create a new IterativeProblemSolver instance.
   *
   * @param config - Configuration options
   */
  constructor(config: IterativeProblemSolverConfig) {
    const {
      broker,
      tools = [],
      maxIterations = 3,
      systemPrompt = 'You are a problem-solving assistant that can solve complex problems step by step. ' +
        'You analyze problems, break them down into smaller parts, and solve them systematically. ' +
        'If you cannot solve a problem completely in one step, you make progress and identify what to do next.',
      temperature = 1.0,
    } = config;

    this.maxIterations = maxIterations;
    this.chat = new ChatSession(broker, {
      systemPrompt,
      tools,
      temperature,
    });
  }

  /**
   * Execute the problem-solving process.
   *
   * This method runs the iterative problem-solving process, continuing until one of
   * these conditions is met:
   * - The task is completed successfully ("DONE")
   * - The task fails explicitly ("FAIL")
   * - The maximum number of iterations is reached
   *
   * @param problem - The problem or request to be solved
   * @returns A summary of the final result, excluding the process details
   */
  async solve(problem: string): Promise<string> {
    let iterationsRemaining = this.maxIterations;
    let shouldContinue = true;

    while (shouldContinue && iterationsRemaining > 0) {
      const result = await this.step(problem);

      if (result.toLowerCase().includes('fail')) {
        shouldContinue = false;
      } else if (result.toLowerCase().includes('done')) {
        shouldContinue = false;
      } else {
        iterationsRemaining--;
      }
    }

    const summary = await this.chat.send(
      'Summarize the final result, and only the final result, without commenting on the process by which you achieved it.'
    );

    return summary;
  }

  /**
   * Execute a single problem-solving step.
   *
   * This method sends a prompt to the chat session asking it to work on the user's request
   * using available tools. The response should indicate success ("DONE") or failure ("FAIL").
   *
   * @param problem - The problem or request to be solved
   * @returns The response from the chat session, indicating the step's outcome
   */
  private async step(problem: string): Promise<string> {
    const prompt = `
Given the user request:
${problem}

Use the tools at your disposal to act on their request. You may wish to create a step-by-step plan for more complicated requests.

If you cannot provide an answer, say only "FAIL".
If you have the answer, say only "DONE".
`;
    return this.chat.send(prompt);
  }

  /**
   * Get the current chat messages (for inspection/debugging).
   *
   * @returns Array of messages in the chat session
   */
  getMessages() {
    return this.chat.getMessages();
  }

  /**
   * Clear the chat history except the system prompt.
   */
  clear(): void {
    this.chat.clear();
  }

  /**
   * Clean up resources when done.
   */
  dispose(): void {
    this.chat.dispose();
  }
}
