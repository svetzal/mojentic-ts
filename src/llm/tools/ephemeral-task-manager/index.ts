/**
 * Ephemeral Task Manager tools for managing a list of tasks
 *
 * This module provides tools for appending, prepending, inserting, starting,
 * completing, and listing tasks. Tasks follow a state machine that transitions
 * from Pending through InProgress to Completed.
 *
 * @example
 * ```typescript
 * import { TaskList, allTools } from './ephemeral-task-manager';
 * import { LlmBroker } from '../broker';
 *
 * const taskList = new TaskList();
 * const tools = allTools(taskList);
 *
 * const broker = new LlmBroker('qwen3:32b', gateway);
 * const response = await broker.generate([message], tools);
 * ```
 */

export { Task, TaskStatus, createTask } from './task';
export { TaskList } from './task-list';
export { AppendTaskTool } from './append-task';
export { PrependTaskTool } from './prepend-task';
export { InsertTaskAfterTool } from './insert-task-after';
export { StartTaskTool } from './start-task';
export { CompleteTaskTool } from './complete-task';
export { ListTasksTool } from './list-tasks';
export { ClearTasksTool } from './clear-tasks';

import { TaskList } from './task-list';
import { LlmTool } from '../tool';
import { AppendTaskTool } from './append-task';
import { PrependTaskTool } from './prepend-task';
import { InsertTaskAfterTool } from './insert-task-after';
import { StartTaskTool } from './start-task';
import { CompleteTaskTool } from './complete-task';
import { ListTasksTool } from './list-tasks';
import { ClearTasksTool } from './clear-tasks';

/**
 * Creates all task manager tools with a shared task list
 *
 * @param taskList - The shared task list to use across all tools
 * @returns Array of all task management tools
 *
 * @example
 * ```typescript
 * const taskList = new TaskList();
 * const tools = allTools(taskList);
 * ```
 */
export function allTools(taskList: TaskList): LlmTool[] {
  return [
    new AppendTaskTool(taskList),
    new PrependTaskTool(taskList),
    new InsertTaskAfterTool(taskList),
    new StartTaskTool(taskList),
    new CompleteTaskTool(taskList),
    new ListTasksTool(taskList),
    new ClearTasksTool(taskList),
  ];
}
