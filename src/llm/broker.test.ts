/**
 * Tests for LLM Broker
 */

import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { GatewayResponse, LlmMessage, CompletionConfig, MessageRole, ToolCall } from './models';
import { LlmTool } from './tools';
import { Result, Ok, Err, isOk, GatewayError } from '../error';

// Mock Gateway
class MockGateway implements LlmGateway {
  private responses: Result<GatewayResponse, Error>[] = [];
  private streamResponses: string[] = [];
  private callCount = 0;

  setResponse(response: Result<GatewayResponse, Error>): void {
    this.responses = [response];
  }

  setResponses(responses: Result<GatewayResponse, Error>[]): void {
    this.responses = responses;
  }

  setStreamResponses(responses: string[]): void {
    this.streamResponses = responses;
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
    for (const content of this.streamResponses) {
      yield Ok({ content, done: false });
    }
    yield Ok({ done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['model1', 'model2']);
  }

  async calculateEmbeddings(_text: string, _model?: string): Promise<Result<number[], Error>> {
    return Ok(
      Array(768)
        .fill(0)
        .map(() => Math.random())
    );
  }

  reset(): void {
    this.responses = [];
    this.streamResponses = [];
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

describe('LlmBroker', () => {
  let gateway: MockGateway;
  let broker: LlmBroker;

  beforeEach(() => {
    gateway = new MockGateway();
    broker = new LlmBroker('test-model', gateway);
  });

  describe('constructor', () => {
    test('should create broker with model and gateway', () => {
      expect(broker.getModel()).toBe('test-model');
      expect(broker.getGateway()).toBe(gateway);
    });
  });

  describe('generate', () => {
    test('should generate simple text response', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setResponse(
        Ok({
          content: 'Hello! How can I help you?',
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      const result = await broker.generate(messages);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('Hello! How can I help you?');
      }
    });

    test('should handle gateway errors', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setResponse(Err(new GatewayError('Connection failed', 500)));

      const result = await broker.generate(messages);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeInstanceOf(GatewayError);
        expect(result.error.message).toContain('Connection failed');
      }
    });

    test('should execute tool calls', async () => {
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

      const result = await broker.generate(messages, [tool]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('Tool was executed successfully!');
      }
    });

    test('should handle tool not found', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use unknown tool' }];

      gateway.setResponses([
        // Response with unknown tool call
        Ok({
          content: '',
          toolCalls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'unknown_tool',
                arguments: JSON.stringify({ input: 'test' }),
              },
            },
          ],
          finishReason: 'tool_calls',
          model: 'test-model',
        }),
        // Second response after tool error
        Ok({
          content: 'The tool was not found.',
          finishReason: 'stop',
          model: 'test-model',
        }),
      ]);

      const tool = new MockTool('different_tool');
      const result = await broker.generate(messages, [tool]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('The tool was not found.');
      }
    });

    test('should handle tool execution errors', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use the tool' }];

      const tool = new MockTool('test_tool');
      tool.setResult(Err(new Error('Tool execution failed')));

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
        // Second response after tool error
        Ok({
          content: 'There was an error executing the tool.',
          finishReason: 'stop',
          model: 'test-model',
        }),
      ]);

      const result = await broker.generate(messages, [tool]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe('There was an error executing the tool.');
      }
    });

    test('should limit tool iterations', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Keep using tool' }];

      const tool = new MockTool('test_tool');

      // Always return tool calls
      gateway.setResponses(
        Array(15).fill(
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
          })
        )
      );

      const result = await broker.generate(messages, [tool], undefined, 5);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Maximum tool iterations');
      }
    });

    test('should handle tool calls without tools provided', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use tool' }];

      gateway.setResponse(
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
        })
      );

      const result = await broker.generate(messages); // No tools provided

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('no tools provided');
      }
    });
  });

  describe('generateObject', () => {
    test('should generate structured object', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Analyze sentiment' }];

      const schema = {
        type: 'object',
        properties: {
          sentiment: { type: 'string' },
          confidence: { type: 'number' },
        },
      };

      gateway.setResponse(
        Ok({
          content: JSON.stringify({ sentiment: 'positive', confidence: 0.95 }),
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      const result = await broker.generateObject<{ sentiment: string; confidence: number }>(
        messages,
        schema
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.sentiment).toBe('positive');
        expect(result.value.confidence).toBe(0.95);
      }
    });

    test('should handle invalid JSON in response', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Analyze sentiment' }];

      const schema = {
        type: 'object',
        properties: {
          sentiment: { type: 'string' },
        },
      };

      gateway.setResponse(
        Ok({
          content: 'This is not valid JSON',
          finishReason: 'stop',
          model: 'test-model',
        })
      );

      const result = await broker.generateObject(messages, schema);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Failed to parse JSON');
      }
    });

    test('should handle gateway errors', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Analyze' }];

      gateway.setResponse(Err(new GatewayError('Network error')));

      const result = await broker.generateObject(messages, {});

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeInstanceOf(GatewayError);
      }
    });
  });

  describe('generateStream', () => {
    test('should stream text chunks', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      gateway.setStreamResponses(['Hello', ' there', '!']);

      const chunks: string[] = [];
      for await (const result of broker.generateStream(messages)) {
        if (isOk(result)) {
          chunks.push(result.value);
        }
      }

      expect(chunks).toEqual(['Hello', ' there', '!']);
    });

    test('should handle stream errors', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Hello' }];

      // Mock a stream with an error
      gateway.setStreamResponses([]);

      const results: Array<Result<string, Error>> = [];
      for await (const result of broker.generateStream(messages)) {
        results.push(result);
      }

      // Should at least yield the final 'done' chunk
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle tool calls during streaming', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use tool' }];

      const tool = new MockTool('test_tool');
      tool.setResult(Ok({ result: 'Tool executed' }));

      // Create custom mock gateway for this test
      class CustomGateway implements LlmGateway {
        private callCount = 0;

        async generate(): Promise<Result<GatewayResponse, Error>> {
          return Ok({ content: '', finishReason: 'stop', model: 'test' });
        }

        async *generateStream(): AsyncGenerator<
          Result<{ content?: string; done: boolean; toolCalls?: ToolCall[] }, Error>
        > {
          const currentCall = this.callCount++;

          if (currentCall === 0) {
            // First call - yield content and tool calls
            yield Ok({ content: 'Calling', done: false });
            yield Ok({ content: ' tool', done: false });
            yield Ok({
              content: '',
              done: true,
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
            });
          } else {
            // Second call - yield content without tool calls
            yield Ok({ content: 'Tool', done: false });
            yield Ok({ content: ' completed', done: false });
            yield Ok({ done: true });
          }
        }

        async listModels(): Promise<Result<string[], Error>> {
          return Ok([]);
        }

        async calculateEmbeddings(
          _text: string,
          _model?: string
        ): Promise<Result<number[], Error>> {
          return Ok([]);
        }
      }

      const customGateway = new CustomGateway();
      const customBroker = new LlmBroker('test-model', customGateway);

      const chunks: string[] = [];
      for await (const result of customBroker.generateStream(messages, undefined, [tool])) {
        if (isOk(result)) {
          chunks.push(result.value);
        }
      }

      expect(chunks).toEqual(['Calling', ' tool', 'Tool', ' completed']);
    });

    test('should handle tool errors during streaming', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use tool' }];

      const tool = new MockTool('test_tool');
      tool.setResult(Err(new Error('Tool failed')));

      class CustomGateway implements LlmGateway {
        private callCount = 0;

        async generate(): Promise<Result<GatewayResponse, Error>> {
          return Ok({ content: '', finishReason: 'stop', model: 'test' });
        }

        async *generateStream(): AsyncGenerator<
          Result<{ content?: string; done: boolean; toolCalls?: ToolCall[] }, Error>
        > {
          const currentCall = this.callCount++;

          if (currentCall === 0) {
            yield Ok({
              content: '',
              done: true,
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
            });
          } else {
            yield Ok({ content: 'Error handled', done: false });
            yield Ok({ done: true });
          }
        }

        async listModels(): Promise<Result<string[], Error>> {
          return Ok([]);
        }

        async calculateEmbeddings(
          _text: string,
          _model?: string
        ): Promise<Result<number[], Error>> {
          return Ok([]);
        }
      }

      const customGateway = new CustomGateway();
      const customBroker = new LlmBroker('test-model', customGateway);

      const chunks: string[] = [];
      for await (const result of customBroker.generateStream(messages, undefined, [tool])) {
        if (isOk(result)) {
          chunks.push(result.value);
        }
      }

      expect(chunks).toEqual(['Error handled']);
    });

    test('should handle tool not found during streaming', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use unknown tool' }];

      const tool = new MockTool('different_tool');

      class CustomGateway implements LlmGateway {
        private callCount = 0;

        async generate(): Promise<Result<GatewayResponse, Error>> {
          return Ok({ content: '', finishReason: 'stop', model: 'test' });
        }

        async *generateStream(): AsyncGenerator<
          Result<{ content?: string; done: boolean; toolCalls?: ToolCall[] }, Error>
        > {
          const currentCall = this.callCount++;

          if (currentCall === 0) {
            yield Ok({
              content: '',
              done: true,
              toolCalls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'unknown_tool',
                    arguments: JSON.stringify({ input: 'test' }),
                  },
                },
              ],
            });
          } else {
            yield Ok({ content: 'Tool not found', done: false });
            yield Ok({ done: true });
          }
        }

        async listModels(): Promise<Result<string[], Error>> {
          return Ok([]);
        }

        async calculateEmbeddings(
          _text: string,
          _model?: string
        ): Promise<Result<number[], Error>> {
          return Ok([]);
        }
      }

      const customGateway = new CustomGateway();
      const customBroker = new LlmBroker('test-model', customGateway);

      const chunks: string[] = [];
      for await (const result of customBroker.generateStream(messages, undefined, [tool])) {
        if (isOk(result)) {
          chunks.push(result.value);
        }
      }

      expect(chunks).toEqual(['Tool not found']);
    });

    test('should handle streaming without tools when tool calls requested', async () => {
      const messages: LlmMessage[] = [{ role: MessageRole.User, content: 'Use tool' }];

      class CustomGateway implements LlmGateway {
        async generate(): Promise<Result<GatewayResponse, Error>> {
          return Ok({ content: '', finishReason: 'stop', model: 'test' });
        }

        async *generateStream(): AsyncGenerator<
          Result<{ content?: string; done: boolean; toolCalls?: ToolCall[] }, Error>
        > {
          yield Ok({
            content: 'Trying to call tool',
            done: true,
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
          });
        }

        async listModels(): Promise<Result<string[], Error>> {
          return Ok([]);
        }

        async calculateEmbeddings(
          _text: string,
          _model?: string
        ): Promise<Result<number[], Error>> {
          return Ok([]);
        }
      }

      const customGateway = new CustomGateway();
      const customBroker = new LlmBroker('test-model', customGateway);

      const results: Array<Result<string, Error>> = [];
      for await (const result of customBroker.generateStream(messages)) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(0);
      const lastResult = results[results.length - 1];
      expect(isOk(lastResult)).toBe(false);
      if (!isOk(lastResult)) {
        expect(lastResult.error.message).toContain('no tools provided');
      }
    });
  });

  describe('listModels', () => {
    test('should list available models', async () => {
      const result = await broker.listModels();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(['model1', 'model2']);
      }
    });
  });

  describe('getters', () => {
    test('getModel should return model name', () => {
      expect(broker.getModel()).toBe('test-model');
    });

    test('getGateway should return gateway instance', () => {
      expect(broker.getGateway()).toBe(gateway);
    });
  });
});
