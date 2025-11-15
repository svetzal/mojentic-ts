/**
 * Tests for ephemeral task manager tools
 */

import { TaskList } from './task-list';
import { TaskStatus } from './task';
import { AppendTaskTool } from './append-task';
import { PrependTaskTool } from './prepend-task';
import { InsertTaskAfterTool } from './insert-task-after';
import { StartTaskTool } from './start-task';
import { CompleteTaskTool } from './complete-task';
import { ListTasksTool } from './list-tasks';
import { ClearTasksTool } from './clear-tasks';

describe('AppendTaskTool', () => {
  let taskList: TaskList;
  let tool: AppendTaskTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new AppendTaskTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('append_task');
      expect(descriptor.function.description).toContain('Append');
    });

    it('should have required description parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('description');
    });
  });

  describe('run', () => {
    it('should append task successfully', async () => {
      const result = await tool.run({ description: 'Test task' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.id).toBe(1);
        expect(value.description).toBe('Test task');
        expect(value.status).toBe(TaskStatus.Pending);
        expect(value.summary).toContain('appended successfully');
      }
    });

    it('should append multiple tasks with incrementing IDs', async () => {
      await tool.run({ description: 'Task 1' });
      const result = await tool.run({ description: 'Task 2' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.id).toBe(2);
      }
    });

    it('should handle empty description', async () => {
      const result = await tool.run({ description: '' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.description).toBe('');
      }
    });

    it('should handle missing description parameter', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.description).toBe('');
      }
    });

    it('should handle exceptions gracefully', async () => {
      // Force an error by using a mock that throws
      const mockTaskList = {
        appendTask: () => {
          throw new Error('Test error');
        },
      } as unknown as TaskList;
      const errorTool = new AppendTaskTool(mockTaskList);

      const result = await errorTool.run({ description: 'Test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBe('Test error');
        expect(value.summary).toContain('Failed to append task');
      }
    });
  });
});

describe('PrependTaskTool', () => {
  let taskList: TaskList;
  let tool: PrependTaskTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new PrependTaskTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('prepend_task');
      expect(descriptor.function.description).toContain('Prepend');
    });

    it('should have required description parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('description');
    });
  });

  describe('run', () => {
    it('should prepend task successfully', async () => {
      const result = await tool.run({ description: 'Test task' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.id).toBe(1);
        expect(value.description).toBe('Test task');
        expect(value.status).toBe(TaskStatus.Pending);
        expect(value.summary).toContain('prepended successfully');
      }
    });

    it('should prepend to beginning of list', async () => {
      taskList.appendTask('First');
      const result = await tool.run({ description: 'New first' });
      expect(result.ok).toBe(true);

      const tasks = taskList.listTasks();
      expect(tasks[0].description).toBe('New first');
    });

    it('should handle empty description', async () => {
      const result = await tool.run({ description: '' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.description).toBe('');
      }
    });

    it('should handle exceptions gracefully', async () => {
      const mockTaskList = {
        prependTask: () => {
          throw new Error('Test error');
        },
      } as unknown as TaskList;
      const errorTool = new PrependTaskTool(mockTaskList);

      const result = await errorTool.run({ description: 'Test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBe('Test error');
        expect(value.summary).toContain('Failed to prepend task');
      }
    });
  });
});

describe('InsertTaskAfterTool', () => {
  let taskList: TaskList;
  let tool: InsertTaskAfterTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new InsertTaskAfterTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('insert_task_after');
      expect(descriptor.function.description).toContain('Insert');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('existing_task_id');
      expect(descriptor.function.parameters.required).toContain('description');
    });
  });

  describe('run', () => {
    it('should insert task after existing task', async () => {
      const task1 = taskList.appendTask('Task 1');
      const result = await tool.run({ existing_task_id: task1.id, description: 'Inserted' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.description).toBe('Inserted');
        expect(value.status).toBe(TaskStatus.Pending);
        expect(value.summary).toContain('inserted after');
      }
    });

    it('should insert at correct position', async () => {
      const task1 = taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      await tool.run({ existing_task_id: task1.id, description: 'Inserted' });

      const tasks = taskList.listTasks();
      expect(tasks[1].description).toBe('Inserted');
    });

    it('should handle nonexistent task ID', async () => {
      const result = await tool.run({ existing_task_id: 999, description: 'Test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
        expect(value.summary).toContain('Failed to insert task');
      }
    });

    it('should handle missing existing_task_id parameter', async () => {
      const result = await tool.run({ description: 'Test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
      }
    });

    it('should handle empty description', async () => {
      const task1 = taskList.appendTask('Task 1');
      const result = await tool.run({ existing_task_id: task1.id, description: '' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.description).toBe('');
      }
    });
  });
});

describe('StartTaskTool', () => {
  let taskList: TaskList;
  let tool: StartTaskTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new StartTaskTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('start_task');
      expect(descriptor.function.description).toContain('Start');
    });

    it('should have required id parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('id');
    });
  });

  describe('run', () => {
    it('should start task successfully', async () => {
      const task = taskList.appendTask('Test task');
      const result = await tool.run({ id: task.id });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.id).toBe(task.id);
        expect(value.status).toBe(TaskStatus.InProgress);
        expect(value.summary).toContain('started successfully');
      }
    });

    it('should change task status from Pending to InProgress', async () => {
      const task = taskList.appendTask('Test task');
      await tool.run({ id: task.id });

      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.InProgress);
    });

    it('should handle nonexistent task ID', async () => {
      const result = await tool.run({ id: 999 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
        expect(value.summary).toContain('Failed to start task');
      }
    });

    it('should handle already started task', async () => {
      const task = taskList.appendTask('Test task');
      taskList.startTask(task.id);
      const result = await tool.run({ id: task.id });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
        expect(value.summary).toContain('Failed to start task');
      }
    });

    it('should handle missing id parameter', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
      }
    });
  });
});

describe('CompleteTaskTool', () => {
  let taskList: TaskList;
  let tool: CompleteTaskTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new CompleteTaskTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('complete_task');
      expect(descriptor.function.description).toContain('Complete');
    });

    it('should have required id parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('id');
    });
  });

  describe('run', () => {
    it('should complete task successfully', async () => {
      const task = taskList.appendTask('Test task');
      taskList.startTask(task.id);
      const result = await tool.run({ id: task.id });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.id).toBe(task.id);
        expect(value.status).toBe(TaskStatus.Completed);
        expect(value.summary).toContain('completed successfully');
      }
    });

    it('should change task status from InProgress to Completed', async () => {
      const task = taskList.appendTask('Test task');
      taskList.startTask(task.id);
      await tool.run({ id: task.id });

      const tasks = taskList.listTasks();
      expect(tasks[0].status).toBe(TaskStatus.Completed);
    });

    it('should handle nonexistent task ID', async () => {
      const result = await tool.run({ id: 999 });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
        expect(value.summary).toContain('Failed to complete task');
      }
    });

    it('should handle pending task (not started)', async () => {
      const task = taskList.appendTask('Test task');
      const result = await tool.run({ id: task.id });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
        expect(value.summary).toContain('Failed to complete task');
      }
    });

    it('should handle missing id parameter', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.error).toBeDefined();
      }
    });
  });
});

describe('ListTasksTool', () => {
  let taskList: TaskList;
  let tool: ListTasksTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new ListTasksTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('list_tasks');
      expect(descriptor.function.description).toContain('List');
    });

    it('should have no required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required || []).toHaveLength(0);
    });
  });

  describe('run', () => {
    it('should list empty task list', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.count).toBe(0);
        expect(value.tasks).toContain('No tasks found');
      }
    });

    it('should list all tasks', async () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      taskList.appendTask('Task 3');

      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.count).toBe(3);
        expect(value.tasks).toContain('Task 1');
        expect(value.tasks).toContain('Task 2');
        expect(value.tasks).toContain('Task 3');
      }
    });

    it('should show task IDs and statuses', async () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      taskList.startTask(task1.id);
      taskList.startTask(task2.id);
      taskList.completeTask(task2.id);

      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.tasks).toContain('1.');
        expect(value.tasks).toContain('2.');
        expect(value.tasks).toContain(TaskStatus.InProgress);
        expect(value.tasks).toContain(TaskStatus.Completed);
      }
    });

    it('should include formatted summary', async () => {
      taskList.appendTask('Task 1');
      const result = await tool.run({});

      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.summary).toContain('Found 1 tasks');
      }
    });
  });
});

describe('ClearTasksTool', () => {
  let taskList: TaskList;
  let tool: ClearTasksTool;

  beforeEach(() => {
    taskList = new TaskList();
    tool = new ClearTasksTool(taskList);
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('clear_tasks');
      expect(descriptor.function.description).toContain('Remove');
    });

    it('should have no required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required || []).toHaveLength(0);
    });
  });

  describe('run', () => {
    it('should clear empty task list', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.count).toBe(0);
        expect(value.summary).toContain('Cleared 0 tasks');
      }
    });

    it('should clear all tasks', async () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');
      taskList.appendTask('Task 3');

      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.count).toBe(3);
      }

      expect(taskList.listTasks()).toHaveLength(0);
    });

    it('should clear tasks with various statuses', async () => {
      const task1 = taskList.appendTask('Task 1');
      const task2 = taskList.appendTask('Task 2');
      taskList.startTask(task1.id);
      taskList.startTask(task2.id);
      taskList.completeTask(task2.id);

      const result = await tool.run({});
      expect(result.ok).toBe(true);
      expect(taskList.listTasks()).toHaveLength(0);
    });

    it('should return count of cleared tasks', async () => {
      taskList.appendTask('Task 1');
      taskList.appendTask('Task 2');

      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.count).toBe(2);
        expect(value.summary).toContain('Cleared 2 tasks');
      }
    });
  });
});
