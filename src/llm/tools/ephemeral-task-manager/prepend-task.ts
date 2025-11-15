/**
 * Tool for prepending a new task to the beginning of the ephemeral task manager list
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class PrependTaskTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const description = (args.description as string) || '';
      const task = this.taskList.prependTask(description);

      return Ok({
        id: task.id,
        description: task.description,
        status: task.status,
        summary: `Task '${task.id}' prepended successfully`,
      });
    } catch (error) {
      return Ok({
        error: error instanceof Error ? error.message : String(error),
        summary: `Failed to prepend task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'prepend_task',
        description:
          "Prepend a new task to the beginning of the task list with a description. The task will start with 'pending' status.",
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'The description of the task',
            },
          },
          required: ['description'],
        },
      },
    };
  }
}
