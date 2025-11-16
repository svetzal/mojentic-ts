/**
 * Tests for event store
 */

import { EventStore } from './eventStore';
import { LLMCallTracerEvent, LLMResponseTracerEvent, ToolCallTracerEvent } from './tracerEvents';

describe('EventStore', () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore();
  });

  describe('store', () => {
    it('should store events', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      store.store(event);

      const events = store.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(event);
    });

    it('should store multiple events', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');

      store.store(event1);
      store.store(event2);

      const events = store.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
    });

    it('should call onStoreCallback when event is stored', () => {
      const callback = jest.fn();
      store = new EventStore(callback);
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);

      store.store(event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should call callback for each event', () => {
      const callback = jest.fn();
      store = new EventStore(callback);

      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');

      store.store(event1);
      store.store(event2);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, event1);
      expect(callback).toHaveBeenNthCalledWith(2, event2);
    });
  });

  describe('getEvents', () => {
    it('should return all events when no filter provided', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');

      store.store(event1);
      store.store(event2);

      const events = store.getEvents();
      expect(events).toHaveLength(2);
    });

    it('should filter events by type', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');
      const event3 = new LLMCallTracerEvent('gpt-3.5', [], 0.5);

      store.store(event1);
      store.store(event2);
      store.store(event3);

      const filtered = store.getEvents({ eventType: LLMCallTracerEvent });
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toBe(event1);
      expect(filtered[1]).toBe(event3);
    });

    it('should filter events by start time', () => {
      const now = Date.now();
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      // Manually set timestamp to past
      (event1 as any).timestamp = now - 10000;

      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');
      (event2 as any).timestamp = now;

      store.store(event1);
      store.store(event2);

      const filtered = store.getEvents({ startTime: now - 5000 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(event2);
    });

    it('should filter events by end time', () => {
      const now = Date.now();
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      (event1 as any).timestamp = now - 10000;

      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');
      (event2 as any).timestamp = now;

      store.store(event1);
      store.store(event2);

      const filtered = store.getEvents({ endTime: now - 5000 });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(event1);
    });

    it('should filter events by time range', () => {
      const now = Date.now();
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      (event1 as any).timestamp = now - 20000;

      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');
      (event2 as any).timestamp = now - 10000;

      const event3 = new ToolCallTracerEvent('test_tool', {}, {});
      (event3 as any).timestamp = now;

      store.store(event1);
      store.store(event2);
      store.store(event3);

      const filtered = store.getEvents({
        startTime: now - 15000,
        endTime: now - 5000,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(event2);
    });

    it('should filter events by custom function', () => {
      const correlationId = crypto.randomUUID();
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7, undefined, correlationId);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');

      store.store(event1);
      store.store(event2);

      const filtered = store.getEvents({
        filterFunc: (e) => e.correlationId === correlationId,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(event1);
    });

    it('should apply multiple filters', () => {
      const correlationId = crypto.randomUUID();
      const now = Date.now();

      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7, undefined, correlationId);
      (event1 as any).timestamp = now - 10000;

      const event2 = new LLMCallTracerEvent('gpt-4', [], 0.7, undefined, correlationId);
      (event2 as any).timestamp = now;

      const event3 = new LLMResponseTracerEvent(
        'gpt-4',
        'Response',
        undefined,
        undefined,
        correlationId
      );
      (event3 as any).timestamp = now;

      store.store(event1);
      store.store(event2);
      store.store(event3);

      const filtered = store.getEvents({
        eventType: LLMCallTracerEvent,
        startTime: now - 5000,
        filterFunc: (e) => e.correlationId === correlationId,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(event2);
    });

    it('should return empty array if no events match', () => {
      store.store(new LLMCallTracerEvent('gpt-4', [], 0.7));

      const filtered = store.getEvents({ eventType: LLMResponseTracerEvent });
      expect(filtered).toHaveLength(0);
    });

    it('should not modify original events array', () => {
      const event = new LLMCallTracerEvent('gpt-4', [], 0.7);
      store.store(event);

      const events1 = store.getEvents();
      events1.push(new LLMResponseTracerEvent('gpt-4', 'Extra'));

      const events2 = store.getEvents();
      expect(events2).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should remove all events', () => {
      store.store(new LLMCallTracerEvent('gpt-4', [], 0.7));
      store.store(new LLMResponseTracerEvent('gpt-4', 'Response'));

      expect(store.getEvents()).toHaveLength(2);

      store.clear();

      expect(store.getEvents()).toHaveLength(0);
    });

    it('should allow storing events after clear', () => {
      store.store(new LLMCallTracerEvent('gpt-4', [], 0.7));
      store.clear();

      const event = new LLMResponseTracerEvent('gpt-4', 'Response');
      store.store(event);

      const events = store.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(event);
    });
  });

  describe('getLastNEvents', () => {
    it('should return last N events', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');
      const event3 = new ToolCallTracerEvent('test_tool', {}, {});

      store.store(event1);
      store.store(event2);
      store.store(event3);

      const last2 = store.getLastNEvents(2);
      expect(last2).toHaveLength(2);
      expect(last2[0]).toBe(event2);
      expect(last2[1]).toBe(event3);
    });

    it('should return all events if N is larger than stored events', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response');

      store.store(event1);
      store.store(event2);

      const last10 = store.getLastNEvents(10);
      expect(last10).toHaveLength(2);
    });

    it('should filter by event type', () => {
      const event1 = new LLMCallTracerEvent('gpt-4', [], 0.7);
      const event2 = new LLMResponseTracerEvent('gpt-4', 'Response 1');
      const event3 = new LLMCallTracerEvent('gpt-3.5', [], 0.5);
      const event4 = new LLMResponseTracerEvent('gpt-4', 'Response 2');

      store.store(event1);
      store.store(event2);
      store.store(event3);
      store.store(event4);

      const last2Responses = store.getLastNEvents(2, LLMResponseTracerEvent);
      expect(last2Responses).toHaveLength(2);
      expect(last2Responses[0]).toBe(event2);
      expect(last2Responses[1]).toBe(event4);
    });

    it('should return empty array if no events', () => {
      const last5 = store.getLastNEvents(5);
      expect(last5).toHaveLength(0);
    });

    it('should return empty array if no events match type', () => {
      store.store(new LLMCallTracerEvent('gpt-4', [], 0.7));

      const last5 = store.getLastNEvents(5, LLMResponseTracerEvent);
      expect(last5).toHaveLength(0);
    });
  });
});
