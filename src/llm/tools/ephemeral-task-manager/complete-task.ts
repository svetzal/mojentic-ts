/**
 * Tool for completing a task in the ephemeral task manager
 *
 * This tool changes a task's status from InProgress to Completed
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class CompleteTaskTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const taskId = Number(args.id) || 0;
      const task = this.taskList.completeTask(taskId);

      return Ok({
        id: task.id,
        description: task.description,
        status: task.status,
        summary: `Task '${taskId}' completed successfully`,
      });
    } catch (error) {
      return Ok({
        error: error instanceof Error ? error.message : String(error),
        summary: `Failed to complete task: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'complete_task',
        description: 'Complete a task by changing its status from IN_PROGRESS to COMPLETED.',
        parameters: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The ID of the task to complete',
            },
          },
          required: ['id'],
        },
      },
    };
  }
}
