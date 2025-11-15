/**
 * Tests for TaskList
 */

import { TaskList } from './task-list';
import { TaskStatus } from './task';
import { ValidationError } from '../../../error';

describe('TaskList', () => {
  let taskList: TaskList;

  beforeEach(() => {
    taskList = new TaskList();
  });

  describe('appendTask', () => {
    it('should append task to empty list', () => {
      const task = taskList.appendTask('First task');
      expect(task.id).toBe(1);
      expect(task.description).toBe('First task');
      expect(task.status).toBe(TaskStatus.Pending);
    });

    it('should append multiple tasks with incrementing IDs', () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      const task3 = taskList.appendTask('Task 3');
      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
      expect(task3.id).toBe(3);
    });

    it('should add task to end of list', () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      const tasks = taskList.listTasks();
      expect(tasks[0].description).toBe('Task 1');
      expect(tasks[1].description).toBe('Task 2');
    });

    it('should handle empty description', () => {
      const task = taskList.appendTask('');
      expect(task.description).toBe('');
      expect(task.id).toBe(1);
    });

    it('should handle long description', () => {
      const longDesc = 'A'.repeat(1000);
      const task = taskList.appendTask(longDesc);
      expect(task.description).toBe(longDesc);
    });
  });

  describe('prependTask', () => {
    it('should prepend task to empty list', () => {
      const task = taskList.prependTask('First task');
      expect(task.id).toBe(1);
      expect(task.description).toBe('First task');
      expect(task.status).toBe(TaskStatus.Pending);
    });

    it('should prepend task to beginning of list', () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      const task = taskList.prependTask('New first');
      const tasks = taskList.listTasks();
      expect(tasks[0].id).toBe(task.id);
      expect(tasks[0].description).toBe('New first');
    });

    it('should assign unique IDs when prepending', () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.prependTask('Task 2');
      expect(task1.id).toBe(1);
      expect(task2.id).toBe(2);
    });

    it('should handle multiple prepends', () => {
      taskList.prependTask('Third');
      taskList.prependTask('Second');
      taskList.prependTask('First');
      const tasks = taskList.listTasks();
      expect(tasks[0].description).toBe('First');
      expect(tasks[1].description).toBe('Second');
      expect(tasks[2].description).toBe('Third');
    });
  });

  describe('insertTaskAfter', () => {
    it('should insert task after specified task', () => {
      const task1 = taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      const inserted = taskList.insertTaskAfter(task1.id, 'Inserted');
      const tasks = taskList.listTasks();
      expect(tasks[0].description).toBe('Task 1');
      expect(tasks[1].id).toBe(inserted.id);
      expect(tasks[1].description).toBe('Inserted');
      expect(tasks[2].description).toBe('Task 2');
    });

    it('should insert at end when inserting after last task', () => {
      taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      const inserted = taskList.insertTaskAfter(task2.id, 'Last');
      const tasks = taskList.listTasks();
      expect(tasks[2].id).toBe(inserted.id);
      expect(tasks[2].description).toBe('Last');
    });

    it('should throw error when task ID not found', () => {
      taskList.appendTask('Task 1');
      expect(() => taskList.insertTaskAfter(999, 'New task')).toThrow(ValidationError);
      expect(() => taskList.insertTaskAfter(999, 'New task')).toThrow(
        "No task with ID '999' exists"
      );
    });

    it('should assign unique ID to inserted task', () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      const inserted = taskList.insertTaskAfter(task1.id, 'Inserted');
      expect(inserted.id).not.toBe(task1.id);
      expect(inserted.id).not.toBe(task2.id);
      expect(inserted.id).toBe(3);
    });

    it('should throw error for empty list', () => {
      expect(() => taskList.insertTaskAfter(1, 'Task')).toThrow(ValidationError);
    });
  });

  describe('startTask', () => {
    it('should change task status from Pending to InProgress', () => {
      const task = taskList.appendTask('Task 1');
      const started = taskList.startTask(task.id);
      expect(started.status).toBe(TaskStatus.InProgress);
      expect(started.id).toBe(task.id);
      expect(started.description).toBe('Task 1');
    });

    it('should throw error when task not found', () => {
      expect(() => taskList.startTask(999)).toThrow(ValidationError);
      expect(() => taskList.startTask(999)).toThrow("No task with ID '999' exists");
    });

    it('should throw error when task is already InProgress', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      expect(() => taskList.startTask(task.id)).toThrow(ValidationError);
      expect(() => taskList.startTask(task.id)).toThrow('not in PENDING status');
    });

    it('should throw error when task is already Completed', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      taskList.completeTask(task.id);
      expect(() => taskList.startTask(task.id)).toThrow(ValidationError);
      expect(() => taskList.startTask(task.id)).toThrow('not in PENDING status');
    });

    it('should update task in list', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.InProgress);
    });
  });

  describe('completeTask', () => {
    it('should change task status from InProgress to Completed', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      const completed = taskList.completeTask(task.id);
      expect(completed.status).toBe(TaskStatus.Completed);
      expect(completed.id).toBe(task.id);
      expect(completed.description).toBe('Task 1');
    });

    it('should throw error when task not found', () => {
      expect(() => taskList.completeTask(999)).toThrow(ValidationError);
      expect(() => taskList.completeTask(999)).toThrow("No task with ID '999' exists");
    });

    it('should throw error when task is Pending', () => {
      const task = taskList.appendTask('Task 1');
      expect(() => taskList.completeTask(task.id)).toThrow(ValidationError);
      expect(() => taskList.completeTask(task.id)).toThrow('not in IN_PROGRESS status');
    });

    it('should throw error when task is already Completed', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      taskList.completeTask(task.id);
      expect(() => taskList.completeTask(task.id)).toThrow(ValidationError);
      expect(() => taskList.completeTask(task.id)).toThrow('not in IN_PROGRESS status');
    });

    it('should update task in list', () => {
      const task = taskList.appendTask('Task 1');
      taskList.startTask(task.id);
      taskList.completeTask(task.id);
      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.Completed);
    });
  });

  describe('listTasks', () => {
    it('should return empty array for empty list', () => {
      const tasks = taskList.listTasks();
      expect(tasks).toEqual([]);
      expect(tasks).toHaveLength(0);
    });

    it('should return all tasks', () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      taskList.appendTask('Task 3');
      const tasks = taskList.listTasks();
      expect(tasks).toHaveLength(3);
    });

    it('should return copy of tasks, not original array', () => {
      taskList.appendTask('Task 1');
      const tasks1 = taskList.listTasks();
      taskList.appendTask('Task 2');
      const tasks2 = taskList.listTasks();
      expect(tasks1).toHaveLength(1);
      expect(tasks2).toHaveLength(2);
    });

    it('should include tasks with all statuses', () => {
      taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      const task3 = taskList.appendTask('Task 3');
      taskList.startTask(task2.id);
      taskList.startTask(task3.id);
      taskList.completeTask(task3.id);

      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.Pending);
      expect(tasks[1].status).toBe(TaskStatus.InProgress);
      expect(tasks[2].status).toBe(TaskStatus.Completed);
    });
  });

  describe('clearTasks', () => {
    it('should clear all tasks from empty list', () => {
      const count = taskList.clearTasks();
      expect(count).toBe(0);
      expect(taskList.listTasks()).toHaveLength(0);
    });

    it('should clear all tasks and return count', () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      taskList.appendTask('Task 3');
      const count = taskList.clearTasks();
      expect(count).toBe(3);
      expect(taskList.listTasks()).toHaveLength(0);
    });

    it('should reset task list to empty', () => {
      taskList.appendTask('Task 1');
      taskList.clearTasks();
      expect(taskList.listTasks()).toEqual([]);
    });

    it('should not reset ID counter', () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      taskList.clearTasks();
      const newTask = taskList.appendTask('Task 3');
      expect(newTask.id).toBe(3);
    });

    it('should clear tasks with various statuses', () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      taskList.startTask(task1.id);
      taskList.startTask(task2.id);
      taskList.completeTask(task2.id);

      const count = taskList.clearTasks();
      expect(count).toBe(2);
      expect(taskList.listTasks()).toHaveLength(0);
    });
  });

  describe('task workflow', () => {
    it('should support complete task lifecycle', () => {
      const task = taskList.appendTask('Complete a task');
      expect(task.status).toBe(TaskStatus.Pending);

      taskList.startTask(task.id);
      const inProgress = taskList.listTasks()[0];
      expect(inProgress.status).toBe(TaskStatus.InProgress);

      taskList.completeTask(task.id);
      const completed = taskList.listTasks()[0];
      expect(completed.status).toBe(TaskStatus.Completed);
    });

    it('should handle multiple concurrent tasks', () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      taskList.appendTask('Task 3');

      taskList.startTask(task1.id);
      taskList.startTask(task2.id);
      taskList.completeTask(task1.id);

      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.Completed);
      expect(tasks[1].status).toBe(TaskStatus.InProgress);
      expect(tasks[2].status).toBe(TaskStatus.Pending);
    });

    it('should maintain task order through operations', () => {
      taskList.appendTask('First');
      taskList.appendTask('Second');
      taskList.appendTask('Third');

      const tasks = taskList.listTasks();
      expect(tasks[0].description).toBe('First');
      expect(tasks[1].description).toBe('Second');
      expect(tasks[2].description).toBe('Third');
    });
  });
});
