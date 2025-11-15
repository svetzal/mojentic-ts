/**
 * Task list for the ephemeral task manager
 */

import { Task, TaskStatus, createTask } from './task';
import { ValidationError } from '../../../error';

/**
 * Manages a list of tasks for the ephemeral task manager
 *
 * This class provides methods for adding, starting, completing, and listing tasks.
 * Tasks follow a state machine that transitions from Pending through InProgress to Completed.
 */
export class TaskList {
  private tasks: Task[] = [];
  private nextId = 1;

  /**
   * Claims the next available ID and increments the counter
   */
  private claimNextId(): number {
    return this.nextId++;
  }

  /**
   * Appends a new task to the end of the list
   *
   * @param description - The description of the task
   * @returns The newly created task with Pending status
   */
  appendTask(description: string): Task {
    const id = this.claimNextId();
    const task = createTask(id, description);
    this.tasks.push(task);
    return task;
  }

  /**
   * Prepends a new task to the beginning of the list
   *
   * @param description - The description of the task
   * @returns The newly created task with Pending status
   */
  prependTask(description: string): Task {
    const id = this.claimNextId();
    const task = createTask(id, description);
    this.tasks.unshift(task);
    return task;
  }

  /**
   * Inserts a new task after an existing task with the given ID
   *
   * @param existingTaskId - The ID of the existing task after which to insert
   * @param description - The description of the new task
   * @returns The newly created task
   * @throws ValidationError if the existing task is not found
   */
  insertTaskAfter(existingTaskId: number, description: string): Task {
    const index = this.tasks.findIndex((t) => t.id === existingTaskId);
    if (index === -1) {
      throw new ValidationError(`No task with ID '${existingTaskId}' exists`);
    }

    const id = this.claimNextId();
    const task = createTask(id, description);
    this.tasks.splice(index + 1, 0, task);
    return task;
  }

  /**
   * Starts a task by changing its status from Pending to InProgress
   *
   * @param taskId - The ID of the task to start
   * @returns The started task
   * @throws ValidationError if the task is not found or not in Pending status
   */
  startTask(taskId: number): Task {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new ValidationError(`No task with ID '${taskId}' exists`);
    }

    if (task.status !== TaskStatus.Pending) {
      throw new ValidationError(
        `Task '${taskId}' cannot be started because it is not in PENDING status`
      );
    }

    task.status = TaskStatus.InProgress;
    return task;
  }

  /**
   * Completes a task by changing its status from InProgress to Completed
   *
   * @param taskId - The ID of the task to complete
   * @returns The completed task
   * @throws ValidationError if the task is not found or not in InProgress status
   */
  completeTask(taskId: number): Task {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new ValidationError(`No task with ID '${taskId}' exists`);
    }

    if (task.status !== TaskStatus.InProgress) {
      throw new ValidationError(
        `Task '${taskId}' cannot be completed because it is not in IN_PROGRESS status`
      );
    }

    task.status = TaskStatus.Completed;
    return task;
  }

  /**
   * Returns all tasks in the list
   */
  listTasks(): Task[] {
    return [...this.tasks];
  }

  /**
   * Clears all tasks from the list
   *
   * @returns The number of tasks that were cleared
   */
  clearTasks(): number {
    const count = this.tasks.length;
    this.tasks = [];
    return count;
  }
}
