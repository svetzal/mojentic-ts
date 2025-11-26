/**
 * Tests for tracer events
 */

import { randomUUID } from 'crypto';
import {
  LLMCallTracerEvent,
  LLMResponseTracerEvent,
  ToolCallTracerEvent,
  AgentInteractionTracerEvent,
} from './tracerEvents';
import { Message } from '../llm/models';

describe('TracerEvent', () => {
  describe('base class', () => {
    it('should create event with timestamp and correlationId', () => {
      const now = Date.now();
      const correlationId = randomUUID();
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7, undefined, correlationId);

      expect(event.timestamp).toBeGreaterThanOrEqual(now);
      expect(event.correlationId).toBe(correlationId);
    });

    it('should generate correlationId if not provided', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);

      expect(event.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should include source if provided', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7, undefined, undefined, 'test-source');

      expect(event.source).toBe('test-source');
    });

    it('should provide printable summary with timestamp', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const summary = event.printableSummary();

      expect(summary).toContain('LLMCallTracerEvent');
      expect(summary).toContain('correlation_id');
      expect(summary).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
    });

    it('should allow setting timestamp in test environment', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const customTimestamp = 1234567890000;

      event.setTimestampForTesting(customTimestamp);

      expect(event.timestamp).toBe(customTimestamp);
    });

    it('should throw error when setting timestamp outside test environment', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const originalEnv = process.env.NODE_ENV;

      // Temporarily change environment
      process.env.NODE_ENV = 'production';

      expect(() => {
        event.setTimestampForTesting(1234567890000);
      }).toThrow('setTimestampForTesting can only be called in test environment');

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('LLMCallTracerEvent', () => {
    it('should store model, messages, and temperature', () => {
      const messages = [Message.user('Hello'), Message.assistant('Hi')];
      const event = new LLMCallTracerEvent('gpt-4', messages, 0.7);

      expect(event.model).toBe('gpt-4');
      expect(event.messages).toEqual(messages);
      expect(event.temperature).toBe(0.7);
    });

    it('should default temperature to 1.0', () => {
      const event = new LLMCallTracerEvent('gpt-4', []);

      expect(event.temperature).toBe(1.0);
    });

    it('should store tools if provided', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: {},
          },
        },
      ];
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7, tools);

      expect(event.tools).toEqual(tools);
    });

    it('should include model in summary', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const summary = event.printableSummary();

      expect(summary).toContain('Model: gpt-4');
    });

    it('should include message count in summary', () => {
      const messages = [Message.user('Hello'), Message.assistant('Hi')];
      const event = new LLMCallTracerEvent('gpt-4', messages, 0.7);
      const summary = event.printableSummary();

      expect(summary).toContain('Messages: 2 messages');
    });

    it('should use singular form for one message', () => {
      const event = new LLMCallTracerEvent('gpt-4', [Message.user('Hello')], 0.7);
      const summary = event.printableSummary();

      expect(summary).toContain('Messages: 1 message');
    });

    it('should include temperature if not default', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const summary = event.printableSummary();

      expect(summary).toContain('Temperature: 0.7');
    });

    it('should not include temperature if default', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 1.0);
      const summary = event.printableSummary();

      expect(summary).not.toContain('Temperature');
    });

    it('should include tool names in summary', () => {
      const tools = [
        {
          type: 'function',
          function: { name: 'tool1', description: '', parameters: {} },
        },
        {
          type: 'function',
          function: { name: 'tool2', description: '', parameters: {} },
        },
      ];
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7, tools);
      const summary = event.printableSummary();

      expect(summary).toContain('Available Tools: tool1, tool2');
    });
  });

  describe('LLMResponseTracerEvent', () => {
    it('should store model and content', () => {
      const event = new LLMResponseTracerEvent('gpt-4', 'Hello, how can I help?');

      expect(event.model).toBe('gpt-4');
      expect(event.content).toBe('Hello, how can I help?');
    });

    it('should store tool calls if provided', () => {
      const toolCalls = [
        {
          id: 'call1',
          type: 'function' as const,
          function: {
            name: 'test_tool',
            arguments: '{"arg": "value"}',
          },
        },
      ];
      const event = new LLMResponseTracerEvent('gpt-4', 'Using tool...', toolCalls);

      expect(event.toolCalls).toEqual(toolCalls);
    });

    it('should store call duration if provided', () => {
      const event = new LLMResponseTracerEvent('gpt-4', 'Response', undefined, 150.5);

      expect(event.callDurationMs).toBe(150.5);
    });

    it('should include model in summary', () => {
      const event = new LLMResponseTracerEvent('gpt-4', 'Response');
      const summary = event.printableSummary();

      expect(summary).toContain('Model: gpt-4');
    });

    it('should include content preview in summary', () => {
      const event = new LLMResponseTracerEvent('gpt-4', 'Short response');
      const summary = event.printableSummary();

      expect(summary).toContain('Content: Short response');
    });

    it('should truncate long content in summary', () => {
      const longContent = 'a'.repeat(150);
      const event = new LLMResponseTracerEvent('gpt-4', longContent);
      const summary = event.printableSummary();

      expect(summary).toContain('Content: ' + 'a'.repeat(100) + '...');
    });

    it('should include tool call count in summary', () => {
      const toolCalls = [
        {
          id: 'call1',
          type: 'function' as const,
          function: { name: 'tool1', arguments: '{}' },
        },
        {
          id: 'call2',
          type: 'function' as const,
          function: { name: 'tool2', arguments: '{}' },
        },
      ];
      const event = new LLMResponseTracerEvent('gpt-4', 'Response', toolCalls);
      const summary = event.printableSummary();

      expect(summary).toContain('Tool Calls: 2 calls');
    });

    it('should use singular form for one tool call', () => {
      const toolCalls = [
        {
          id: 'call1',
          type: 'function' as const,
          function: { name: 'tool1', arguments: '{}' },
        },
      ];
      const event = new LLMResponseTracerEvent('gpt-4', 'Response', toolCalls);
      const summary = event.printableSummary();

      expect(summary).toContain('Tool Calls: 1 call');
    });

    it('should include duration in summary', () => {
      const event = new LLMResponseTracerEvent('gpt-4', 'Response', undefined, 150.5);
      const summary = event.printableSummary();

      expect(summary).toContain('Duration: 150.50ms');
    });
  });

  describe('ToolCallTracerEvent', () => {
    it('should store tool name, arguments, and result', () => {
      const args = { date_string: 'tomorrow' };
      const result = { resolved: '2025-11-16' };
      const event = new ToolCallTracerEvent('resolve_date', args, result);

      expect(event.toolName).toBe('resolve_date');
      expect(event.arguments).toEqual(args);
      expect(event.result).toEqual(result);
    });

    it('should store caller if provided', () => {
      const event = new ToolCallTracerEvent('resolve_date', {}, {}, 'my-agent');

      expect(event.caller).toBe('my-agent');
    });

    it('should store call duration if provided', () => {
      const event = new ToolCallTracerEvent('resolve_date', {}, {}, undefined, 25.3);

      expect(event.callDurationMs).toBe(25.3);
    });

    it('should include tool name in summary', () => {
      const event = new ToolCallTracerEvent('resolve_date', {}, {});
      const summary = event.printableSummary();

      expect(summary).toContain('Tool: resolve_date');
    });

    it('should include arguments in summary', () => {
      const args = { date_string: 'tomorrow' };
      const event = new ToolCallTracerEvent('resolve_date', args, {});
      const summary = event.printableSummary();

      expect(summary).toContain('Arguments: {"date_string":"tomorrow"}');
    });

    it('should include result in summary', () => {
      const result = { resolved: '2025-11-16' };
      const event = new ToolCallTracerEvent('resolve_date', {}, result);
      const summary = event.printableSummary();

      expect(summary).toContain('Result: {"resolved":"2025-11-16"}');
    });

    it('should truncate long result in summary', () => {
      const longResult = { data: 'a'.repeat(150) };
      const event = new ToolCallTracerEvent('test_tool', {}, longResult);
      const summary = event.printableSummary();

      expect(summary).toMatch(/Result: .{100}\.\.\./);
    });

    it('should include caller in summary', () => {
      const event = new ToolCallTracerEvent('resolve_date', {}, {}, 'my-agent');
      const summary = event.printableSummary();

      expect(summary).toContain('Caller: my-agent');
    });

    it('should include duration in summary', () => {
      const event = new ToolCallTracerEvent('resolve_date', {}, {}, undefined, 25.3);
      const summary = event.printableSummary();

      expect(summary).toContain('Duration: 25.30ms');
    });
  });

  describe('AgentInteractionTracerEvent', () => {
    it('should store from agent, to agent, and event type', () => {
      const event = new AgentInteractionTracerEvent('coordinator', 'specialist', 'task_request');

      expect(event.fromAgent).toBe('coordinator');
      expect(event.toAgent).toBe('specialist');
      expect(event.eventType).toBe('task_request');
    });

    it('should store event ID if provided', () => {
      const event = new AgentInteractionTracerEvent(
        'coordinator',
        'specialist',
        'task_request',
        'event-456'
      );

      expect(event.eventId).toBe('event-456');
    });

    it('should include agents in summary', () => {
      const event = new AgentInteractionTracerEvent('coordinator', 'specialist', 'task_request');
      const summary = event.printableSummary();

      expect(summary).toContain('From: coordinator → To: specialist');
    });

    it('should include event type in summary', () => {
      const event = new AgentInteractionTracerEvent('coordinator', 'specialist', 'task_request');
      const summary = event.printableSummary();

      expect(summary).toContain('Event Type: task_request');
    });

    it('should include event ID in summary if provided', () => {
      const event = new AgentInteractionTracerEvent(
        'coordinator',
        'specialist',
        'task_request',
        'event-456'
      );
      const summary = event.printableSummary();

      expect(summary).toContain('Event ID: event-456');
    });
  });
});
