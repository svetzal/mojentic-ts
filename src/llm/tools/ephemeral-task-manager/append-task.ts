/**
 * Tool for appending a new task to the end of the ephemeral task manager list
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class AppendTaskTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const description = (args.description as string) || '';
      const task = this.taskList.appendTask(description);

      return Ok({
        id: task.id,
        description: task.description,
        status: task.status,
        summary: `Task '${task.id}' appended successfully`,
      });
    } catch (error) {
      return Ok({
        error: error instanceof Error ? error.message : String(error),
        summary: `Failed to append task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'append_task',
        description:
          "Append a new task to the end of the task list with a description. The task will start with 'pending' status.",
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
