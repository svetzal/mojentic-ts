/**
 * Task status enumeration
 */
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
}

/**
 * Represents a task with an identifier, description, and status
 */
export interface Task {
  id: number;
  description: string;
  status: TaskStatus;
}

/**
 * Creates a new task
 */
export function createTask(id: number, description: string): Task {
  return {
    id,
    description,
    status: TaskStatus.Pending,
  };
}
