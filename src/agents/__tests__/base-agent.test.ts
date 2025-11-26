import { BaseAgent } from '../base-agent';
import { Event } from '../event';

interface TestEvent extends Event {
  data: string;
}

function createTestEvent(data: string, correlationId?: string): TestEvent {
  return {
    source: 'TestSource',
    correlationId,
    data,
  };
}

describe('BaseAgent', () => {
  describe('SimpleAgent', () => {
    class SimpleAgent implements BaseAgent {
      receiveEvent(_event: Event): Event[] {
        return [];
      }
    }

    it('should return empty array from default implementation', () => {
      const agent = new SimpleAgent();
      const event = createTestEvent('test');

      const result = agent.receiveEvent(event);

      expect(result).toEqual([]);
    });
  });

  describe('EchoAgent', () => {
    class EchoAgent implements BaseAgent {
      receiveEvent(event: Event): Event[] {
        const newEvent: TestEvent = {
          source: 'EchoAgent',
          correlationId: event.correlationId,
          data: 'echoed',
        };
        return [newEvent];
      }
    }

    it('should return a new event', () => {
      const agent = new EchoAgent();
      const event = createTestEvent('original', 'test-123');

      const result = agent.receiveEvent(event);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('EchoAgent');
      expect((result[0] as TestEvent).data).toBe('echoed');
    });

    it('should preserve correlation id', () => {
      const agent = new EchoAgent();
      const event = createTestEvent('test', 'preserve-me');

      const result = agent.receiveEvent(event);

      expect(result[0].correlationId).toBe('preserve-me');
    });

    it('should handle missing correlation id', () => {
      const agent = new EchoAgent();
      const event = createTestEvent('test');

      const result = agent.receiveEvent(event);

      expect(result[0].correlationId).toBeUndefined();
    });
  });

  describe('MultiEventAgent', () => {
    class MultiEventAgent implements BaseAgent {
      receiveEvent(event: Event): Event[] {
        return [
          {
            source: 'MultiEventAgent',
            correlationId: event.correlationId,
            data: 'event1',
          } as TestEvent,
          {
            source: 'MultiEventAgent',
            correlationId: event.correlationId,
            data: 'event2',
          } as TestEvent,
        ];
      }
    }

    it('should return multiple events', () => {
      const agent = new MultiEventAgent();
      const event = createTestEvent('test', 'multi-123');

      const result = agent.receiveEvent(event);

      expect(result).toHaveLength(2);
      expect((result[0] as TestEvent).data).toBe('event1');
      expect((result[1] as TestEvent).data).toBe('event2');
    });

    it('should preserve correlation id in all events', () => {
      const agent = new MultiEventAgent();
      const event = createTestEvent('test', 'multi-456');

      const result = agent.receiveEvent(event);

      expect(result[0].correlationId).toBe('multi-456');
      expect(result[1].correlationId).toBe('multi-456');
    });
  });

  describe('ProcessingAgent', () => {
    class ProcessingAgent implements BaseAgent {
      receiveEvent(event: Event): Event[] {
        const testEvent = event as TestEvent;
        return [
          {
            source: 'ProcessingAgent',
            correlationId: event.correlationId,
            data: `processed: ${testEvent.data}`,
          } as TestEvent,
        ];
      }
    }

    it('should transform event data', () => {
      const agent = new ProcessingAgent();
      const event = createTestEvent('input', 'test-123');

      const result = agent.receiveEvent(event);

      expect(result).toHaveLength(1);
      expect((result[0] as TestEvent).data).toBe('processed: input');
    });
  });
});
