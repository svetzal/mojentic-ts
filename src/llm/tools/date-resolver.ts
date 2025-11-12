/**
 * Date resolver tool - resolves relative date references like "next Friday"
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Result, ToolError } from '../../error';

/**
 * Tool that resolves relative date references
 */
export class DateResolverTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const dateStr = args.date_string as string;
      if (!dateStr) {
        return Ok({ error: 'date_string is required' });
      }

      const resolvedDate = this.resolveDate(dateStr);
      return Ok({
        original: dateStr,
        resolved: resolvedDate.toISOString().split('T')[0],
        day_of_week: resolvedDate.toLocaleDateString('en-US', { weekday: 'long' }),
        formatted: resolvedDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      });
    } catch (error) {
      throw new ToolError(
        `Failed to resolve date: ${error instanceof Error ? error.message : String(error)}`,
        'DateResolverTool'
      );
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'resolve_date',
        description:
          'Resolves relative date references like "next Friday", "tomorrow", "in 2 weeks" to actual dates',
        parameters: {
          type: 'object',
          properties: {
            date_string: {
              type: 'string',
              description: 'The relative date string to resolve (e.g., "next Friday", "tomorrow")',
            },
          },
          required: ['date_string'],
        },
      },
    };
  }

  private resolveDate(dateStr: string): Date {
    const now = new Date();
    const lower = dateStr.toLowerCase();

    // Handle "today"
    if (lower === 'today') {
      return now;
    }

    // Handle "tomorrow"
    if (lower === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    // Handle "yesterday"
    if (lower === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Handle "next <weekday>"
    const nextMatch = lower.match(/^next\s+(\w+)$/);
    if (nextMatch) {
      const targetDay = this.getWeekdayNumber(nextMatch[1]);
      if (targetDay !== -1) {
        return this.getNextWeekday(now, targetDay);
      }
    }

    // Handle "last <weekday>"
    const lastMatch = lower.match(/^last\s+(\w+)$/);
    if (lastMatch) {
      const targetDay = this.getWeekdayNumber(lastMatch[1]);
      if (targetDay !== -1) {
        return this.getLastWeekday(now, targetDay);
      }
    }

    // Handle "in X days/weeks/months"
    const inMatch = lower.match(/^in\s+(\d+)\s+(day|week|month)s?$/);
    if (inMatch) {
      const amount = parseInt(inMatch[1], 10);
      const unit = inMatch[2];
      const result = new Date(now);

      if (unit === 'day') {
        result.setDate(result.getDate() + amount);
      } else if (unit === 'week') {
        result.setDate(result.getDate() + amount * 7);
      } else if (unit === 'month') {
        result.setMonth(result.getMonth() + amount);
      }

      return result;
    }

    // If we can't parse it, return the current date
    return now;
  }

  private getWeekdayNumber(weekday: string): number {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days.indexOf(weekday.toLowerCase());
  }

  private getNextWeekday(from: Date, targetDay: number): Date {
    const result = new Date(from);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;

    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  private getLastWeekday(from: Date, targetDay: number): Date {
    const result = new Date(from);
    const currentDay = result.getDay();
    let daysToSubtract = currentDay - targetDay;

    if (daysToSubtract <= 0) {
      daysToSubtract += 7;
    }

    result.setDate(result.getDate() - daysToSubtract);
    return result;
  }
}
