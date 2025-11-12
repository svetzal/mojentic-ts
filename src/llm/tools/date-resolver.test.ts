/**
 * Tests for DateResolverTool
 */

import { DateResolverTool } from './date-resolver';

describe('DateResolverTool', () => {
  let tool: DateResolverTool;

  beforeEach(() => {
    tool = new DateResolverTool();
    // Mock the current date to make tests predictable
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-15T12:00:00Z')); // Saturday, March 15, 2025
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('resolve_date');
      expect(descriptor.function.description).toContain('relative date');
    });

    it('should have required parameters', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.required).toContain('date_string');
    });

    it('should describe date_string parameter', () => {
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.properties?.date_string).toBeDefined();
      expect(descriptor.function.parameters.properties?.date_string.type).toBe('string');
    });
  });

  describe('name', () => {
    it('should return tool name', () => {
      expect(tool.name()).toBe('resolve_date');
    });
  });

  describe('run', () => {
    it('should handle missing date_string', async () => {
      const result = await tool.run({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ error: 'date_string is required' });
      }
    });

    it('should resolve "today"', async () => {
      const result = await tool.run({ date_string: 'today' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.original).toBe('today');
        expect(value.resolved).toBe('2025-03-15');
        expect(value.day_of_week).toBe('Saturday');
      }
    });

    it('should resolve "tomorrow"', async () => {
      const result = await tool.run({ date_string: 'tomorrow' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.original).toBe('tomorrow');
        expect(value.resolved).toBe('2025-03-16');
        expect(value.day_of_week).toBe('Sunday');
      }
    });

    it('should resolve "yesterday"', async () => {
      const result = await tool.run({ date_string: 'yesterday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.original).toBe('yesterday');
        expect(value.resolved).toBe('2025-03-14');
        expect(value.day_of_week).toBe('Friday');
      }
    });

    it('should resolve "next Monday"', async () => {
      const result = await tool.run({ date_string: 'next Monday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-17');
        expect(value.day_of_week).toBe('Monday');
      }
    });

    it('should resolve "next Friday"', async () => {
      const result = await tool.run({ date_string: 'next Friday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-21');
        expect(value.day_of_week).toBe('Friday');
      }
    });

    it('should resolve "last Tuesday"', async () => {
      const result = await tool.run({ date_string: 'last Tuesday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-11');
        expect(value.day_of_week).toBe('Tuesday');
      }
    });

    it('should resolve "in 3 days"', async () => {
      const result = await tool.run({ date_string: 'in 3 days' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-18');
      }
    });

    it('should resolve "in 2 weeks"', async () => {
      const result = await tool.run({ date_string: 'in 2 weeks' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-29');
      }
    });

    it('should resolve "in 1 month"', async () => {
      const result = await tool.run({ date_string: 'in 1 month' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-04-15');
      }
    });

    it('should handle singular units "in 1 day"', async () => {
      const result = await tool.run({ date_string: 'in 1 day' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-16');
      }
    });

    it('should handle singular units "in 1 week"', async () => {
      const result = await tool.run({ date_string: 'in 1 week' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-22');
      }
    });

    it('should handle case insensitivity', async () => {
      const result = await tool.run({ date_string: 'TOMORROW' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-16');
      }
    });

    it('should include formatted date', async () => {
      const result = await tool.run({ date_string: 'today' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.formatted).toBe('March 15, 2025');
      }
    });

    it('should default to today for unparseable strings', async () => {
      const result = await tool.run({ date_string: 'invalid date string' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-15');
      }
    });

    it('should resolve "next Sunday"', async () => {
      const result = await tool.run({ date_string: 'next Sunday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-16');
        expect(value.day_of_week).toBe('Sunday');
      }
    });

    it('should resolve "last Saturday"', async () => {
      const result = await tool.run({ date_string: 'last Saturday' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-08');
        expect(value.day_of_week).toBe('Saturday');
      }
    });

    it('should resolve "in 10 days"', async () => {
      const result = await tool.run({ date_string: 'in 10 days' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const value = result.value as Record<string, unknown>;
        expect(value.resolved).toBe('2025-03-25');
      }
    });
  });
});
