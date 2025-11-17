/**
 * Ask user tool - prompts user for input when the LLM needs help
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Result } from '../../error';
import * as readline from 'readline';

/**
 * Tool that prompts the user for input when the LLM needs help or information.
 *
 * This tool allows the LLM to ask questions or request assistance from the user
 * during problem-solving. It displays a message and waits for user input via stdin.
 *
 * @example
 * ```typescript
 * const tool = new AskUserTool();
 * const result = await tool.run({
 *   user_request: "What is your preferred programming language?"
 * });
 * // Displays:
 * //
 * //
 * //
 * // I NEED YOUR HELP!
 * // What is your preferred programming language?
 * // Your response:
 * // (waits for user input)
 * ```
 */
export class AskUserTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const userRequest = (args.user_request as string) || '';

    console.log(`\n\n\nI NEED YOUR HELP!\n${userRequest}`);

    const response = await this.promptUser('Your response: ');

    return Ok(response);
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'ask_user',
        description:
          'If you do not know how to proceed, ask the user a question, or ask them for help or to do something for you.',
        parameters: {
          type: 'object',
          properties: {
            user_request: {
              type: 'string',
              description:
                'The question you need the user to answer, or the task you need the user to do for you.',
            },
          },
          required: ['user_request'],
        },
      },
    };
  }

  /**
   * Prompt the user for input via readline.
   *
   * @param prompt - The prompt text to display
   * @returns Promise resolving to the user's input
   */
  private async promptUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
}
