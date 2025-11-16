/**
 * Tests for LLM Broker Tracer Integration
 */

import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { GatewayResponse, LlmMessage, CompletionConfig, MessageRole } from './models';
import { LlmTool } from './tools';
import { Result, Ok, Err, isOk, GatewayError } from '../error';
import {
  TracerSystem,
  LLMCallTracerEvent,
  LLMResponseTracerEvent,
  ToolCallTracerEvent,
} from '../tracer';

// Mock Gateway
class MockGateway implements LlmGateway {
  private responses: Result<GatewayResponse, Error>[] = [];
  private callCount = 0;

  setResponse(response: Result<GatewayResponse, Error>): void {
    this.responses = [response];
  }

  setResponses(responses: Result<GatewayResponse, Error>[]): void {
    this.responses = responses;
  }

  async generate(
    _model: string,
    _messages: LlmMessage[],
    _config?: CompletionConfig,
    _tools?: Array<{
      type: string;
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>
  ): Promise<Result<GatewayResponse, Error>> {
    if (this.callCount >= this.responses.length) {
      return Err(new GatewayError('No more mock responses'));
    }
    return this.responses[this.callCount++];
  }

  async *generateStream(
    _model: string,
    _messages: LlmMessage[],
    _config?: CompletionConfig,
    _tools?: Array<{
      type: string;
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>
  ): AsyncGenerator<Result<{ content?: string; done: boolean }, Error>> {
    yield Ok({ content: 'test', done: false });
    yield Ok({ done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['model1']);
  }

  async calculateEmbeddings(_text: string, _model?: string): Promise<Result<number[], Error>> {
    return Ok([0.1, 0.2]);
  }

  reset(): void {
    this.responses = [];
    this.callCount = 0;
  }
}

// Mock Tool
class MockTool implements LlmTool {
  private mockResult: Result<Record<string, unknown>, Error> = Ok({ result: 'mock tool result' });

  constructor(private readonly toolName: string = 'mock_tool') {}

  setResult(result: Result<Record<string, unknown>, Error>): void {
    this.mockResult = result;
  }

  name(): string {
    return this.toolName;
  }

  descriptor() {
    return {
      type: 'function' as const,
      function: {
        name: this.toolName,
        description: 'A mock tool for testing',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
      },
    };
  }

  async run(_args: Record<string, unknown>): Promise<Result<Record<string, unknown>, Error>> {
    return this.mockResult;
  }
}

describe('LlmBroker Tracer Integration', () => {
  let gateway: MockGateway;
  let tracer: TracerSystem;
  let broker: LlmBroker;

  beforeEach(() => {
    gateway = new MockGateway();
    tracer = new TracerSystem();
    broker = new LlmBroker('test-model', gateway, tracer);
  });

  describe('generate with tracer', () => {
    test('should record LLM call and response events', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setResponse(
        Ok({
          content: 'Hello! How can I help you?',
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      const correlationId = 'test-correlation-id';
      await broker.generate(messages, undefined, undefined, 10, correlationId);

      // Verify events were recorded
      const events = tracer.getEvents();
      expect(events.length).toBe(2);

      // Verify LLM call event
      const llmCallEvents = tracer.getEvents({ eventType: LLMCallTracerEvent });
      expect(llmCallEvents.length).toBe(1);
      const llmCallEvent = llmCallEvents[0] as LLMCallTracerEvent;
      expect(llmCallEvent.model).toBe('test-model');
      expect(llmCallEvent.correlationId).toBe(correlationId);

      // Verify LLM response event
      const llmResponseEvents = tracer.getEvents({ eventType: LLMResponseTracerEvent });
      expect(llmResponseEvents.length).toBe(1);
      const llmResponseEvent = llmResponseEvents[0] as LLMResponseTracerEvent;
      expect(llmResponseEvent.model).toBe('test-model');
      expect(llmResponseEvent.content).toBe('Hello! How can I help you?');
      expect(llmResponseEvent.correlationId).toBe(correlationId);
      expect(llmResponseEvent.callDurationMs).toBeGreaterThanOrEqual(0);
    });

    test('should record tool call events', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use the tool' }];
      const tool = new MockTool('test_tool');
      tool.setResult(Ok({ result: 'Tool executed successfully' }));

      gateway.setResponses([
        // First response with tool call
        Ok({
          content: '',
          toolCalls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: JSON.stringify({ input: 'test' }),
              },
            },
          ],
          finishReason: 'tool_calls',
          model: 'test-model',
        }),
        // Second response after tool execution
        Ok({
          content: 'Tool was executed successfully!',
          finishReason: 'stop',
          model: 'test-model',
        }),
      ]);

      const correlationId = 'test-correlation-id';
      await broker.generate(messages, [tool], undefined, 10, correlationId);

      // Verify all events were recorded
      const events = tracer.getEvents();
      expect(events.length).toBe(5); // 2 LLM calls, 2 LLM responses, 1 tool call

      // Verify tool call event
      const toolCallEvents = tracer.getEvents({ eventType: ToolCallTracerEvent });
      expect(toolCallEvents.length).toBe(1);
      const toolCallEvent = toolCallEvents[0] as ToolCallTracerEvent;
      expect(toolCallEvent.toolName).toBe('test_tool');
      expect(toolCallEvent.arguments).toEqual({ input: 'test' });
      expect(toolCallEvent.result).toEqual({ result: 'Tool executed successfully' });
      expect(toolCallEvent.caller).toBe('LlmBroker');
      expect(toolCallEvent.correlationId).toBe(correlationId);
      expect(toolCallEvent.callDurationMs).toBeGreaterThanOrEqual(0);
    });

    test('should use same correlationId for recursive calls', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use the tool' }];
      const tool = new MockTool('test_tool');

      gateway.setResponses([
        Ok({
          content: '',
          toolCalls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'test_tool',
                arguments: JSON.stringify({ input: 'test' }),
              },
            },
          ],
          finishReason: 'tool_calls',
          model: 'test-model',
        }),
        Ok({
          content: 'Done',
          finishReason: 'stop',
          model: 'test-model',
        }),
      ]);

      const correlationId = 'test-correlation-id';
      await broker.generate(messages, [tool], undefined, 10, correlationId);

      // All events should have the same correlationId
      const events = tracer.getEvents();
      events.forEach((event) => {
        expect(event.correlationId).toBe(correlationId);
      });
    });

    test('should generate correlationId if not provided', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setResponse(
        Ok({
          content: 'Hello!',
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      await broker.generate(messages);

      // Verify events were recorded with a generated correlationId
      const events = tracer.getEvents();
      expect(events.length).toBe(2);

      const correlationId = events[0].correlationId;
      expect(correlationId).toBeTruthy();
      expect(typeof correlationId).toBe('string');

      // All events should have the same generated correlationId
      events.forEach((event) => {
        expect(event.correlationId).toBe(correlationId);
      });
    });

    test('should not record events when tracer is disabled', async () => {
      tracer.disable();

      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setResponse(
        Ok({
          content: 'Hello!',
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      await broker.generate(messages);

      // No events should be recorded
      const events = tracer.getEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('generateObject with tracer', () => {
    test('should record LLM call and response events', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Analyze sentiment' }];

      const schema = {
        type: 'object',
        properties: {
          sentiment: { type: 'string' },
        },
      };

      gateway.setResponse(
        Ok({
          content: JSON.stringify({ sentiment: 'positive' }),
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      const correlationId = 'test-correlation-id';
      await broker.generateObject(messages, schema, undefined, correlationId);

      // Verify events were recorded
      const events = tracer.getEvents();
      expect(events.length).toBe(2);

      const llmCallEvents = tracer.getEvents({ eventType: LLMCallTracerEvent });
      expect(llmCallEvents.length).toBe(1);
      expect(llmCallEvents[0].correlationId).toBe(correlationId);

      const llmResponseEvents = tracer.getEvents({ eventType: LLMResponseTracerEvent });
      expect(llmResponseEvents.length).toBe(1);
      expect(llmResponseEvents[0].correlationId).toBe(correlationId);
    });
  });

  describe('generateStream with tracer', () => {
    test('should record LLM call and response events', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      const correlationId = 'test-correlation-id';

      const chunks: string[] = [];
      for await (const chunk of broker.generateStream(
        messages,
        undefined,
        undefined,
        correlationId
      )) {
        if (isOk(chunk)) {
          chunks.push(chunk.value);
        }
      }

      // Verify events were recorded
      const events = tracer.getEvents();
      expect(events.length).toBe(2);

      const llmCallEvents = tracer.getEvents({ eventType: LLMCallTracerEvent });
      expect(llmCallEvents.length).toBe(1);
      expect(llmCallEvents[0].correlationId).toBe(correlationId);

      const llmResponseEvents = tracer.getEvents({ eventType: LLMResponseTracerEvent });
      expect(llmResponseEvents.length).toBe(1);
      expect(llmResponseEvents[0].correlationId).toBe(correlationId);
    });
  });
});
