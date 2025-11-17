/**
 * Tests for AsyncAggregatorAgent
 */

import { AsyncAggregatorAgent } from '../async-aggregator-agent';
import { Event } from '../event';
import { Result, Ok, isOk } from '../../error';

// Test events
interface TestEventA extends Event {
  type: 'TestEventA';
  dataA: string;
}

interface TestEventB extends Event {
  type: 'TestEventB';
  dataB: string;
}

interface CombinedEvent extends Event {
  type: 'CombinedEvent';
  combined: string;
}

// Test aggregator implementation
class TestAggregator extends AsyncAggregatorAgent {
  public processedEvents: Event[][] = [];

  constructor() {
    super(['TestEventA', 'TestEventB']);
  }

  async processEvents(events: Event[]): Promise<Result<Event[], Error>> {
    this.processedEvents.push(events);

    const eventA = events.find((e) => (e as any).type === 'TestEventA') as TestEventA | undefined;
    const eventB = events.find((e) => (e as any).type === 'TestEventB') as TestEventB | undefined;

    if (eventA && eventB) {
      const combinedEvent: CombinedEvent = {
        type: 'CombinedEvent',
        source: 'TestAggregator',
        correlationId: eventA.correlationId,
        combined: `${eventA.dataA} + ${eventB.dataB}`,
      };
      return Ok([combinedEvent]);
    }

    return Ok([]);
  }
}

describe('AsyncAggregatorAgent', () => {
  let aggregator: TestAggregator;

  beforeEach(() => {
    aggregator = new TestAggregator();
  });

  describe('constructor', () => {
    it('should initialize with event types needed', () => {
      expect(aggregator).toBeDefined();
    });
  });

  describe('receiveEventAsync', () => {
    it('should accumulate events until all types are received', async () => {
      const correlationId = 'test-123';

      const eventA: TestEventA = {
        type: 'TestEventA',
        source: 'TestSource',
        correlationId,
        dataA: 'dataA',
      };

      const eventB: TestEventB = {
        type: 'TestEventB',
        source: 'TestSource',
        correlationId,
        dataB: 'dataB',
      };

      // First event should not trigger processing
      const result1 = await aggregator.receiveEventAsync(eventA);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toHaveLength(0);
      }
      expect(aggregator.processedEvents).toHaveLength(0);

      // Second event should trigger processing
      const result2 = await aggregator.receiveEventAsync(eventB);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value).toHaveLength(1);
        expect((result2.value[0] as CombinedEvent).combined).toBe('dataA + dataB');
      }
      expect(aggregator.processedEvents).toHaveLength(1);
    });

    it('should handle events in any order', async () => {
      const correlationId = 'test-456';

      const eventA: TestEventA = {
        type: 'TestEventA',
        source: 'TestSource',
        correlationId,
        dataA: 'first',
      };

      const eventB: TestEventB = {
        type: 'TestEventB',
        source: 'TestSource',
        correlationId,
        dataB: 'second',
      };

      // Receive B first
      const result1 = await aggregator.receiveEventAsync(eventB);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toHaveLength(0);
      }

      // Then A triggers processing
      const result2 = await aggregator.receiveEventAsync(eventA);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value).toHaveLength(1);
        expect((result2.value[0] as CombinedEvent).combined).toBe('first + second');
      }
    });

    it('should handle multiple correlation IDs independently', async () => {
      const correlationId1 = 'test-1';
      const correlationId2 = 'test-2';

      const eventA1: TestEventA = {
        type: 'TestEventA',
        source: 'TestSource',
        correlationId: correlationId1,
        dataA: 'A1',
      };

      const eventA2: TestEventA = {
        type: 'TestEventA',
        source: 'TestSource',
        correlationId: correlationId2,
        dataA: 'A2',
      };

      const eventB1: TestEventB = {
        type: 'TestEventB',
        source: 'TestSource',
        correlationId: correlationId1,
        dataB: 'B1',
      };

      const eventB2: TestEventB = {
        type: 'TestEventB',
        source: 'TestSource',
        correlationId: correlationId2,
        dataB: 'B2',
      };

      // Process events for both correlations interleaved
      await aggregator.receiveEventAsync(eventA1);
      await aggregator.receiveEventAsync(eventA2);
      await aggregator.receiveEventAsync(eventB2); // Completes correlation 2
      const result = await aggregator.receiveEventAsync(eventB1); // Completes correlation 1

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
      }
      expect(aggregator.processedEvents).toHaveLength(2);
    });

    it('should return error if event missing correlation ID', async () => {
      const eventA = {
        source: 'TestSource',
        // No correlationId
      } as Event;

      const result = await aggregator.receiveEventAsync(eventA);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('correlation ID');
      }
    });
  });

  describe('waitForEvents', () => {
    it('should resolve immediately if events already present', async () => {
      const aggregator2 = new TestAggregator(); // Fresh aggregator
      const correlationId = 'test-789';

      const eventA: TestEventA = {
        type: 'TestEventA',
        source: 'TestSource',
        correlationId,
        dataA: 'dataA',
      };

      const eventB: TestEventB = {
        type: 'TestEventB',
        source: 'TestSource',
        correlationId,
        dataB: 'dataB',
      };

      // Add both events - this should NOT trigger processEvents since we're testing waitForEvents
      // We need to manually add to results
      (aggregator2 as any).results.set(correlationId, [eventA, eventB]);

      // waitForEvents should return immediately
      const result = await aggregator2.waitForEvents(correlationId);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should wait for events to arrive', async () => {
      const aggregator2 = new TestAggregator(); // Fresh aggregator
      const correlationId = 'test-wait';

      // Start waiting
      const waitPromise = aggregator2.waitForEvents(correlationId, 2000);

      // Add events after a delay via direct receiveEventAsync (will trigger aggregation)
      setTimeout(() => {
        aggregator2.receiveEventAsync({
          type: 'TestEventA',
          source: 'TestSource',
          correlationId,
          dataA: 'async-A',
        } as TestEventA);
      }, 100);

      setTimeout(() => {
        aggregator2.receiveEventAsync({
          type: 'TestEventB',
          source: 'TestSource',
          correlationId,
          dataB: 'async-B',
        } as TestEventB);
      }, 200);

      const result = await waitPromise;
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    }, 10000);

    it('should timeout if events do not arrive', async () => {
      const correlationId = 'test-timeout';

      const result = await aggregator.waitForEvents(correlationId, 100);

      // Should timeout and return error
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Timeout');
      }
    });
  });

  describe('processEvents', () => {
    it('should be called with complete event set', async () => {
      const correlationId = 'test-process';

      await aggregator.receiveEventAsync({
        type: 'TestEventA',
        source: 'TestSource',
        correlationId,
        dataA: 'A',
      } as TestEventA);

      await aggregator.receiveEventAsync({
        type: 'TestEventB',
        source: 'TestSource',
        correlationId,
        dataB: 'B',
      } as TestEventB);

      expect(aggregator.processedEvents).toHaveLength(1);
      expect(aggregator.processedEvents[0]).toHaveLength(2);
    });
  });
});
