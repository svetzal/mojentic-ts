/**
 * Tests for tracer system
 */

import { randomUUID } from 'crypto';
import { TracerSystem } from './tracerSystem';
import { EventStore } from './eventStore';
import {
  LLMCallTracerEvent,
  LLMResponseTracerEvent,
  ToolCallTracerEvent,
  AgentInteractionTracerEvent,
} from './tracerEvents';

describe('TracerSystem', () => {
  let tracer: TracerSystem;

  beforeEach(() => {
    tracer = new TracerSystem();
  });

  describe('constructor', () => {
    it('should create with default event store', () => {
      expect(tracer).toBeDefined();
      expect(tracer.enabled).toBe(true);
    });

    it('should create with custom event store', () => {
      const store = new EventStore();
      const customTracer = new TracerSystem(store);

      expect(customTracer).toBeDefined();
    });

    it('should respect enabled flag', () => {
      const disabledTracer = new TracerSystem(undefined, false);

      expect(disabledTracer.enabled).toBe(false);
    });
  });

  describe('enable and disable', () => {
    it('should enable tracer', () => {
      const disabledTracer = new TracerSystem(undefined, false);
      expect(disabledTracer.enabled).toBe(false);

      disabledTracer.enable();
      expect(disabledTracer.enabled).toBe(true);
    });

    it('should disable tracer', () => {
      expect(tracer.enabled).toBe(true);

      tracer.disable();
      expect(tracer.enabled).toBe(false);
    });

    it('should not record events when disabled', () => {
      tracer.disable();
      tracer.recordLlmCall('gpt-4', [], 0.7);

      expect(tracer.getEvents()).toHaveLength(0);
    });

    it('should record events when enabled', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);

      expect(tracer.getEvents()).toHaveLength(1);
    });
  });

  describe('recordEvent', () => {
    it('should record a tracer event', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      tracer.recordEvent(event);

      const events = tracer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(event);
    });

    it('should not record when disabled', () => {
      tracer.disable();
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      tracer.recordEvent(event);

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordLlmCall', () => {
    it('should record LLM call event', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      tracer.recordLlmCall('gpt-4', messages, 0.7);

      const events = tracer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(LLMCallTracerEvent);

      const event = events[0] as LLMCallTracerEvent;
      expect(event.model).toBe('gpt-4');
      expect(event.messages).toEqual(messages);
      expect(event.temperature).toBe(0.7);
    });

    it('should record with tools', () => {
      const tools = [
        {
          type: 'function',
          function: { name: 'test_tool', description: '', parameters: {} },
        },
      ];
      tracer.recordLlmCall('gpt-4', [], 0.7, tools);

      const events = tracer.getEvents();
      const event = events[0] as LLMCallTracerEvent;
      expect(event.tools).toEqual(tools);
    });

    it('should use provided correlation ID', () => {
      const correlationId = randomUUID();
      tracer.recordLlmCall('gpt-4', [], 0.7, undefined, correlationId);

      const events = tracer.getEvents();
      expect(events[0].correlationId).toBe(correlationId);
    });

    it('should use provided source', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7, undefined, undefined, 'test-source');

      const events = tracer.getEvents();
      expect(events[0].source).toBe('test-source');
    });

    it('should not record when disabled', () => {
      tracer.disable();
      tracer.recordLlmCall('gpt-4', [], 0.7);

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordLlmResponse', () => {
    it('should record LLM response event', () => {
      tracer.recordLlmResponse('gpt-4', 'Hello there!');

      const events = tracer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(LLMResponseTracerEvent);

      const event = events[0] as LLMResponseTracerEvent;
      expect(event.model).toBe('gpt-4');
      expect(event.content).toBe('Hello there!');
    });

    it('should record with tool calls', () => {
      const toolCalls = [
        {
          id: 'call1',
          type: 'function' as const,
          function: { name: 'test_tool', arguments: '{}' },
        },
      ];
      tracer.recordLlmResponse('gpt-4', 'Using tool...', toolCalls);

      const events = tracer.getEvents();
      const event = events[0] as LLMResponseTracerEvent;
      expect(event.toolCalls).toEqual(toolCalls);
    });

    it('should record with call duration', () => {
      tracer.recordLlmResponse('gpt-4', 'Response', undefined, 150.5);

      const events = tracer.getEvents();
      const event = events[0] as LLMResponseTracerEvent;
      expect(event.callDurationMs).toBe(150.5);
    });

    it('should use provided correlation ID', () => {
      const correlationId = randomUUID();
      tracer.recordLlmResponse('gpt-4', 'Response', undefined, undefined, correlationId);

      const events = tracer.getEvents();
      expect(events[0].correlationId).toBe(correlationId);
    });

    it('should not record when disabled', () => {
      tracer.disable();
      tracer.recordLlmResponse('gpt-4', 'Response');

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordToolCall', () => {
    it('should record tool call event', () => {
      const args = { date_string: 'tomorrow' };
      const result = { resolved: '2025-11-16' };
      tracer.recordToolCall('resolve_date', args, result);

      const events = tracer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ToolCallTracerEvent);

      const event = events[0] as ToolCallTracerEvent;
      expect(event.toolName).toBe('resolve_date');
      expect(event.arguments).toEqual(args);
      expect(event.result).toEqual(result);
    });

    it('should record with caller', () => {
      tracer.recordToolCall('test_tool', {}, {}, 'my-agent');

      const events = tracer.getEvents();
      const event = events[0] as ToolCallTracerEvent;
      expect(event.caller).toBe('my-agent');
    });

    it('should record with call duration', () => {
      tracer.recordToolCall('test_tool', {}, {}, undefined, 25.3);

      const events = tracer.getEvents();
      const event = events[0] as ToolCallTracerEvent;
      expect(event.callDurationMs).toBe(25.3);
    });

    it('should use provided correlation ID', () => {
      const correlationId = randomUUID();
      tracer.recordToolCall('test_tool', {}, {}, undefined, undefined, correlationId);

      const events = tracer.getEvents();
      expect(events[0].correlationId).toBe(correlationId);
    });

    it('should not record when disabled', () => {
      tracer.disable();
      tracer.recordToolCall('test_tool', {}, {});

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordAgentInteraction', () => {
    it('should record agent interaction event', () => {
      tracer.recordAgentInteraction('coordinator', 'specialist', 'task_request');

      const events = tracer.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(AgentInteractionTracerEvent);

      const event = events[0] as AgentInteractionTracerEvent;
      expect(event.fromAgent).toBe('coordinator');
      expect(event.toAgent).toBe('specialist');
      expect(event.eventType).toBe('task_request');
    });

    it('should record with event ID', () => {
      tracer.recordAgentInteraction('coordinator', 'specialist', 'task_request', 'event-456');

      const events = tracer.getEvents();
      const event = events[0] as AgentInteractionTracerEvent;
      expect(event.eventId).toBe('event-456');
    });

    it('should use provided correlation ID', () => {
      const correlationId = randomUUID();
      tracer.recordAgentInteraction(
        'coordinator',
        'specialist',
        'task_request',
        undefined,
        correlationId
      );

      const events = tracer.getEvents();
      expect(events[0].correlationId).toBe(correlationId);
    });

    it('should not record when disabled', () => {
      tracer.disable();
      tracer.recordAgentInteraction('coordinator', 'specialist', 'task_request');

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('getEvents', () => {
    it('should return all events', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);
      tracer.recordLlmResponse('gpt-4', 'Response');

      const events = tracer.getEvents();
      expect(events).toHaveLength(2);
    });

    it('should filter by event type', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);
      tracer.recordLlmResponse('gpt-4', 'Response');
      tracer.recordToolCall('test_tool', {}, {});

      const llmCalls = tracer.getEvents({ eventType: LLMCallTracerEvent });
      expect(llmCalls).toHaveLength(1);
      expect(llmCalls[0]).toBeInstanceOf(LLMCallTracerEvent);
    });

    it('should filter by custom function', () => {
      const correlationId = randomUUID();
      tracer.recordLlmCall('gpt-4', [], 0.7, undefined, correlationId);
      tracer.recordLlmResponse('gpt-4', 'Response');

      const filtered = tracer.getEvents({
        filterFunc: (e) => e.correlationId === correlationId,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBeInstanceOf(LLMCallTracerEvent);
    });
  });

  describe('getLastNTracerEvents', () => {
    it('should return last N events', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);
      tracer.recordLlmResponse('gpt-4', 'Response');
      tracer.recordToolCall('test_tool', {}, {});

      const last2 = tracer.getLastNTracerEvents(2);
      expect(last2).toHaveLength(2);
      expect(last2[0]).toBeInstanceOf(LLMResponseTracerEvent);
      expect(last2[1]).toBeInstanceOf(ToolCallTracerEvent);
    });

    it('should filter by event type', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);
      tracer.recordLlmResponse('gpt-4', 'Response 1');
      tracer.recordLlmCall('gpt-3.5', [], 0.5);
      tracer.recordLlmResponse('gpt-4', 'Response 2');

      const last2Responses = tracer.getLastNTracerEvents(2, LLMResponseTracerEvent);
      expect(last2Responses).toHaveLength(2);
      expect(last2Responses[0]).toBeInstanceOf(LLMResponseTracerEvent);
      expect(last2Responses[1]).toBeInstanceOf(LLMResponseTracerEvent);
    });
  });

  describe('clear', () => {
    it('should clear all events', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);
      tracer.recordLlmResponse('gpt-4', 'Response');

      expect(tracer.getEvents()).toHaveLength(2);

      tracer.clear();

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });
});
