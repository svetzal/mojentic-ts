/**
 * Tests for Message helpers
 */

import { Message, MessageRole } from './models';

describe('Message helpers', () => {
  test('system should create system message', () => {
    const msg = Message.system('You are a helpful assistant');
    expect(msg.role).toBe(MessageRole.System);
    expect(msg.content).toBe('You are a helpful assistant');
  });

  test('user should create user message', () => {
    const msg = Message.user('Hello, world!');
    expect(msg.role).toBe(MessageRole.User);
    expect(msg.content).toBe('Hello, world!');
  });

  test('assistant should create assistant message', () => {
    const msg = Message.assistant('Hello! How can I help?');
    expect(msg.role).toBe(MessageRole.Assistant);
    expect(msg.content).toBe('Hello! How can I help?');
  });

  test('assistant should handle tool calls', () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'test_tool',
          arguments: '{}',
        },
      },
    ];
    const msg = Message.assistant('', toolCalls);
    expect(msg.role).toBe(MessageRole.Assistant);
    expect(msg.tool_calls).toEqual(toolCalls);
  });

  test('tool should create tool message', () => {
    const msg = Message.tool('{"result": "success"}', 'call_1', 'test_tool');
    expect(msg.role).toBe(MessageRole.Tool);
    expect(msg.content).toBe('{"result": "success"}');
    expect(msg.tool_call_id).toBe('call_1');
    expect(msg.name).toBe('test_tool');
  });
});
