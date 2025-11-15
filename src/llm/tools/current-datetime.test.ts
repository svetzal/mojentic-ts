/**
 * Tests for CurrentDatetimeTool
 */

import { CurrentDatetimeTool } from './current-datetime';
import { isOk } from '../../error';

describe('CurrentDatetimeTool', () => {
  let tool: CurrentDatetimeTool;

  beforeEach(() => {
    tool = new CurrentDatetimeTool();
  });

  describe('descriptor', () => {
    it('returns valid tool descriptor', () => {
      const descriptor = tool.descriptor();

      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('get_current_datetime');
      expect(descriptor.function.description).toContain('current date and time');
      expect(descriptor.function.parameters.type).toBe('object');
      expect(descriptor.function.parameters.properties).toHaveProperty('format_string');
      expect(descriptor.function.parameters.required).toEqual([]);
    });
  });

  describe('run', () => {
    it('returns current datetime with default format', async () => {
      const result = await tool.run({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        expect(typeof value.current_datetime).toBe('string');
        expect(typeof value.timestamp).toBe('number');
        expect(typeof value.timezone).toBe('string');

        // Default format is "%Y-%m-%d %H:%M:%S"
        expect(value.current_datetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      }
    });

    it('returns current datetime with custom format', async () => {
      const result = await tool.run({ format_string: '%Y-%m-%d' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        expect(value.current_datetime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect((value.current_datetime as string).includes(':')).toBe(false);
      }
    });

    it('returns timestamp as unix epoch', async () => {
      const result = await tool.run({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        const timestamp = value.timestamp as number;

        // Timestamp should be reasonable (after 2020, before 2030)
        expect(timestamp).toBeGreaterThan(1_577_836_800);
        expect(timestamp).toBeLessThan(1_893_456_000);
      }
    });

    it('returns timezone information', async () => {
      const result = await tool.run({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        const timezone = value.timezone as string;
        expect(timezone).toBeTruthy();
        expect(timezone.length).toBeGreaterThan(0);
      }
    });

    it('handles format with day name', async () => {
      const result = await tool.run({ format_string: '%A' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        const dayName = value.current_datetime as string;

        const validDays = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ];
        expect(validDays).toContain(dayName);
      }
    });

    it('handles format with month name', async () => {
      const result = await tool.run({ format_string: '%B' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        const monthName = value.current_datetime as string;

        const validMonths = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        expect(validMonths).toContain(monthName);
      }
    });

    it('handles format with year only', async () => {
      const result = await tool.run({ format_string: '%Y' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        expect(value.current_datetime).toMatch(/^\d{4}$/);
      }
    });

    it('handles format with 12-hour time', async () => {
      const result = await tool.run({ format_string: '%I:%M %p' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        expect(value.current_datetime).toMatch(/^\d{2}:\d{2} (AM|PM)$/);
      }
    });

    it('result includes all required fields', async () => {
      const result = await tool.run({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const value = result.value as Record<string, unknown>;
        expect(value).toHaveProperty('current_datetime');
        expect(value).toHaveProperty('timestamp');
        expect(value).toHaveProperty('timezone');
      }
    });
  });

  describe('name', () => {
    it('returns correct tool name', () => {
      expect(tool.name()).toBe('get_current_datetime');
    });
  });
});
