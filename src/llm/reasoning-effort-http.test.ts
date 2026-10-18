import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { z } from 'zod';
import {
  CompletionConfig,
  LlmGateway,
  Message,
  OllamaGateway,
  OMLXGateway,
  OpenAIGateway,
  unwrap,
} from '../index';
import contractJson from './gateways/__fixtures__/reasoning-effort-v1.json';

const contract = z
  .object({
    contract: z.literal('ts-reasoning-effort-v1'),
    cases: z.array(
      z.object({
        name: z.string(),
        config: z.object({
          reasoningEffort: z
            .enum(['disabled', 'enabled', 'low', 'medium', 'high', 'xhigh'])
            .optional(),
        }),
        ollama: z.record(z.string(), z.unknown()),
        omlx: z.record(z.string(), z.unknown()),
        openai: z.record(z.string(), z.unknown()),
        openaiRejects: z.boolean(),
      })
    ),
  })
  .parse(contractJson);
const messages = [Message.user('hello')];
const schema = { type: 'object', properties: { answer: { type: 'number' } }, required: ['answer'] };
const text = '{"answer":42}';
const routes = ['ordinary', 'structured', 'legacy stream', 'event stream'] as const;
type Route = (typeof routes)[number];
const providers = ['ollama', 'omlx', 'openai-reasoning', 'openai-ordinary'] as const;
type Provider = (typeof providers)[number];

let server: Server;
let host: string;
let bodies: unknown[];
let urls: (string | undefined)[];
let warning: jest.SpyInstance;

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
    bodies.push(body);
    urls.push(request.url);
    const ollama = request.url === '/api/chat';
    response.setHeader(
      'content-type',
      body.stream ? (ollama ? 'application/x-ndjson' : 'text/event-stream') : 'application/json'
    );
    if (body.stream) {
      response.end(
        ollama
          ? `${JSON.stringify({ message: { content: text }, done: false })}\n{"message":{"content":""},"done":true,"done_reason":"stop"}\n`
          : `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`
      );
      return;
    }
    response.end(
      JSON.stringify(
        ollama
          ? { message: { role: 'assistant', content: text }, done: true, done_reason: 'stop' }
          : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }
      )
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  warning = jest.spyOn(console, 'warn');
  bodies = [];
  urls = [];
});
afterEach(() => warning.mockRestore());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function gatewayFor(provider: Provider): LlmGateway {
  if (provider === 'ollama') return new OllamaGateway(host);
  if (provider === 'omlx') return new OMLXGateway(host);
  return new OpenAIGateway('test', `${host}/v1`);
}

async function invoke(
  gateway: LlmGateway,
  route: Route,
  model: string,
  config: CompletionConfig
): Promise<unknown> {
  if (route === 'ordinary' || route === 'structured') {
    const result = await gateway.generate(model, messages, config);
    return unwrap(result).content;
  }
  if (route === 'legacy stream') {
    const content: string[] = [];
    for await (const chunk of gateway.generateStream(model, messages, config))
      content.push(unwrap(chunk).content ?? '');
    return content.join('');
  }
  if (!gateway.generateStreamEvents) throw new Error('Missing public event API');
  const events = [];
  for await (const event of gateway.generateStreamEvents(model, messages, config))
    events.push(event);
  expect(events.filter((event) => event.type === 'content')).toEqual([{ type: 'content', text }]);
  expect(events.at(-1)?.type).toBe('completed');
  return text;
}

async function rejection(
  gateway: LlmGateway,
  route: Route,
  model: string,
  config: CompletionConfig
): Promise<unknown> {
  if (route === 'ordinary' || route === 'structured')
    return gateway.generate(model, messages, config);
  if (route === 'legacy stream') {
    const chunks = [];
    for await (const chunk of gateway.generateStream(model, messages, config)) chunks.push(chunk);
    return chunks;
  }
  if (!gateway.generateStreamEvents) throw new Error('Missing public event API');
  const events = [];
  for await (const event of gateway.generateStreamEvents(model, messages, config))
    events.push(event);
  return events;
}

describe.each(providers)('ts-reasoning-effort-v1 %s production HTTP', (provider) => {
  describe.each(routes)('%s', (route) => {
    describe.each([false, true])('recovery=%s', (recovery) => {
      it.each(
        contract.cases.filter(
          (testCase) => !provider.startsWith('openai') || !testCase.openaiRejects
        )
      )('preserves the complete $name request body', async (testCase) => {
        const model =
          provider === 'openai-reasoning'
            ? 'o3'
            : provider === 'openai-ordinary'
              ? 'gpt-4o'
              : 'qwen';
        const gateway = gatewayFor(provider);
        const config: CompletionConfig = {
          ...testCase.config,
          ...(recovery ? { recovery: {} } : {}),
          ...(route === 'structured' ? { responseFormat: { type: 'json_object', schema } } : {}),
        };
        const wire =
          provider === 'ollama'
            ? testCase.ollama
            : provider === 'omlx'
              ? testCase.omlx
              : provider === 'openai-reasoning'
                ? testCase.openai
                : {};
        const expected = {
          model,
          messages,
          ...wire,
          ...(provider === 'ollama' ? { options: {}, stream: route.endsWith('stream') } : {}),
          ...(provider !== 'ollama' && route.endsWith('stream') ? { stream: true } : {}),
          ...(route === 'event stream' && provider !== 'ollama'
            ? { stream_options: { include_usage: true } }
            : {}),
          ...(route === 'structured'
            ? provider === 'ollama'
              ? { format: schema }
              : {
                  response_format: {
                    type: 'json_schema',
                    json_schema: { name: 'response', schema },
                  },
                }
            : {}),
        };

        expect(await invoke(gateway, route, model, config)).toBe(text);
        expect(bodies).toEqual([expected]);
        expect(urls).toEqual([provider === 'ollama' ? '/api/chat' : '/v1/chat/completions']);
        expect(warning.mock.calls).toEqual(
          provider === 'openai-ordinary' && testCase.config.reasoningEffort !== undefined
            ? [[`Model ${model} is not a reasoning model, ignoring reasoningEffort parameter`]]
            : []
        );
      });
      if (provider.startsWith('openai')) {
        it.each(contract.cases.filter((testCase) => testCase.openaiRejects))(
          'rejects $name with no HTTP requests',
          async (testCase) => {
            const model = provider === 'openai-reasoning' ? 'o3' : 'gpt-4o';
            const config: CompletionConfig = {
              ...testCase.config,
              ...(recovery ? { recovery: {} } : {}),
              ...(route === 'structured'
                ? { responseFormat: { type: 'json_object', schema } }
                : {}),
            };
            const message = `OpenAI does not support reasoningEffort "${testCase.config.reasoningEffort}" in 3.0.0`;
            const error = expect.objectContaining({
              name: 'ValidationError',
              code: 'VALIDATION_ERROR',
              field: 'reasoningEffort',
              message,
            });
            const expected =
              route === 'event stream'
                ? [
                    {
                      type: 'error',
                      error: expect.objectContaining({
                        name: 'StreamEventError',
                        reason: 'request_failed',
                        message,
                        detail: error,
                      }),
                    },
                  ]
                : route === 'legacy stream'
                  ? [{ ok: false, error }]
                  : { ok: false, error };

            expect(await rejection(gatewayFor(provider), route, model, config)).toEqual(expected);
            expect(bodies).toEqual([]);
            expect(warning.mock.calls).toEqual([]);
          }
        );
      }
    });
  });
});
