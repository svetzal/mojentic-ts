/**
 * Tests for SharedWorkingMemory
 */

import { SharedWorkingMemory } from '../shared-working-memory';

describe('SharedWorkingMemory', () => {
  describe('constructor', () => {
    it('should initialize with empty object by default', () => {
      const memory = new SharedWorkingMemory();
      expect(memory.getWorkingMemory()).toEqual({});
    });

    it('should initialize with provided object', () => {
      const initial = { user: { name: 'Alice', age: 30 } };
      const memory = new SharedWorkingMemory(initial);
      expect(memory.getWorkingMemory()).toEqual(initial);
    });

    it('should not share reference to initial object', () => {
      const initial = { value: 42 };
      const memory = new SharedWorkingMemory(initial);
      initial.value = 100;
      expect(memory.getWorkingMemory()).toEqual({ value: 42 });
    });
  });

  describe('getWorkingMemory', () => {
    it('should return a copy of current memory', () => {
      const memory = new SharedWorkingMemory({ foo: 'bar' });
      const retrieved = memory.getWorkingMemory();
      retrieved.foo = 'modified';
      expect(memory.getWorkingMemory()).toEqual({ foo: 'bar' });
    });

    it('should return current state after updates', () => {
      const memory = new SharedWorkingMemory({ count: 1 });
      memory.mergeToWorkingMemory({ count: 2 });
      expect(memory.getWorkingMemory()).toEqual({ count: 2 });
    });
  });

  describe('mergeToWorkingMemory', () => {
    it('should add new keys to memory', () => {
      const memory = new SharedWorkingMemory({ a: 1 });
      memory.mergeToWorkingMemory({ b: 2 });
      expect(memory.getWorkingMemory()).toEqual({ a: 1, b: 2 });
    });

    it('should replace existing primitive values', () => {
      const memory = new SharedWorkingMemory({ value: 'old' });
      memory.mergeToWorkingMemory({ value: 'new' });
      expect(memory.getWorkingMemory()).toEqual({ value: 'new' });
    });

    it('should replace arrays', () => {
      const memory = new SharedWorkingMemory({ items: [1, 2, 3] });
      memory.mergeToWorkingMemory({ items: [4, 5] });
      expect(memory.getWorkingMemory()).toEqual({ items: [4, 5] });
    });

    it('should deep merge nested objects', () => {
      const memory = new SharedWorkingMemory({
        user: {
          name: 'Alice',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
      });

      memory.mergeToWorkingMemory({
        user: {
          preferences: {
            language: 'fr',
            notifications: true,
          },
        },
      });

      expect(memory.getWorkingMemory()).toEqual({
        user: {
          name: 'Alice',
          preferences: {
            theme: 'dark',
            language: 'fr',
            notifications: true,
          },
        },
      });
    });

    it('should handle multiple levels of nesting', () => {
      const memory = new SharedWorkingMemory({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      });

      memory.mergeToWorkingMemory({
        level1: {
          level2: {
            level3: {
              newValue: 'added',
            },
          },
        },
      });

      expect(memory.getWorkingMemory()).toEqual({
        level1: {
          level2: {
            level3: {
              value: 'deep',
              newValue: 'added',
            },
          },
        },
      });
    });

    it('should replace null values', () => {
      const memory = new SharedWorkingMemory({ value: null });
      memory.mergeToWorkingMemory({ value: 'not null' });
      expect(memory.getWorkingMemory()).toEqual({ value: 'not null' });
    });

    it('should handle setting values to null', () => {
      const memory = new SharedWorkingMemory({ value: 'something' });
      memory.mergeToWorkingMemory({ value: null });
      expect(memory.getWorkingMemory()).toEqual({ value: null });
    });

    it('should not merge into arrays', () => {
      const memory = new SharedWorkingMemory({ items: [{ id: 1 }, { id: 2 }] });
      memory.mergeToWorkingMemory({ items: [{ id: 3 }] });
      expect(memory.getWorkingMemory()).toEqual({ items: [{ id: 3 }] });
    });

    it('should handle empty merge object', () => {
      const memory = new SharedWorkingMemory({ value: 42 });
      memory.mergeToWorkingMemory({});
      expect(memory.getWorkingMemory()).toEqual({ value: 42 });
    });

    it('should handle complex real-world scenario', () => {
      const memory = new SharedWorkingMemory({
        user: {
          name: 'Bob',
          age: 25,
          address: {
            city: 'New York',
            zip: '10001',
          },
        },
        settings: {
          notifications: true,
        },
      });

      // Add phone number
      memory.mergeToWorkingMemory({
        user: {
          phone: '555-1234',
        },
      });

      // Update city and add state
      memory.mergeToWorkingMemory({
        user: {
          address: {
            city: 'Boston',
            state: 'MA',
          },
        },
      });

      // Add new top-level key
      memory.mergeToWorkingMemory({
        lastLogin: '2025-11-25',
      });

      expect(memory.getWorkingMemory()).toEqual({
        user: {
          name: 'Bob',
          age: 25,
          phone: '555-1234',
          address: {
            city: 'Boston',
            zip: '10001',
            state: 'MA',
          },
        },
        settings: {
          notifications: true,
        },
        lastLogin: '2025-11-25',
      });
    });
  });
});
