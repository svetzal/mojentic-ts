/**
 * Current datetime tool - returns the current date and time
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Result } from '../../error';

/**
 * Tool that returns the current date and time
 */
export class CurrentDatetimeTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const formatString = (args.format_string as string) || '%Y-%m-%d %H:%M:%S';
    const now = new Date();

    // Convert Python strftime format to JavaScript Date format
    const formattedTime = this.formatDateTime(now, formatString);
    const timestamp = Math.floor(now.getTime() / 1000);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return Ok({
      current_datetime: formattedTime,
      timestamp: timestamp,
      timezone: timezone,
    });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'get_current_datetime',
        description:
          'Get the current date and time. Useful when you need to know the current time or date.',
        parameters: {
          type: 'object',
          properties: {
            format_string: {
              type: 'string',
              description:
                "Format string for the datetime (e.g., '%Y-%m-%d %H:%M:%S', '%A, %B %d, %Y'). Default is ISO format.",
            },
          },
          required: [],
        },
      },
    };
  }

  /**
   * Format a date using Python strftime-style format codes
   */
  private formatDateTime(date: Date, format: string): string {
    const pad = (n: number, width: number = 2): string => String(n).padStart(width, '0');

    const replacements: Record<string, string> = {
      '%Y': String(date.getFullYear()),
      '%y': String(date.getFullYear()).slice(-2),
      '%m': pad(date.getMonth() + 1),
      '%d': pad(date.getDate()),
      '%H': pad(date.getHours()),
      '%I': pad(date.getHours() % 12 || 12),
      '%M': pad(date.getMinutes()),
      '%S': pad(date.getSeconds()),
      '%p': date.getHours() >= 12 ? 'PM' : 'AM',
      '%A': date.toLocaleDateString('en-US', { weekday: 'long' }),
      '%a': date.toLocaleDateString('en-US', { weekday: 'short' }),
      '%B': date.toLocaleDateString('en-US', { month: 'long' }),
      '%b': date.toLocaleDateString('en-US', { month: 'short' }),
      '%w': String(date.getDay()),
      '%j': String(
        Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
      ),
    };

    let result = format;
    for (const [code, value] of Object.entries(replacements)) {
      // eslint-disable-next-line security/detect-non-literal-regexp -- Format codes are from controlled set
      result = result.replace(new RegExp(code, 'g'), value);
    }

    return result;
  }
}
