/**
 * Tool for inserting a new task after an existing task in the ephemeral task manager list
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class InsertTaskAfterTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const existingTaskId = Number(args.existing_task_id) || 0;
      const description = (args.description as string) || '';

      const task = this.taskList.insertTaskAfter(existingTaskId, description);

      return Ok({
        id: task.id,
        description: task.description,
        status: task.status,
        summary: `Task '${task.id}' inserted after task '${existingTaskId}' successfully`,
      });
    } catch (error) {
      return Ok({
        error: error instanceof Error ? error.message : String(error),
        summary: `Failed to insert task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'insert_task_after',
        description:
          "Insert a new task after an existing task in the task list. The task will start with 'pending' status.",
        parameters: {
          type: 'object',
          properties: {
            existing_task_id: {
              type: 'integer',
              description: 'The ID of the existing task after which to insert the new task',
            },
            description: {
              type: 'string',
              description: 'The description of the new task',
            },
          },
          required: ['existing_task_id', 'description'],
        },
      },
    };
  }
}
