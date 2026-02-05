/**
 * Tests for Ollama Gateway
 */

import { OllamaGateway } from './ollama';
import { MessageRole } from '../models';
import { isOk } from '../../error';

// Mock fetch globally
global.fetch = jest.fn();

describe('OllamaGateway', () => {
  let gateway: OllamaGateway;
  const mockFetch = global.fetch as jest.Mock;

  beforeEach(() => {
    gateway = new OllamaGateway('http://localhost:11434');
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    test('should use default URL if not provided', () => {
      const defaultGateway = new OllamaGateway();
      expect(defaultGateway).toBeInstanceOf(OllamaGateway);
    });

    test('should use provided URL', () => {
      const customGateway = new OllamaGateway('http://custom:8080');
      expect(customGateway).toBeInstanceOf(OllamaGateway);
    });

    test('should use OLLAMA_HOST from env', () => {
      process.env.OLLAMA_HOST = 'http://env-host:9000';
      const envGateway = new OllamaGateway();
      expect(envGateway).toBeInstanceOf(OllamaGateway);
      delete process.env.OLLAMA_HOST;
    });
  });

  describe('generate', () => {
    test('should generate text completion', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you?',
        },
        done: true,
        prompt_eval_count: 10,
        eval_count: 20,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const result = await gateway.generate('llama2', messages);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.content).toBe('Hello! How can I help you?');
        expect(result.value.model).toBe('llama2');
        expect(result.value.usage).toEqual({
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        });
      }
    });

    test('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error occurred',
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const result = await gateway.generate('llama2', messages);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('500');
        expect(result.error.message).toContain('Server error occurred');
      }
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const result = await gateway.generate('llama2', messages);

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Network connection failed');
      }
    });

    test('should handle multimodal messages with images', async () => {
      const mockResponse = {
        model: 'llava',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'I see a cat in the image.',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [
        {
          role: MessageRole.User,
          content: [
            { type: 'text' as const, text: 'What do you see?' },
            {
              type: 'image_url' as const,
              image_url: { url: 'data:image/jpeg;base64,ABC123' },
            },
          ],
        },
      ];

      const result = await gateway.generate('llava', messages);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.content).toBe('I see a cat in the image.');
      }

      // Verify the request body includes the image
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe('What do you see?');
      expect(body.messages[0].images).toEqual(['ABC123']);
    });

    test('should handle multiple images in one message', async () => {
      const mockResponse = {
        model: 'llava',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'I see multiple items.',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [
        {
          role: MessageRole.User,
          content: [
            { type: 'text' as const, text: 'Compare these images:' },
            {
              type: 'image_url' as const,
              image_url: { url: 'data:image/jpeg;base64,IMAGE1DATA' },
            },
            {
              type: 'image_url' as const,
              image_url: { url: 'data:image/png;base64,IMAGE2DATA' },
            },
          ],
        },
      ];

      const result = await gateway.generate('llava', messages);

      expect(isOk(result)).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].images).toEqual(['IMAGE1DATA', 'IMAGE2DATA']);
    });

    test('should handle images with non-data-uri URLs', async () => {
      const mockResponse = {
        model: 'llava',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Image analyzed.',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [
        {
          role: MessageRole.User,
          content: [
            { type: 'text' as const, text: 'Analyze this:' },
            {
              type: 'image_url' as const,
              image_url: { url: 'RAWBASE64DATA' },
            },
          ],
        },
      ];

      const result = await gateway.generate('llava', messages);

      expect(isOk(result)).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].images).toEqual(['RAWBASE64DATA']);
    });

    test('should pass configuration options', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        stop: ['STOP'],
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"temperature":0.7'),
        })
      );
    });

    test('should pass numPredict parameter', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        numPredict: 150,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"num_predict":150'),
        })
      );
    });

    test('should prioritize numPredict over maxTokens', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        maxTokens: 100,
        numPredict: 200,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.num_predict).toBe(200);
    });

    test('should fallback to maxTokens when numPredict not provided', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        maxTokens: 100,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.num_predict).toBe(100);
    });

    test('should pass topK parameter', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        topK: 40,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.top_k).toBe(40);
    });

    test('should pass numCtx parameter', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        numCtx: 4096,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.num_ctx).toBe(4096);
    });

    test('should pass multiple configuration parameters together', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const config = {
        temperature: 0.8,
        topP: 0.95,
        topK: 50,
        numCtx: 8192,
        numPredict: 256,
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.options.temperature).toBe(0.8);
      expect(body.options.top_p).toBe(0.95);
      expect(body.options.top_k).toBe(50);
      expect(body.options.num_ctx).toBe(8192);
      expect(body.options.num_predict).toBe(256);
    });

    test('should handle structured output with schema', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '{"sentiment":"positive","confidence":0.95}',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Analyze sentiment' }];

      const schema = {
        type: 'object',
        properties: {
          sentiment: { type: 'string' },
          confidence: { type: 'number' },
        },
      };

      const config = {
        responseFormat: {
          type: 'json_object' as const,
          schema,
        },
      };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          body: expect.stringContaining('"format":{'),
        })
      );
    });

    test('should handle tool calls in response', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"Tokyo"}',
              },
            },
          ],
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'What is the weather in Tokyo?' }];

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object' },
          },
        },
      ];

      const result = await gateway.generate('llama2', messages, undefined, tools);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.toolCalls).toHaveLength(1);
        expect(result.value.toolCalls?.[0].function.name).toBe('get_weather');
      }
    });

    test('should add think parameter when reasoningEffort is set', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'After careful consideration, the answer is 42.',
          thinking: 'Let me think about this problem step by step...',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Think carefully' }];
      const config = { reasoningEffort: 'high' as const };

      const result = await gateway.generate('llama2', messages, config);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.content).toBe('After careful consideration, the answer is 42.');
        expect(result.value.thinking).toBe('Let me think about this problem step by step...');
      }

      // Verify think parameter was included in request
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.think).toBe(true);
    });

    test('should not add think parameter when reasoningEffort is not set', async () => {
      const mockResponse = {
        model: 'llama2',
        created_at: '2023-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Simple answer.',
        },
        done: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Quick question' }];

      const result = await gateway.generate('llama2', messages);

      expect(isOk(result)).toBe(true);

      // Verify think parameter was NOT included in request
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.think).toBeUndefined();
    });
  });

  describe('listModels', () => {
    test('should list available models', async () => {
      const mockResponse = {
        models: [{ name: 'llama2' }, { name: 'mistral' }, { name: 'codellama' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await gateway.listModels();

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(['llama2', 'mistral', 'codellama']);
      }

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    test('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const result = await gateway.listModels();

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('503');
      }
    });

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await gateway.listModels();

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Connection refused');
      }
    });
  });

  describe('generateStream', () => {
    test('should stream response chunks', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'llama2',
                    created_at: '2023-01-01T00:00:00Z',
                    message: { role: 'assistant', content: 'Hello' },
                    done: false,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'llama2',
                    created_at: '2023-01-01T00:00:00Z',
                    message: { role: 'assistant', content: ' world' },
                    done: false,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    model: 'llama2',
                    created_at: '2023-01-01T00:00:00Z',
                    message: { role: 'assistant', content: '!' },
                    done: true,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const chunks: string[] = [];
      for await (const result of gateway.generateStream('llama2', messages)) {
        if (isOk(result) && result.value.content) {
          chunks.push(result.value.content);
        }
      }

      expect(chunks).toEqual(['Hello', ' world', '!']);
    });

    test('should handle HTTP errors in stream', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error',
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const errors: Error[] = [];
      for await (const result of gateway.generateStream('llama2', messages)) {
        if (!isOk(result)) {
          errors.push(result.error);
        }
      }

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('500');
    });

    test('should handle missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      });

      const messages = [{ role: MessageRole.User, content: 'Hello' }];

      const errors: Error[] = [];
      for await (const result of gateway.generateStream('llama2', messages)) {
        if (!isOk(result)) {
          errors.push(result.error);
        }
      }

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('No response body');
    });
  });

  describe('calculateEmbeddings', () => {
    test('should calculate embeddings for text', async () => {
      const mockEmbeddings = Array(768)
        .fill(0)
        .map(() => Math.random());

      const mockResponse = {
        embedding: mockEmbeddings,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const text = 'Hello, world!';
      const result = await gateway.calculateEmbeddings(text);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockEmbeddings);
        expect(result.value.length).toBe(768);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: text,
          }),
        })
      );
    });

    test('should use custom model for embeddings', async () => {
      const mockEmbeddings = Array(384)
        .fill(0)
        .map(() => Math.random());

      const mockResponse = {
        embedding: mockEmbeddings,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const text = 'Test text';
      const customModel = 'mxbai-embed-large';
      const result = await gateway.calculateEmbeddings(text, customModel);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockEmbeddings);
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/embeddings',
        expect.objectContaining({
          body: expect.stringContaining(`"model":"${customModel}"`),
        })
      );
    });

    test('should handle API errors when calculating embeddings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found',
      });

      const result = await gateway.calculateEmbeddings('Test text');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('404');
        expect(result.error.message).toContain('Model not found');
      }
    });

    test('should handle network errors when calculating embeddings', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await gateway.calculateEmbeddings('Test text');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Network timeout');
      }
    });

    test('should handle empty text', async () => {
      const mockEmbeddings = Array(768)
        .fill(0)
        .map(() => Math.random());

      const mockResponse = {
        embedding: mockEmbeddings,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await gateway.calculateEmbeddings('');

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(mockEmbeddings);
      }
    });

    test('should handle long text', async () => {
      const longText = 'Lorem ipsum '.repeat(1000);
      const mockEmbeddings = Array(768)
        .fill(0)
        .map(() => Math.random());

      const mockResponse = {
        embedding: mockEmbeddings,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await gateway.calculateEmbeddings(longText);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(768);
      }
    });
  });

  describe('pullModel', () => {
    test('should pull model with progress updates', async () => {
      const progressUpdates: Array<{
        status: string;
        digest?: string;
        total?: number;
        completed?: number;
      }> = [];

      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({ status: 'pulling manifest' }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:abc123',
                    total: 1000,
                    completed: 250,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:abc123',
                    total: 1000,
                    completed: 500,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:abc123',
                    total: 1000,
                    completed: 1000,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(JSON.stringify({ status: 'success' }) + '\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      const result = await gateway.pullModel('llama2', (progress) => {
        progressUpdates.push(progress);
      });

      expect(isOk(result)).toBe(true);
      expect(progressUpdates.length).toBe(5);
      expect(progressUpdates[0].status).toBe('pulling manifest');
      expect(progressUpdates[1].status).toBe('downloading');
      expect(progressUpdates[1].completed).toBe(250);
      expect(progressUpdates[1].total).toBe(1000);
      expect(progressUpdates[2].completed).toBe(500);
      expect(progressUpdates[3].completed).toBe(1000);
      expect(progressUpdates[4].status).toBe('success');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'llama2',
            stream: true,
          }),
        })
      );
    });

    test('should pull model without progress callback', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({ status: 'pulling manifest' }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(JSON.stringify({ status: 'success' }) + '\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      const result = await gateway.pullModel('mistral');

      expect(isOk(result)).toBe(true);
    });

    test('should handle HTTP errors when pulling model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found in registry',
      });

      const result = await gateway.pullModel('nonexistent-model');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('404');
        expect(result.error.message).toContain('Model not found in registry');
      }
    });

    test('should handle missing response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      });

      const result = await gateway.pullModel('llama2');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('No response body');
      }
    });

    test('should handle JSON parse errors in progress stream', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('invalid json\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      const result = await gateway.pullModel('llama2');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Failed to parse pull progress');
      }
    });

    test('should handle network errors when pulling model', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection lost'));

      const result = await gateway.pullModel('llama2');

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error.message).toContain('Network connection lost');
      }
    });

    test('should handle multiple progress updates with same digest', async () => {
      const progressUpdates: Array<{
        status: string;
        digest?: string;
        completed?: number;
      }> = [];

      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:layer1',
                    total: 100,
                    completed: 50,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:layer1',
                    total: 100,
                    completed: 100,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(
                  JSON.stringify({
                    status: 'downloading',
                    digest: 'sha256:layer2',
                    total: 200,
                    completed: 100,
                  }) + '\n'
                ),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      const result = await gateway.pullModel('llama2', (progress) => {
        progressUpdates.push({
          status: progress.status,
          digest: progress.digest,
          completed: progress.completed,
        });
      });

      expect(isOk(result)).toBe(true);
      expect(progressUpdates.length).toBe(3);
      expect(progressUpdates[0].digest).toBe('sha256:layer1');
      expect(progressUpdates[0].completed).toBe(50);
      expect(progressUpdates[1].digest).toBe('sha256:layer1');
      expect(progressUpdates[1].completed).toBe(100);
      expect(progressUpdates[2].digest).toBe('sha256:layer2');
      expect(progressUpdates[2].completed).toBe(100);
    });

    test('should handle empty model name', async () => {
      const mockResponse = {
        body: {
          getReader: () => ({
            read: jest
              .fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(JSON.stringify({ status: 'success' }) + '\n'),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        ...mockResponse,
      });

      await gateway.pullModel('');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          body: JSON.stringify({
            name: '',
            stream: true,
          }),
        })
      );
    });
  });
});
