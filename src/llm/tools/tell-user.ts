/**
 * Tell user tool - displays messages to the user without expecting a response
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Result } from '../../error';

/**
 * Tool that displays messages to the user without expecting a response
 *
 * This tool allows the LLM to send important intermediate information to the user
 * as it works on completing their request. It's useful for providing status updates,
 * progress information, or other important messages during long-running operations.
 *
 * @example
 * ```typescript
 * const tool = new TellUserTool();
 * const result = await tool.run({ message: "Processing your request..." });
 * // Prints to stdout:
 * //
 * //
 * //
 * // MESSAGE FROM ASSISTANT:
 * // Processing your request...
 * //
 * // Returns: Ok("Message delivered to user.")
 * ```
 */
export class TellUserTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const message = (args.message as string) || '';

    console.log(`\n\n\nMESSAGE FROM ASSISTANT:\n${message}`);

    return Ok('Message delivered to user.');
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'tell_user',
        description:
          'Display a message to the user without expecting a response. Use this to send important intermediate information to the user as you work on completing their request.',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The important message you want to display to the user.',
            },
          },
          required: ['message'],
        },
      },
    };
  }
}
