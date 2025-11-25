/**
 * Tests for AsyncLlmAgentWithMemory
 */

import {
  AsyncLlmAgentWithMemory,
  AsyncLlmAgentWithMemoryConfig,
} from '../async-llm-agent-with-memory';
import { Event } from '../event';
import { LlmBroker } from '../../llm/broker';
import { LlmGateway } from '../../llm/gateway';
import { GatewayResponse, StreamChunk } from '../../llm/models';
import { SharedWorkingMemory } from '../../context';
import { Result, Ok, isOk } from '../../error';

// Mock gateway for testing
class MockGateway implements LlmGateway {
  private mockResponse: Record<string, unknown> = { text: 'test response', memory: {} };

  setMockResponse(response: Record<string, unknown>): void {
    this.mockResponse = response;
  }

  async generate(): Promise<Result<GatewayResponse, Error>> {
    return Ok({
      content: JSON.stringify(this.mockResponse),
      finishReason: 'stop',
    });
  }

  async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
    yield Ok({ content: JSON.stringify(this.mockResponse), done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['test-model']);
  }

  async calculateEmbeddings(_text: string, _model?: string): Promise<Result<number[], Error>> {
    return Ok([0.1, 0.2, 0.3]);
  }
}

// Test agent implementation
interface TestResponse {
  text: string;
}

interface TestEvent extends Event {
  type: 'TestEvent';
  message: string;
}

function isTestEvent(event: Event): event is TestEvent {
  return (event as TestEvent).type === 'TestEvent';
}

class TestAgent extends AsyncLlmAgentWithMemory {
  constructor(broker: LlmBroker, memory: SharedWorkingMemory) {
    const config: AsyncLlmAgentWithMemoryConfig = {
      broker,
      memory,
      behaviour: 'You are a test agent.',
      instructions: 'Process test events.',
      responseModel: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
      },
    };
    super(config);
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (isTestEvent(event)) {
      const result = await this.generateResponseWithMemory<TestResponse>(event.message);
      if (isOk(result)) {
        return Ok([]);
      }
      return result as Result<Event[], Error>;
    }
    return Ok([]);
  }
}

describe('AsyncLlmAgentWithMemory', () => {
  let gateway: MockGateway;
  let broker: LlmBroker;
  let memory: SharedWorkingMemory;

  beforeEach(() => {
    gateway = new MockGateway();
    broker = new LlmBroker('test-model', gateway);
    memory = new SharedWorkingMemory({ user: { name: 'Alice' } });
  });

  describe('constructor', () => {
    it('should create agent with memory and instructions', () => {
      const agent = new TestAgent(broker, memory);
      expect(agent).toBeDefined();
    });

    it('should require response model in config', () => {
      const agent = new TestAgent(broker, memory);
      expect(agent).toBeDefined();
    });
  });

  describe('createInitialMessagesWithMemory', () => {
    it('should include behaviour, memory, and instructions', () => {
      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = (agent as any).createInitialMessagesWithMemory();

      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('You are a test agent');

      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('This is what you remember');
      expect(messages[1].content).toContain('"name": "Alice"');

      expect(messages[2].role).toBe('user');
      expect(messages[2].content).toBe('Process test events.');
    });

    it('should include current memory state', () => {
      memory.mergeToWorkingMemory({ user: { age: 30 } });
      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages = (agent as any).createInitialMessagesWithMemory();

      const memoryMessage = messages[1].content;
      expect(memoryMessage).toContain('"name": "Alice"');
      expect(memoryMessage).toContain('"age": 30');
    });
  });

  describe('generateResponseWithMemory', () => {
    it('should generate response and update memory', async () => {
      const newMemory = { user: { age: 30, city: 'NYC' } };
      gateway.setMockResponse({
        text: 'Hello Alice',
        memory: newMemory,
      });

      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (agent as any).generateResponseWithMemory('Test message');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const response = result.value as TestResponse;
        expect(response.text).toBe('Hello Alice');
        // Memory should be updated
        const updatedMemory = memory.getWorkingMemory();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((updatedMemory as any).user).toEqual({
          name: 'Alice',
          age: 30,
          city: 'NYC',
        });
      }
    });

    it('should return response without memory field', async () => {
      gateway.setMockResponse({
        text: 'Response text',
        memory: { newKey: 'value' },
      });

      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (agent as any).generateResponseWithMemory('Test');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ text: 'Response text' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((result.value as any).memory).toBeUndefined();
      }
    });

    it('should handle response without memory field', async () => {
      gateway.setMockResponse({
        text: 'Response',
      });

      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (agent as any).generateResponseWithMemory('Test');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const response = result.value as TestResponse;
        expect(response.text).toBe('Response');
      }
    });

    it('should deep merge memory updates', async () => {
      memory = new SharedWorkingMemory({
        user: {
          name: 'Bob',
          preferences: {
            theme: 'dark',
          },
        },
      });

      gateway.setMockResponse({
        text: 'Updated',
        memory: {
          user: {
            preferences: {
              language: 'en',
            },
          },
        },
      });

      const agent = new TestAgent(broker, memory);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (agent as any).generateResponseWithMemory('Test');

      const updatedMemory = memory.getWorkingMemory();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(updatedMemory as any).toEqual({
        user: {
          name: 'Bob',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
      });
    });
  });

  describe('receiveEventAsync', () => {
    it('should process test events', async () => {
      gateway.setMockResponse({
        text: 'Processed',
        memory: {},
      });

      const agent = new TestAgent(broker, memory);
      const event: TestEvent = {
        type: 'TestEvent',
        source: 'test',
        message: 'Hello',
      };

      const result = await agent.receiveEventAsync(event);
      expect(isOk(result)).toBe(true);
    });

    it('should ignore non-test events', async () => {
      const agent = new TestAgent(broker, memory);
      const event: Event = {
        type: 'OtherEvent',
        source: 'test',
      };

      const result = await agent.receiveEventAsync(event);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    it('should preserve memory across multiple events', async () => {
      const agent = new TestAgent(broker, memory);

      // First event
      gateway.setMockResponse({
        text: 'First response',
        memory: { count: 1 },
      });
      await agent.receiveEventAsync({
        type: 'TestEvent',
        source: 'test',
        message: 'First',
      } as TestEvent);

      expect(memory.getWorkingMemory()).toEqual({
        user: { name: 'Alice' },
        count: 1,
      });

      // Second event
      gateway.setMockResponse({
        text: 'Second response',
        memory: { count: 2 },
      });
      await agent.receiveEventAsync({
        type: 'TestEvent',
        source: 'test',
        message: 'Second',
      } as TestEvent);

      expect(memory.getWorkingMemory()).toEqual({
        user: { name: 'Alice' },
        count: 2,
      });
    });
  });
});
