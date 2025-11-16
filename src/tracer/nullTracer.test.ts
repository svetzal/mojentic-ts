/**
 * Tests for null tracer
 */

import { nullTracer, NullTracer } from './nullTracer';
import { LLMCallTracerEvent, LLMResponseTracerEvent } from './tracerEvents';

describe('NullTracer', () => {
  let tracer: NullTracer;

  beforeEach(() => {
    tracer = new NullTracer();
  });

  describe('properties', () => {
    it('should always be disabled', () => {
      expect(tracer.enabled).toBe(false);
    });

    it('should have undefined event store', () => {
      expect(tracer.eventStore).toBeUndefined();
    });
  });

  describe('recordEvent', () => {
    it('should not throw when recording events', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);

      expect(() => tracer.recordEvent(event)).not.toThrow();
    });

    it('should not store events', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      tracer.recordEvent(event);

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordLlmCall', () => {
    it('should not throw', () => {
      expect(() => tracer.recordLlmCall('gpt-4', [], 0.7)).not.toThrow();
    });

    it('should not store events', () => {
      tracer.recordLlmCall('gpt-4', [], 0.7);

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordLlmResponse', () => {
    it('should not throw', () => {
      expect(() => tracer.recordLlmResponse('gpt-4', 'Response')).not.toThrow();
    });

    it('should not store events', () => {
      tracer.recordLlmResponse('gpt-4', 'Response');

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordToolCall', () => {
    it('should not throw', () => {
      expect(() => tracer.recordToolCall('test_tool', {}, {})).not.toThrow();
    });

    it('should not store events', () => {
      tracer.recordToolCall('test_tool', {}, {});

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('recordAgentInteraction', () => {
    it('should not throw', () => {
      expect(() =>
        tracer.recordAgentInteraction('coordinator', 'specialist', 'task_request')
      ).not.toThrow();
    });

    it('should not store events', () => {
      tracer.recordAgentInteraction('coordinator', 'specialist', 'task_request');

      expect(tracer.getEvents()).toHaveLength(0);
    });
  });

  describe('getEvents', () => {
    it('should always return empty array', () => {
      expect(tracer.getEvents()).toEqual([]);
    });

    it('should return empty array with filters', () => {
      expect(tracer.getEvents({ eventType: LLMCallTracerEvent })).toEqual([]);
    });
  });

  describe('getLastNTracerEvents', () => {
    it('should always return empty array', () => {
      expect(tracer.getLastNTracerEvents(10)).toEqual([]);
    });

    it('should return empty array with type filter', () => {
      expect(tracer.getLastNTracerEvents(5, LLMResponseTracerEvent)).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should not throw', () => {
      expect(() => tracer.clear()).not.toThrow();
    });
  });

  describe('enable', () => {
    it('should not throw', () => {
      expect(() => tracer.enable()).not.toThrow();
    });

    it('should not change enabled state', () => {
      tracer.enable();
      expect(tracer.enabled).toBe(false);
    });
  });

  describe('disable', () => {
    it('should not throw', () => {
      expect(() => tracer.disable()).not.toThrow();
    });
  });

  describe('singleton', () => {
    it('should provide singleton instance', () => {
      expect(nullTracer).toBeInstanceOf(NullTracer);
      expect(nullTracer.enabled).toBe(false);
    });

    it('should be usable without instantiation', () => {
      expect(() => nullTracer.recordLlmCall('gpt-4', [], 0.7)).not.toThrow();
      expect(nullTracer.getEvents()).toEqual([]);
    });
  });
});
