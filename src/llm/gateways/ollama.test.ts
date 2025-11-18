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
});
