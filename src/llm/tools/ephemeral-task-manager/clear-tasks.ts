/**
 * Tool for clearing all tasks from the ephemeral task manager
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';

export class ClearTasksTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(_args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const count = this.taskList.clearTasks();

    return Ok({
      count,
      summary: `Cleared ${count} tasks from the list`,
    });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'clear_tasks',
        description: 'Remove all tasks from the task list.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    };
  }
}
