/**
 * Tests for OpenAI Messages Adapter
 */

import { adaptMessagesToOpenAI } from './openai-messages-adapter';
import { Message, MessageRole } from '../models';

describe('adaptMessagesToOpenAI', () => {
  describe('tool role messages (Bug #1)', () => {
    it('should include tool messages that use tool_call_id', () => {
      const messages = [Message.tool('result-payload', 'call_abc123', 'get_weather')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_abc123',
        content: 'result-payload',
      });
    });

    it('should correctly map tool_call_id from singular field on LlmMessage', () => {
      const message = Message.tool('{"temperature":22}', 'call_xyz789', 'get_forecast');

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0].tool_call_id).toBe('call_xyz789');
      expect(result[0].role).toBe('tool');
      expect(result[0].content).toBe('{"temperature":22}');
    });
  });

  describe('assistant role with tool_calls (Bug #2)', () => {
    it('should pass through arguments verbatim without double-serializing', () => {
      const messages = [
        {
          role: MessageRole.Assistant,
          content: '',
          tool_calls: [
            {
              id: 'call_abc123',
              type: 'function' as const,
              function: {
                name: 'get_weather',
                arguments: '{"x":1}',
              },
            },
          ],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      const toolCalls = result[0].tool_calls;
      if (!toolCalls) throw new Error('expected tool_calls to be defined');
      expect(toolCalls[0].function.arguments).toBe('{"x":1}');
    });

    it('should not double-serialize complex argument objects', () => {
      const originalArgs = '{"location":"Paris","unit":"celsius"}';
      const messages = [
        {
          role: MessageRole.Assistant,
          content: '',
          tool_calls: [
            {
              id: 'call_def456',
              type: 'function' as const,
              function: {
                name: 'get_weather',
                arguments: originalArgs,
              },
            },
          ],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      const toolCalls = result[0].tool_calls;
      if (!toolCalls) throw new Error('expected tool_calls to be defined');
      expect(toolCalls[0].function.arguments).toBe(originalArgs);
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({
        location: 'Paris',
        unit: 'celsius',
      });
    });
  });

  describe('system role messages', () => {
    it('should adapt system messages', () => {
      const messages = [Message.system('You are a helpful assistant.')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    });
  });

  describe('user role messages', () => {
    it('should adapt user messages', () => {
      const messages = [Message.user('Hello!')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello!' });
    });
  });
});
