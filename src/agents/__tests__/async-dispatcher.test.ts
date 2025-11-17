/**
 * Tests for AsyncDispatcher
 */

import { AsyncDispatcher } from '../async-dispatcher';
import { Router } from '../router';
import { BaseAsyncAgent } from '../base-async-agent';
import { Event, TerminateEvent } from '../event';
import { Result, Ok, Err } from '../../error';

// Test events
interface TestEvent extends Event {
  type: 'TestEvent';
  data: string;
}

interface ResponseEvent extends Event {
  type: 'ResponseEvent';
  response: string;
}

// Test agent implementation
class TestAgent implements BaseAsyncAgent {
  public receivedEvents: Event[] = [];
  public shouldError: boolean = false;
  public delay: number = 0;

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    this.receivedEvents.push(event);

    if (this.shouldError) {
      return Err(new Error('Test error'));
    }

    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if ((event as TestEvent).type === 'TestEvent') {
      const responseEvent: ResponseEvent = {
        type: 'ResponseEvent',
        source: 'TestAgent',
        correlationId: event.correlationId,
        response: `Processed: ${(event as TestEvent).data}`,
      };
      return Ok([responseEvent]);
    }

    return Ok([]);
  }
}

describe('AsyncDispatcher', () => {
  let router: Router;
  let agent: TestAgent;
  let dispatcher: AsyncDispatcher;

  beforeEach(() => {
    router = new Router();
    agent = new TestAgent();
    dispatcher = new AsyncDispatcher(router);
  });

  afterEach(async () => {
    if (dispatcher.isRunning()) {
      await dispatcher.stop();
    }
  });

  describe('constructor', () => {
    it('should create dispatcher with router', () => {
      expect(dispatcher).toBeDefined();
      expect(dispatcher.getQueueLength()).toBe(0);
      expect(dispatcher.isRunning()).toBe(false);
    });

    it('should accept custom batch size', () => {
      const customDispatcher = new AsyncDispatcher(router, 10);
      expect(customDispatcher).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start processing loop', async () => {
      await dispatcher.start();
      expect(dispatcher.isRunning()).toBe(true);
      await dispatcher.stop();
    });

    it('should stop processing loop', async () => {
      await dispatcher.start();
      expect(dispatcher.isRunning()).toBe(true);

      await dispatcher.stop();
      expect(dispatcher.isRunning()).toBe(false);
    });

    it('should handle multiple stop calls', async () => {
      await dispatcher.start();
      await dispatcher.stop();
      await dispatcher.stop(); // Should not error
      expect(dispatcher.isRunning()).toBe(false);
    });
  });

  describe('dispatch', () => {
    it('should add event to queue', () => {
      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      };

      dispatcher.dispatch(event);
      expect(dispatcher.getQueueLength()).toBe(1);
    });

    it('should assign correlation ID if missing', () => {
      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      };

      dispatcher.dispatch(event);
      expect(event.correlationId).toBeDefined();
    });

    it('should preserve existing correlation ID', () => {
      const correlationId = 'custom-123';
      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        correlationId,
        data: 'test',
      };

      dispatcher.dispatch(event);
      expect(event.correlationId).toBe(correlationId);
    });
  });

  describe('event processing', () => {
    beforeEach(() => {
      router.addRoute('TestEvent', agent);
    });

    it('should route events to registered agents', async () => {
      await dispatcher.start();

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test data',
      };

      dispatcher.dispatch(event);

      await dispatcher.waitForEmptyQueue(1000);
      await dispatcher.stop();

      expect(agent.receivedEvents).toHaveLength(1);
      expect((agent.receivedEvents[0] as TestEvent).data).toBe('test data');
    });

    it('should dispatch events produced by agents', async () => {
      const responseAgent = new TestAgent();
      router.addRoute('ResponseEvent', responseAgent);

      await dispatcher.start();

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      };

      dispatcher.dispatch(event);

      await dispatcher.waitForEmptyQueue(1000);
      await dispatcher.stop();

      // Original agent should receive TestEvent
      expect(agent.receivedEvents).toHaveLength(1);
      // Response agent should receive ResponseEvent
      expect(responseAgent.receivedEvents).toHaveLength(1);
      expect((responseAgent.receivedEvents[0] as ResponseEvent).type).toBe('ResponseEvent');
    });

    it('should handle agent errors gracefully', async () => {
      agent.shouldError = true;

      await dispatcher.start();

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      };

      dispatcher.dispatch(event);

      await dispatcher.waitForEmptyQueue(1000);
      await dispatcher.stop();

      // Agent still received the event even though it errored
      expect(agent.receivedEvents).toHaveLength(1);
    });

    it('should process multiple events', async () => {
      await dispatcher.start();

      for (let i = 0; i < 5; i++) {
        dispatcher.dispatch({
          type: 'TestEvent',
          source: 'TestSource',
          data: `test-${i}`,
        } as TestEvent);
      }

      await dispatcher.waitForEmptyQueue(1000);
      await dispatcher.stop();

      expect(agent.receivedEvents).toHaveLength(5);
    });

    it('should route events to multiple agents', async () => {
      const agent2 = new TestAgent();
      router.addRoute('TestEvent', agent2);

      await dispatcher.start();

      dispatcher.dispatch({
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      } as TestEvent);

      await dispatcher.waitForEmptyQueue(1000);
      await dispatcher.stop();

      // Both agents should receive the event
      expect(agent.receivedEvents).toHaveLength(1);
      expect(agent2.receivedEvents).toHaveLength(1);
    });
  });

  describe('waitForEmptyQueue', () => {
    beforeEach(() => {
      router.addRoute('TestEvent', agent);
    });

    it('should return true when queue is empty', async () => {
      const result = await dispatcher.waitForEmptyQueue(100);
      expect(result).toBe(true);
    });

    it('should wait for queue to empty', async () => {
      await dispatcher.start();

      // Add some delay to agent processing
      agent.delay = 50;

      for (let i = 0; i < 3; i++) {
        dispatcher.dispatch({
          type: 'TestEvent',
          source: 'TestSource',
          data: `test-${i}`,
        } as TestEvent);
      }

      const result = await dispatcher.waitForEmptyQueue(2000);
      expect(result).toBe(true);
      expect(dispatcher.getQueueLength()).toBe(0);

      await dispatcher.stop();
    });

    it('should timeout if queue does not empty', async () => {
      // Don't start dispatcher - queue will never empty
      dispatcher.dispatch({
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      } as TestEvent);

      const result = await dispatcher.waitForEmptyQueue(100);
      expect(result).toBe(false);
      expect(dispatcher.getQueueLength()).toBeGreaterThan(0);
    });
  });

  describe('terminate event', () => {
    it('should stop dispatcher on terminate event', async () => {
      router.addRoute('terminate', agent);

      await dispatcher.start();
      expect(dispatcher.isRunning()).toBe(true);

      const terminateEvent: TerminateEvent = {
        type: 'terminate',
        source: 'TestSource',
      };

      dispatcher.dispatch(terminateEvent);

      // Wait a moment for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(dispatcher.isRunning()).toBe(false);
    });
  });

  describe('getQueueLength', () => {
    it('should return current queue length', () => {
      expect(dispatcher.getQueueLength()).toBe(0);

      dispatcher.dispatch({
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test1',
      } as TestEvent);

      expect(dispatcher.getQueueLength()).toBe(1);

      dispatcher.dispatch({
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test2',
      } as TestEvent);

      expect(dispatcher.getQueueLength()).toBe(2);
    });
  });

  describe('isRunning', () => {
    it('should reflect dispatcher state', async () => {
      expect(dispatcher.isRunning()).toBe(false);

      await dispatcher.start();
      expect(dispatcher.isRunning()).toBe(true);

      await dispatcher.stop();
      expect(dispatcher.isRunning()).toBe(false);
    });
  });
});
