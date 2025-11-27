/**
 * Tests for OpenAI Gateway
 */

import { OpenAIGateway } from './openai';
import { MessageRole, ToolCall } from '../models';
import { isOk, isErr } from '../../error';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OpenAIGateway', () => {
  let gateway: OpenAIGateway;

  beforeEach(() => {
    mockFetch.mockClear();
    gateway = new OpenAIGateway('test-api-key', 'https://api.openai.com/v1');
  });

  describe('constructor', () => {
    it('should use provided API key', () => {
      const gw = new OpenAIGateway('my-key');
      // Gateway is created without error
      expect(gw).toBeInstanceOf(OpenAIGateway);
    });

    it('should use provided base URL', () => {
      const gw = new OpenAIGateway('my-key', 'https://custom.api.com');
      expect(gw).toBeInstanceOf(OpenAIGateway);
    });
  });

  describe('generate', () => {
    it('should make a successful completion request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        }),
      });

      const result = await gateway.generate('gpt-4', [
        { role: MessageRole.User, content: 'Hello' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.content).toBe('Hello! How can I help you?');
        expect(result.value.finishReason).toBe('stop');
        expect(result.value.usage?.totalTokens).toBe(18);
      }
    });

    it('should handle tool calls in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"location":"Paris"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
        }),
      });

      const result = await gateway.generate('gpt-4', [
        { role: MessageRole.User, content: 'Weather?' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toolCalls).toHaveLength(1);
        const toolCalls = result.value.toolCalls ?? [];
        expect(toolCalls[0].function.name).toBe('get_weather');
      }
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const result = await gateway.generate('gpt-4', [
        { role: MessageRole.User, content: 'Hello' },
      ]);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('401');
      }
    });

    it('should adapt parameters for reasoning models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await gateway.generate('o1', [{ role: MessageRole.User, content: 'Hello' }], {
        maxTokens: 1000,
      });

      // Verify the request was made with max_completion_tokens instead of max_tokens
      expect(mockFetch).toHaveBeenCalled();
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.max_completion_tokens).toBe(1000);
      expect(requestBody.max_tokens).toBeUndefined();
    });

    it('should include tools in request when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      await gateway.generate(
        'gpt-4',
        [{ role: MessageRole.User, content: 'Hello' }],
        undefined,
        tools
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tools).toHaveLength(1);
      expect(requestBody.tools[0].function.name).toBe('test_tool');
    });
  });

  describe('listModels', () => {
    it('should return list of available models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }, { id: 'gpt-4o' }],
        }),
      });

      const result = await gateway.listModels();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toContain('gpt-4');
        expect(result.value).toContain('gpt-3.5-turbo');
        expect(result.value.length).toBe(3);
      }
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await gateway.listModels();

      expect(isErr(result)).toBe(true);
    });
  });

  describe('calculateEmbeddings', () => {
    it('should return embeddings for text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              embedding: [0.1, 0.2, 0.3, 0.4],
              index: 0,
            },
          ],
        }),
      });

      const result = await gateway.calculateEmbeddings('test text');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(4);
      }
    });

    it('should use specified model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2], index: 0 }],
        }),
      });

      await gateway.calculateEmbeddings('test', 'text-embedding-3-small');

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.model).toBe('text-embedding-3-small');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid model',
      });

      const result = await gateway.calculateEmbeddings('test');

      expect(isErr(result)).toBe(true);
    });
  });

  describe('generateStream', () => {
    it('should stream content chunks', async () => {
      const streamData = [
        'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
        'data: [DONE]\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (index < streamData.length) {
                return { done: false, value: encoder.encode(streamData[index++]) };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      });

      const chunks: string[] = [];
      for await (const chunkResult of gateway.generateStream('gpt-4', [
        { role: MessageRole.User, content: 'Hello' },
      ])) {
        if (isOk(chunkResult) && chunkResult.value.content) {
          chunks.push(chunkResult.value.content);
        }
      }

      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('should handle streaming tool calls', async () => {
      const streamData = [
        'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"loc"}}]},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ation\\":\\"Paris\\"}"}}]},"finish_reason":null}]}\n',
        'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n',
        'data: [DONE]\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (index < streamData.length) {
                return { done: false, value: encoder.encode(streamData[index++]) };
              }
              return { done: true, value: undefined };
            },
          }),
        },
      });

      let toolCalls: ToolCall[] = [];
      for await (const chunkResult of gateway.generateStream('gpt-4', [
        { role: MessageRole.User, content: 'Weather?' },
      ])) {
        if (isOk(chunkResult) && chunkResult.value.toolCalls) {
          toolCalls = chunkResult.value.toolCalls;
        }
      }

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function.name).toBe('get_weather');
    });

    it('should reject streaming for reasoning models', async () => {
      const chunks: unknown[] = [];
      for await (const chunkResult of gateway.generateStream('o1', [
        { role: MessageRole.User, content: 'Hello' },
      ])) {
        chunks.push(chunkResult);
      }

      expect(chunks).toHaveLength(1);
      expect(isErr(chunks[0] as never)).toBe(true);
    });
  });
});
