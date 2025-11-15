/**
 * Tool for listing all tasks in the ephemeral task manager
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tool';
import { Ok, Result } from '../../../error';
import { TaskList } from './task-list';
import { Task } from './task';

export class ListTasksTool extends BaseTool {
  constructor(private taskList: TaskList) {
    super();
  }

  async run(_args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const tasks = this.taskList.listTasks();
    const taskListStr = this.formatTasks(tasks);

    return Ok({
      count: tasks.length,
      tasks: taskListStr,
      summary: `Found ${tasks.length} tasks\n\n${taskListStr}`,
    });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'list_tasks',
        description: 'List all tasks in the task list.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    };
  }

  private formatTasks(tasks: Task[]): string {
    if (tasks.length === 0) {
      return 'No tasks found.';
    }

    return tasks.map((task) => `${task.id}. ${task.description} (${task.status})`).join('\n');
  }
}
