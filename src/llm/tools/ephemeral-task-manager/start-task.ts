/**
 * Tool for starting a task in the ephemeral task manager
 *
 * This tool changes a task's status from Pending to InProgress
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class StartTaskTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const taskId = Number(args.id) || 0;
      const task = this.taskList.startTask(taskId);

      return Ok({
        id: task.id,
        description: task.description,
        status: task.status,
        summary: `Task '${taskId}' started successfully`,
      });
    } catch (error) {
      return Ok({
        error: error instanceof Error ? error.message : String(error),
        summary: `Failed to start task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'start_task',
        description: 'Start a task by changing its status from PENDING to IN_PROGRESS.',
        parameters: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The ID of the task to start',
            },
          },
          required: ['id'],
        },
      },
    };
  }
}
