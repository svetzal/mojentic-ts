/**
 * Tests for AsyncLlmAgent
 */

import { AsyncLlmAgent } from '../async-llm-agent';
import { Event } from '../event';
import { LlmBroker } from '../../llm/broker';
import { LlmGateway } from '../../llm/gateway';
import { GatewayResponse, StreamChunk } from '../../llm/models';
import { Result, Ok, isOk } from '../../error';

// Mock gateway for testing
class MockGateway implements LlmGateway {
  private mockResponse: string = '{"result": "test"}';

  setMockResponse(response: string): void {
    this.mockResponse = response;
  }

  async generate(): Promise<Result<GatewayResponse, Error>> {
    return Ok({
      content: this.mockResponse,
      finishReason: 'stop',
    });
  }

  async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
    yield Ok({ content: this.mockResponse, done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['test-model']);
  }

  async calculateEmbeddings(): Promise<Result<number[], Error>> {
    return Ok([0.1, 0.2, 0.3]);
  }
}

// Test agent implementation
interface TestEvent extends Event {
  type: 'TestEvent';
  data: string;
}

interface TestResponse extends Event {
  type: 'ResponseEvent';
  result: string;
  data: string;
}

class TestAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour: 'You are a test agent',
      responseModel: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
        required: ['result'],
      },
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type === 'TestEvent') {
      const result = await this.generateResponse<{ result: string }>('test input');
      if (isOk(result)) {
        return Ok([
          {
            type: 'ResponseEvent',
            source: 'TestAgent',
            correlationId: event.correlationId,
            data: result.value.result,
          } as Event,
        ]);
      }
    }
    return Ok([]);
  }
}

describe('AsyncLlmAgent', () => {
  let gateway: MockGateway;
  let broker: LlmBroker;
  let agent: TestAgent;

  beforeEach(() => {
    gateway = new MockGateway();
    broker = new LlmBroker('test-model', gateway);
    agent = new TestAgent(broker);
  });

  describe('constructor', () => {
    it('should initialize with required config', () => {
      expect(agent).toBeDefined();
    });

    it('should accept optional tools', () => {
      const agentWithTools = new TestAgent(broker);
      expect(agentWithTools).toBeDefined();
    });
  });

  describe('generateResponse', () => {
    it('should generate structured response when responseModel is set', async () => {
      gateway.setMockResponse('{"result": "success"}');

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        correlationId: 'test-123',
        data: 'test',
      };

      const result = await agent.receiveEventAsync(event);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
        expect((result.value[0] as TestResponse).data).toBe('success');
      }
    });

    it('should handle LLM errors gracefully', async () => {
      const errorGateway: LlmGateway = {
        async generate(): Promise<Result<GatewayResponse, Error>> {
          return { ok: false, error: new Error('LLM error') };
        },
        async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
          yield { ok: false, error: new Error('LLM error') };
        },
        async listModels(): Promise<Result<string[], Error>> {
          return Ok(['test']);
        },
        async calculateEmbeddings(): Promise<Result<number[], Error>> {
          return Ok([]);
        },
      };

      const errorBroker = new LlmBroker('test', errorGateway);
      const errorAgent = new TestAgent(errorBroker);

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        correlationId: 'test-123',
        data: 'test',
      };

      const result = await errorAgent.receiveEventAsync(event);

      // Should return empty array when LLM fails
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('receiveEventAsync', () => {
    it('should process matching events', async () => {
      gateway.setMockResponse('{"result": "processed"}');

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        correlationId: 'test-123',
        data: 'test data',
      };

      const result = await agent.receiveEventAsync(event);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
      }
    });

    it('should ignore non-matching events', async () => {
      const event = {
        source: 'TestSource',
        correlationId: 'test-123',
      } as Event;

      const result = await agent.receiveEventAsync(event);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should preserve correlation ID in output events', async () => {
      gateway.setMockResponse('{"result": "test"}');

      const correlationId = 'test-correlation-123';
      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        correlationId,
        data: 'test',
      };

      const result = await agent.receiveEventAsync(event);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value[0].correlationId).toBe(correlationId);
      }
    });
  });

  describe('addTool', () => {
    it('should allow adding tools after construction', () => {
      const mockTool = {
        name: () => 'test-tool',
        descriptor: () => ({ name: 'test-tool', description: 'A test tool' }),
        run: async () => Ok({ result: 'tool result' }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test tool mock with simplified interface
      agent.addTool(mockTool as any);
      // No error means success - tools are protected so we can't inspect them directly
    });
  });

  describe('integration', () => {
    it('should work with text-only mode when no responseModel is set', async () => {
      interface TextResponseEvent extends Event {
        type: 'TextResponse';
        text: string;
      }

      class TextAgent extends AsyncLlmAgent {
        constructor(broker: LlmBroker) {
          super({
            broker,
            behaviour: 'You are a text agent',
            // No responseModel
          });
        }

        async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
          if (event.type === 'TestEvent') {
            const result = await this.generateResponse<string>('test');
            if (isOk(result)) {
              return Ok([
                {
                  type: 'TextResponse',
                  source: 'TextAgent',
                  correlationId: event.correlationId,
                  text: result.value,
                } as Event,
              ]);
            }
          }
          return Ok([]);
        }
      }

      gateway.setMockResponse('Plain text response');
      const textAgent = new TextAgent(broker);

      const event: TestEvent = {
        type: 'TestEvent',
        source: 'TestSource',
        data: 'test',
      };

      const result = await textAgent.receiveEventAsync(event);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
        expect((result.value[0] as TextResponseEvent).text).toBe('Plain text response');
      }
    });
  });
});
