/**
 * Contract tests for OMLXGateway (OMLX-2026-09.md), over a fake fetch and the captured oMLX
 * fixtures in __fixtures__/omlx.
 */

import * as fs from 'fs';
import * as path from 'path';
import { OMLXGateway } from './omlx';
import { LlmBroker } from '../broker';
import { CompletionConfig, GatewayResponse, Message, StreamChunk } from '../models';
import { LlmStreamEvent, StreamEventError } from '../stream-events';
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../tools';
import { GatewayError, Ok, Result, TimeoutError, ValidationError, isErr, isOk } from '../../error';
import { LLMResponseTracerEvent, TracerSystem } from '../../tracer';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const MODEL = 'Qwen3.8-27B-MLX-8bit';
const SCHEMA = {
  type: 'object',
  properties: { name: { type: 'string' }, age: { type: 'integer' } },
};
const WARNING = '199 omlx "json_schema grammar unavailable; enforced by prompt instructions"';
const fixturesDir = path.join(__dirname, '__fixtures__', 'omlx');

function fixture(name: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixturesDir is derived from __dirname (not user input); name is a string literal at each call site
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

function decoded(name: string): Record<string, unknown> {
  return JSON.parse(fixture(name)) as Record<string, unknown>;
}

/** The last `usage` object a streamed fixture reports, as sent. */
function streamedUsage(name: string): unknown {
  const frames = fixture(name)
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice('data: '.length)) as { usage?: unknown });
  return frames.map((frame) => frame.usage).filter((usage) => usage !== undefined)[0];
}

function respondWith(body: string, init: ResponseInit = {}): void {
  mockFetch.mockResolvedValueOnce(new Response(body, init));
}

interface FakeStream {
  wasCancelled: () => boolean;
}

/** Serve text in fixed-size chunks so frames straddle chunk boundaries. */
function serveStream(text: string, chunkSize = 17, options = { close: true }): FakeStream {
  let cancelled = false;
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
      }
      if (options.close) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  mockFetch.mockResolvedValueOnce(new Response(body));
  return { wasCancelled: () => cancelled };
}

function keepAliveFrame(content = ''): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-keepalive',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'keepalive',
    choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }],
  })}\n\n`;
}

function contentFrame(content: string): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-1',
    created: 1790679817,
    model: MODEL,
    choices: [{ index: 0, delta: { content } }],
  })}\n\n`;
}

function sentUrl(call = 0): string {
  return mockFetch.mock.calls.at(call)?.[0] as string;
}

function sentInit(call = 0): RequestInit {
  return mockFetch.mock.calls.at(call)?.[1] as RequestInit;
}

function sentBody(call = 0): Record<string, unknown> {
  return JSON.parse(sentInit(call).body as string) as Record<string, unknown>;
}

function sentHeaders(call = 0): Record<string, string> {
  return sentInit(call).headers as Record<string, string>;
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

function unwrap<T>(result: Result<T, Error>): T {
  if (!isOk(result)) throw result.error;
  return result.value;
}

function errorOf<T>(result: Result<T, Error>): Error {
  if (!isErr(result)) throw new Error('expected an error result');
  return result.error;
}

function lastEvent(events: LlmStreamEvent[]): LlmStreamEvent {
  return events[events.length - 1];
}

function errorWith(fields: Partial<StreamEventError>): unknown {
  return { type: 'error', error: expect.objectContaining(fields) };
}

class ResolveDateTool extends BaseTool {
  lastArgs?: ToolArgs;

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'resolve_date',
        description: 'Resolve a relative date',
        parameters: {
          type: 'object',
          properties: { relative: { type: 'string' } },
          required: ['relative'],
        },
      },
    };
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    this.lastArgs = args;
    return Ok({ date: '2026-09-29' });
  }
}

describe('OMLXGateway', () => {
  const originalEnv = process.env;
  let gateway: OMLXGateway;

  beforeEach(() => {
    mockFetch.mockReset();
    process.env = { ...originalEnv };
    delete process.env.OMLX_HOST;
    delete process.env.OMLX_API_KEY;
    delete process.env.OMLX_TIMEOUT;
    gateway = new OMLXGateway();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function generate(
    config?: CompletionConfig,
    model = MODEL
  ): Promise<Result<GatewayResponse, Error>> {
    return gateway.generate(model, [Message.user('hi')], config);
  }

  describe('configuration', () => {
    it('should default to localhost:8000 under /v1 with no authorization header', async () => {
      respondWith(fixture('chat_thinking.json'));

      await generate();

      expect(sentUrl()).toBe('http://localhost:8000/v1/chat/completions');
      expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should time requests out after ten minutes when no timeout is configured', async () => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      respondWith(fixture('chat_thinking.json'));

      await generate();

      expect(timeout).toHaveBeenCalledWith(600_000);
    });

    it('should read host, API key and timeout from the environment', async () => {
      process.env.OMLX_HOST = 'http://studio.local:9000';
      process.env.OMLX_API_KEY = 'local-key';
      process.env.OMLX_TIMEOUT = '1234';
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      respondWith(fixture('chat_thinking.json'));

      await new OMLXGateway().generate(MODEL, [Message.user('hi')]);

      expect(sentUrl()).toBe('http://studio.local:9000/v1/chat/completions');
      expect(sentHeaders().Authorization).toBe('Bearer local-key');
      expect(timeout).toHaveBeenCalledWith(1234);
    });

    it('should prefer explicit host, API key and timeout over the environment', async () => {
      process.env.OMLX_HOST = 'http://studio.local:9000';
      process.env.OMLX_API_KEY = 'env-key';
      process.env.OMLX_TIMEOUT = '1234';
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      respondWith(fixture('chat_thinking.json'));

      await new OMLXGateway('http://mini.local:8080', 'explicit-key', 5000).generate(MODEL, [
        Message.user('hi'),
      ]);

      expect(sentUrl()).toBe('http://mini.local:8080/v1/chat/completions');
      expect(sentHeaders().Authorization).toBe('Bearer explicit-key');
      expect(timeout).toHaveBeenCalledWith(5000);
    });

    it('should not double the slash when the host ends with one', async () => {
      respondWith(fixture('models.json'));

      await new OMLXGateway('http://studio.local:9000/').listModels();

      expect(sentUrl()).toBe('http://studio.local:9000/v1/models');
    });

    it('should send no authorization header when OMLX_API_KEY is empty', async () => {
      process.env.OMLX_API_KEY = '';
      respondWith(fixture('models.json'));

      await new OMLXGateway().listModels();

      expect(sentHeaders().Authorization).toBeUndefined();
    });

    it('should use the default timeout when OMLX_TIMEOUT is not a positive number', async () => {
      process.env.OMLX_TIMEOUT = 'soon';
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      respondWith(fixture('models.json'));

      await new OMLXGateway().listModels();

      expect(timeout).toHaveBeenCalledWith(600_000);
    });

    it('should report an expired timeout as a TimeoutError', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'));

      const error = errorOf(await new OMLXGateway(undefined, undefined, 10).listModels());

      expect(error).toBeInstanceOf(TimeoutError);
    });
  });

  describe('chat request body', () => {
    it('should send each configured field unchanged, even for a name OpenAI treats as reasoning', async () => {
      respondWith(fixture('chat_thinking.json'));
      const config: CompletionConfig = {
        temperature: 0.2,
        maxTokens: 512,
        numPredict: 99,
        numCtx: 4096,
        topP: 0.9,
        topK: 40,
        reasoningEffort: 'high',
      };

      await gateway.generate('o3-local-mlx', [Message.user('hi')], config, [
        new ResolveDateTool().descriptor(),
      ]);

      expect(sentBody()).toEqual({
        model: 'o3-local-mlx',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.2,
        max_tokens: 512,
        top_p: 0.9,
        top_k: 40,
        reasoning_effort: 'high',
        tools: [new ResolveDateTool().descriptor()],
      });
    });

    it('should send the port default temperature and max_tokens and nothing else unset', async () => {
      respondWith(fixture('chat_thinking.json'));

      await gateway.generate(MODEL, [Message.user('hi')], {}, []);

      expect(sentBody()).toEqual({
        model: MODEL,
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 1.0,
        max_tokens: 16384,
      });
    });

    it.each([
      [{ type: 'text' as const }, { type: 'text' }],
      [{ type: 'json_object' as const }, { type: 'json_object' }],
      [
        { type: 'json_object' as const, schema: SCHEMA },
        { type: 'json_schema', json_schema: { name: 'response', schema: SCHEMA } },
      ],
    ])('should forward response format %j as %j', async (responseFormat, expected) => {
      respondWith(fixture('chat_json_schema.json'));

      await generate({ responseFormat });

      expect(sentBody().response_format).toEqual(expected);
    });
  });

  describe('chat responses', () => {
    it('should map reasoning_content to thinking', async () => {
      respondWith(fixture('chat_thinking.json'));

      const response = unwrap(await generate());

      expect(response).toEqual(
        expect.objectContaining({
          content: 'hello',
          thinking:
            'We need to reply exactly: hello. User said "Reply with exactly: hello". Need final "hello". Ensure no extra.',
          finishReason: 'stop',
          model: MODEL,
          usage: { promptTokens: 57, completionTokens: 30, totalTokens: 87 },
        })
      );
    });

    it('should keep the usage oMLX reported, unchanged, in metadata', async () => {
      respondWith(fixture('chat_thinking.json'));

      const response = unwrap(await generate());

      expect(response.metadata).toEqual({
        id: 'chatcmpl-8c2b3fa6',
        created: 1790679550,
        usage: decoded('chat_thinking.json').usage,
      });
    });

    it('should have no thinking when the response has no reasoning_content', async () => {
      respondWith(fixture('chat_thinking_disabled.json'));

      const response = unwrap(await generate());

      expect(response.thinking).toBeUndefined();
    });

    it('should parse tool calls as the OpenAI gateway does', async () => {
      respondWith(fixture('chat_tool_call.json'));

      const response = unwrap(await generate());

      expect(response.toolCalls).toEqual([
        {
          id: 'call_bd4d55c2',
          type: 'function',
          function: { name: 'resolve_date', arguments: '{"relative": "today"}' },
        },
      ]);
      expect(response.finishReason).toBe('tool_calls');
    });

    it('should thread a tool call and its result back to the server', async () => {
      respondWith(fixture('chat_tool_call.json'));
      respondWith(fixture('chat_after_tool_result.json'));
      const tool = new ResolveDateTool();

      const result = await new LlmBroker(MODEL, gateway).generate(
        [Message.user("What is today's date? Use the tool.")],
        [tool]
      );

      expect(unwrap(result)).toBe("Today's date is **September 29, 2026** (2026-09-29).");
      expect(tool.lastArgs).toEqual({ relative: 'today' });
      const messages = sentBody(1).messages as Array<Record<string, unknown>>;
      expect(messages.slice(1)).toEqual([
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_bd4d55c2',
              type: 'function',
              function: { name: 'resolve_date', arguments: '{"relative": "today"}' },
            },
          ],
        },
        {
          role: 'tool',
          content: JSON.stringify({ date: '2026-09-29' }),
          tool_call_id: 'call_bd4d55c2',
        },
      ]);
    });

    it('should map truncation during thinking to finish reason length with content unchanged', async () => {
      respondWith(fixture('chat_length.json'));

      const response = unwrap(await generate({ maxTokens: 5 }));

      expect(response).toEqual(
        expect.objectContaining({ finishReason: 'length', content: 'We need to respond to' })
      );
      expect(response.thinking).toBeUndefined();
    });

    it.each([
      [404, fixture('error_model_not_found.json')],
      [
        401,
        '{"error":{"message":"Invalid API key","type":"authentication_error","param":null,"code":null}}',
      ],
    ])('should report HTTP %i as a provider error carrying the body', async (status, body) => {
      respondWith(body, { status });

      const error = errorOf(await generate(undefined, 'nope'));

      expect(error).toEqual(expect.objectContaining({ statusCode: status, body }));
      expect(error).toBeInstanceOf(GatewayError);
    });

    it('should report a failed connection as a gateway error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const error = errorOf(await generate());

      expect(error).toBeInstanceOf(GatewayError);
    });

    it('should report a body without choices as an invalid response', async () => {
      respondWith('{"object":"chat.completion"}');

      const error = errorOf(await generate());

      expect(error.message).toMatch(/invalid/i);
    });
  });

  describe('structured output', () => {
    it('should request a json_schema response format and parse the content', async () => {
      respondWith(fixture('chat_json_schema.json'));

      const result = await new LlmBroker(MODEL, gateway).generateObject(
        [Message.user('Ada, 36')],
        SCHEMA
      );

      expect(unwrap(result)).toEqual({ name: 'Ada', age: 36 });
      expect(sentBody().response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'response', schema: SCHEMA },
      });
      expect(sentBody().tools).toBeUndefined();
    });

    it('should record a Warning header on a structured request in metadata and log it', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      respondWith(fixture('chat_json_schema.json'), { headers: { Warning: WARNING } });

      const response = unwrap(await generate({ responseFormat: { type: 'json_object' } }));

      expect(response.metadata?.response_format_warning).toBe(WARNING);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(WARNING));
    });

    it('should join several Warning headers', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const headers = new Headers([
        ['Warning', WARNING],
        ['Warning', '199 omlx "second"'],
      ]);
      respondWith(fixture('chat_json_schema.json'), { headers });

      const response = unwrap(
        await generate({ responseFormat: { type: 'json_object', schema: SCHEMA } })
      );

      expect(response.metadata?.response_format_warning).toBe(`${WARNING}, 199 omlx "second"`);
    });

    it.each([[undefined], [{ type: 'text' as const }]])(
      'should not treat a Warning header as format evidence when the format is %j',
      async (responseFormat) => {
        respondWith(fixture('chat_thinking.json'), { headers: { Warning: WARNING } });

        const response = unwrap(await generate({ responseFormat }));

        expect(response.metadata).not.toHaveProperty('response_format_warning');
      }
    );
  });

  describe('generateStreamEvents', () => {
    function events(config?: CompletionConfig): AsyncGenerator<LlmStreamEvent> {
      return gateway.generateStreamEvents(MODEL, [Message.user('hi')], config);
    }

    it('should complete a thinking stream with content only and the real model as evidence', async () => {
      serveStream(fixture('stream_thinking.sse'));

      const result = await collect(events());

      expect(result).toEqual([
        { type: 'content', text: '\n\nhello' },
        {
          type: 'completed',
          metadata: {
            finishReason: 'stop',
            usage: { promptTokens: 57, completionTokens: 30, totalTokens: 87 },
            providerModel: MODEL,
            metadata: {
              id: 'chatcmpl-05014002',
              created: 1790679817,
              usage: streamedUsage('stream_thinking.sse'),
            },
          },
        },
      ]);
    });

    it('should send one streaming request that asks for usage and carries no tools', async () => {
      serveStream(fixture('stream_thinking.sse'));

      await collect(events());

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(sentUrl()).toBe('http://localhost:8000/v1/chat/completions');
      expect(sentHeaders().Authorization).toBeUndefined();
      expect(sentBody()).toEqual(
        expect.objectContaining({ stream: true, stream_options: { include_usage: true } })
      );
      expect(sentBody()).not.toHaveProperty('tools');
    });

    it('should forward the requested response format in the stream request', async () => {
      serveStream(fixture('stream_thinking.sse'));

      await collect(events({ responseFormat: { type: 'json_object', schema: SCHEMA } }));

      expect(sentBody().response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'response', schema: SCHEMA },
      });
    });

    it('should report a length-limited stream as an incomplete completion with the real model', async () => {
      serveStream(fixture('stream_length.sse'), 23);

      const result = await collect(events());

      expect(result).toEqual([
        errorWith({
          reason: 'incomplete_completion',
          evidence: expect.objectContaining({
            finishReason: 'length',
            usage: { promptTokens: 56, completionTokens: 5, totalTokens: 61 },
            providerModel: MODEL,
          }),
        }),
      ]);
    });

    it('should yield the leading content of a streamed tool call, then an unexpected-tool-calls error', async () => {
      serveStream(fixture('stream_tool_call.sse'), 31);

      const result = await collect(events());

      expect(result).toEqual([
        { type: 'content', text: '\n\n' },
        errorWith({
          reason: 'unexpected_tool_calls',
          evidence: expect.objectContaining({ providerModel: MODEL }),
        }),
      ]);
    });

    it('should end a stream of only a keep-alive frame as incomplete with no provider model', async () => {
      serveStream(keepAliveFrame());

      const result = await collect(events());

      expect(result).toEqual([
        errorWith({
          reason: 'incomplete_stream',
          evidence: { finishReason: null, usage: null, providerModel: null, metadata: null },
        }),
      ]);
    });

    it('should drop keep-alive frames that arrive after real frames', async () => {
      serveStream(contentFrame('Hel') + keepAliveFrame('ignored'));

      const result = await collect(events());

      expect(result).toEqual([
        { type: 'content', text: 'Hel' },
        errorWith({
          reason: 'incomplete_stream',
          evidence: expect.objectContaining({ providerModel: MODEL }),
        }),
      ]);
    });

    it('should ignore an SSE comment keep-alive', async () => {
      serveStream(': keep-alive\n\n' + fixture('stream_thinking.sse'));

      const result = await collect(events());

      expect(lastEvent(result)).toEqual(expect.objectContaining({ type: 'completed' }));
    });

    it('should report a non-2xx status as a provider error', async () => {
      respondWith(fixture('error_model_not_found.json'), { status: 404 });

      const result = await collect(events());

      expect(result).toEqual([
        errorWith({
          reason: 'provider_error',
          detail: { status: 404, body: fixture('error_model_not_found.json') },
        }),
      ]);
    });

    it('should cancel the request when the consumer stops after the first content event', async () => {
      const stream = serveStream(keepAliveFrame() + contentFrame('partial'), 17, {
        close: false,
      });

      for await (const event of events()) {
        expect(event).toEqual({ type: 'content', text: 'partial' });
        break;
      }

      expect(stream.wasCancelled()).toBe(true);
    });

    it('should trace the reported evidence when run through the broker', async () => {
      const tracer = new TracerSystem();
      serveStream(fixture('stream_thinking.sse'));

      await collect(
        new LlmBroker(MODEL, gateway, tracer).generateStreamEvents([Message.user('hi')])
      );

      const [response] = tracer
        .getEvents()
        .filter(
          (event): event is LLMResponseTracerEvent => event instanceof LLMResponseTracerEvent
        );
      expect(response).toEqual(
        expect.objectContaining({
          providerModel: MODEL,
          usage: { promptTokens: 57, completionTokens: 30, totalTokens: 87 },
        })
      );
    });
  });

  describe('generateStream', () => {
    function chunks(tools = [new ResolveDateTool().descriptor()]): Promise<StreamChunk[]> {
      return collect(gateway.generateStream(MODEL, [Message.user('date?')], undefined, tools)).then(
        (results) => results.map(unwrap)
      );
    }

    it('should yield the leading content, then exactly one complete tool call', async () => {
      serveStream(fixture('stream_tool_call.sse'), 29);

      const result = await chunks();

      expect(result).toEqual([
        { content: '\n\n', done: false },
        {
          toolCalls: [
            {
              id: 'call_659d0e77',
              type: 'function',
              function: { name: 'resolve_date', arguments: '{"relative": "today"}' },
            },
          ],
          done: true,
          finishReason: 'tool_calls',
        },
      ]);
    });

    it('should send tools and stream without asking for usage', async () => {
      serveStream(fixture('stream_tool_call.sse'));

      await chunks();

      expect(sentBody()).toEqual(
        expect.objectContaining({ stream: true, tools: [new ResolveDateTool().descriptor()] })
      );
      expect(sentBody()).not.toHaveProperty('stream_options');
    });

    it('should drop reasoning and stream content', async () => {
      serveStream(fixture('stream_thinking.sse'), 41);

      const result = await chunks([]);

      expect(result).toEqual([
        { content: '\n\nhello', done: false },
        { done: true, finishReason: 'stop' },
      ]);
    });

    it('should cancel the legacy response body when consumption stops early', async () => {
      const stream = serveStream(contentFrame('hello'), 17, { close: false });

      for await (const chunk of gateway.generateStream(MODEL, [Message.user('hi')])) {
        expect(unwrap(chunk).content).toBe('hello');
        break;
      }

      expect(stream.wasCancelled()).toBe(true);
    });

    it('should drop keep-alive frames', async () => {
      serveStream(keepAliveFrame('ignored') + contentFrame('Hel'));

      const result = await chunks([]);

      expect(result).toEqual([{ content: 'Hel', done: false }]);
    });

    it('should report a non-2xx status as a provider error carrying the body', async () => {
      respondWith(fixture('error_model_not_found.json'), { status: 404 });

      const [result] = await collect(gateway.generateStream(MODEL, [Message.user('hi')]));

      expect(errorOf(result)).toEqual(
        expect.objectContaining({
          statusCode: 404,
          body: fixture('error_model_not_found.json'),
        })
      );
    });
  });

  describe('models', () => {
    it.each(['', '   '])(
      'should reject blank model ids (%j) before load or unload',
      async (model) => {
        await expect(gateway.loadModel(model)).rejects.toThrow(ValidationError);
        await expect(gateway.unloadModel(model)).rejects.toThrow(ValidationError);

        expect(mockFetch).not.toHaveBeenCalled();
      }
    );

    it('should list the available model ids, sorted', async () => {
      respondWith('{"object":"list","data":[{"id":"zeta"},{"id":"Alpha"},{"id":"beta"}]}');

      const models = unwrap(await gateway.listModels());

      expect(models).toEqual(['Alpha', 'beta', 'zeta']);
      expect(sentUrl()).toBe('http://localhost:8000/v1/models');
    });

    it('should list the models in the captured response', async () => {
      respondWith(fixture('models.json'));

      const models = unwrap(await gateway.listModels());

      expect(models).toEqual([MODEL]);
    });

    it('should report a provider error when listing models', async () => {
      const body = '{"error":{"message":"Invalid API key","type":"authentication_error"}}';
      respondWith(body, { status: 401 });

      const error = errorOf(await gateway.listModels());

      expect(error).toEqual(expect.objectContaining({ statusCode: 401, body }));
    });

    it('should load a model at its load path with the API key and no value on success', async () => {
      respondWith(fixture('model_load.json'));

      const result = await new OMLXGateway(undefined, 'local-key').loadModel(MODEL);

      expect(result).toEqual(Ok(undefined));
      expect(sentUrl()).toBe(`http://localhost:8000/v1/models/${MODEL}/load`);
      expect(sentInit().method).toBe('POST');
      expect(sentHeaders().Authorization).toBe('Bearer local-key');
    });

    it('should apply the configured timeout to loading', async () => {
      const timeout = jest.spyOn(AbortSignal, 'timeout');
      respondWith(fixture('model_load.json'));

      await new OMLXGateway(undefined, undefined, 5000).loadModel(MODEL);

      expect(timeout).toHaveBeenCalledWith(5000);
    });

    it('should unload a model at its unload path', async () => {
      respondWith(fixture('model_unload.json'));

      const result = await gateway.unloadModel(MODEL);

      expect(result).toEqual(Ok(undefined));
      expect(sentUrl()).toBe(`http://localhost:8000/v1/models/${MODEL}/unload`);
      expect(sentInit().method).toBe('POST');
    });

    it('should report unloading a model that is not loaded as a provider error', async () => {
      const body = fixture('error_model_not_loaded.json');
      respondWith(body, { status: 400 });

      const error = errorOf(await gateway.unloadModel(MODEL));

      expect(error).toEqual(expect.objectContaining({ statusCode: 400, body }));
    });

    it('should percent-encode the model id in the path', async () => {
      respondWith(fixture('model_load.json'));

      await gateway.loadModel('org/my model');

      expect(sentUrl()).toBe('http://localhost:8000/v1/models/org%2Fmy%20model/load');
    });

    it('should report a failed connection while loading as a gateway error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const error = errorOf(await gateway.loadModel(MODEL));

      expect(error).toBeInstanceOf(GatewayError);
    });
  });

  describe('calculateEmbeddings', () => {
    it('should send one request with the model and text and return the embedding', async () => {
      respondWith(
        '{"object":"list","data":[{"object":"embedding","index":0,"embedding":[3.0,-4.0]}]}'
      );

      const embedding = unwrap(await gateway.calculateEmbeddings('hello world', 'embed-model'));

      expect(embedding).toEqual([3.0, -4.0]);
      expect(sentUrl()).toBe('http://localhost:8000/v1/embeddings');
      expect(sentBody()).toEqual({ model: 'embed-model', input: 'hello world' });
    });

    it.each([[undefined], ['']])(
      'should reject a missing model (%j) before any request',
      async (model) => {
        await expect(gateway.calculateEmbeddings('hello', model)).rejects.toThrow(ValidationError);

        expect(mockFetch).not.toHaveBeenCalled();
      }
    );

    it('should report a chat model as a provider error', async () => {
      const body = fixture('error_not_embedding_model.json');
      respondWith(body, { status: 400 });

      const error = errorOf(await gateway.calculateEmbeddings('hello', MODEL));

      expect(error).toEqual(expect.objectContaining({ statusCode: 400, body }));
    });

    it('should report a body without an embedding as an invalid response', async () => {
      respondWith('{"object":"list","data":[]}');

      const error = errorOf(await gateway.calculateEmbeddings('hello', 'embed-model'));

      expect(error.message).toMatch(/invalid/i);
    });
  });
});
