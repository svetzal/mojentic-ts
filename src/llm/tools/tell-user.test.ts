/**
 * Tests for TellUserTool
 */

import { TellUserTool } from './tell-user';
import { isOk } from '../../error';

describe('TellUserTool', () => {
  let tool: TellUserTool;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    tool = new TellUserTool();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('descriptor', () => {
    it('returns correct tool descriptor', () => {
      const descriptor = tool.descriptor();

      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('tell_user');
      expect(descriptor.function.description).toContain(
        'Display a message to the user without expecting a response'
      );

      // Check parameters structure
      expect(descriptor.function.parameters.type).toBe('object');
      expect(descriptor.function.parameters.properties).toHaveProperty('message');
      if (descriptor.function.parameters.properties) {
        expect(descriptor.function.parameters.properties.message.type).toBe('string');
      }
      expect(descriptor.function.parameters.required).toContain('message');
    });
  });

  describe('run', () => {
    it('displays message and returns success', async () => {
      const result = await tool.run({ message: 'Test message' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('Message delivered to user.');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE FROM ASSISTANT:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('handles empty message', async () => {
      const result = await tool.run({});

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('Message delivered to user.');
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE FROM ASSISTANT:')
      );
    });

    it('handles multiline messages', async () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';
      const result = await tool.run({ message: multilineMessage });

      expect(isOk(result)).toBe(true);

      const logCall = consoleLogSpy.mock.calls[0][0];
      expect(logCall).toContain('MESSAGE FROM ASSISTANT:');
      expect(logCall).toContain('Line 1');
      expect(logCall).toContain('Line 2');
      expect(logCall).toContain('Line 3');
    });

    it('handles special characters in message', async () => {
      const specialMessage = 'Special chars: @#$%^&*()';
      const result = await tool.run({ message: specialMessage });

      expect(isOk(result)).toBe(true);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(specialMessage));
    });

    it('handles long messages', async () => {
      const longMessage = 'This is a long message. '.repeat(50);
      const result = await tool.run({ message: longMessage });

      expect(isOk(result)).toBe(true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('MESSAGE FROM ASSISTANT:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('This is a long message.')
      );
    });

    it('handles unicode characters', async () => {
      const unicodeMessage = 'Unicode: 你好 👋 café';
      const result = await tool.run({ message: unicodeMessage });

      expect(isOk(result)).toBe(true);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(unicodeMessage));
    });
  });
});
