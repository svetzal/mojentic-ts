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
  QWEN3_8_REASONING_PROFILE,
  LlmBroker,
  LlmTool,
  Ok,
} from '../index';
import profileJson from './gateways/__fixtures__/reasoning-profiles-v1.json';
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
const profileContract = z
  .object({
    contract: z.literal('ts-reasoning-profiles-v1'),
    selections: z.array(
      z.object({
        name: z.string(),
        model: z.string(),
        profile: z
          .object({
            name: z.string(),
            supportedEfforts: z.array(
              z.enum(['disabled', 'enabled', 'low', 'medium', 'high', 'xhigh'])
            ),
            supportsReasoningHistory: z.boolean(),
          })
          .nullable(),
      })
    ),
  })
  .parse(profileJson);

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
let toolTurn = false;

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
    bodies.push(body);
    urls.push(request.url);
    if (toolTurn && bodies.length === 1) {
      const call = {
        id: 'tool-1',
        type: 'function',
        function: { name: 'answer', arguments: '{}' },
      };
      response.end(
        body.stream
          ? `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, ...call }] } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n`
          : JSON.stringify({
              choices: [
                { message: { content: '', tool_calls: [call] }, finish_reason: 'tool_calls' },
              ],
            })
      );
      return;
    }
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
  toolTurn = false;
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

describe.each(profileContract.selections)('ts-reasoning-profiles-v1 $name', (selection) => {
  const profileRejects = (effort?: CompletionConfig['reasoningEffort']): boolean =>
    effort !== undefined &&
    selection.profile !== null &&
    !selection.profile.supportedEfforts.includes(effort);
  describe.each(providers)('ts-reasoning-effort-v1 %s production HTTP', (provider) => {
    describe.each(routes)('%s', (route) => {
      describe.each([false, true])('recovery=%s', (recovery) => {
        it.each(
          contract.cases.filter(
            (testCase) =>
              (!provider.startsWith('openai') || !testCase.openaiRejects) &&
              !profileRejects(testCase.config.reasoningEffort)
          )
        )('preserves the complete $name request body', async (testCase) => {
          const model =
            provider === 'openai-reasoning'
              ? 'o3'
              : provider === 'openai-ordinary'
                ? 'gpt-4o'
                : selection.model;
          const gateway = gatewayFor(provider);
          const config: CompletionConfig = {
            ...testCase.config,
            ...(selection.profile ? { reasoningProfile: selection.profile } : {}),
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
        contract.cases
          .filter(
            (testCase) =>
              (provider.startsWith('openai') && testCase.openaiRejects) ||
              profileRejects(testCase.config.reasoningEffort)
          )
          .forEach((testCase) => {
            it(`rejects ${testCase.name} with no HTTP requests`, async () => {
              const model =
                provider === 'openai-reasoning'
                  ? 'o3'
                  : provider === 'openai-ordinary'
                    ? 'gpt-4o'
                    : selection.model;
              const config: CompletionConfig = {
                ...testCase.config,
                ...(selection.profile ? { reasoningProfile: selection.profile } : {}),
                ...(recovery ? { recovery: {} } : {}),
                ...(route === 'structured'
                  ? { responseFormat: { type: 'json_object', schema } }
                  : {}),
              };
              const message =
                provider.startsWith('openai') && testCase.openaiRejects
                  ? `OpenAI does not support reasoningEffort "${testCase.config.reasoningEffort}" in 3.0.0`
                  : `Reasoning effort "${testCase.config.reasoningEffort}" is unsupported by profile ${selection.profile?.name}; supported: ${selection.profile?.supportedEfforts.join(', ')}`;
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
            });
          });
      });
    });
  });
});

// Regression for the pre-dispatch behavioral proof.
it('rejects an unsupported selected profile effort before recovery event HTTP', async () => {
  const config = {
    reasoningEffort: 'high' as const,
    reasoningProfile: QWEN3_8_REASONING_PROFILE,
    recovery: {},
  };

  const events = await rejection(gatewayFor('omlx'), 'event stream', 'arbitrary-alias', config);

  expect(bodies).toEqual([]);
  expect(events).toEqual([
    expect.objectContaining({
      type: 'error',
      error: expect.objectContaining({
        reason: 'request_failed',
        detail: expect.objectContaining({
          name: 'ValidationError',
          field: 'reasoningEffort',
        }),
      }),
    }),
  ]);
});

const answerTool: LlmTool = {
  name: () => 'answer',
  matches: (name) => name === 'answer',
  descriptor: () => ({
    type: 'function',
    function: { name: 'answer', description: 'Answer', parameters: { type: 'object' } },
  }),
  run: async () => Ok(42),
};

describe.each([false, true])('broker profile propagation recovery=%s', (recovery) => {
  const config: CompletionConfig = {
    reasoningProfile: QWEN3_8_REASONING_PROFILE,
    reasoningEffort: 'low',
    ...(recovery ? { recovery: {} } : {}),
  };
  it('keeps the profile when constructing structured configuration', async () => {
    const gateway = new OMLXGateway(host);
    const generate = jest.spyOn(gateway, 'generate');
    const broker = new LlmBroker('arbitrary-alias', gateway);

    const result = await broker.generateObject(messages, schema, config);

    expect(unwrap(result)).toEqual({ answer: 42 });
    expect(generate.mock.calls[0]?.[2]?.reasoningProfile).toBe(QWEN3_8_REASONING_PROFILE);
    expect(bodies).toEqual([expect.objectContaining({ reasoning_effort: 'low' })]);
  });

  it('keeps the profile through ordinary tool continuation', async () => {
    toolTurn = true;
    const gateway = new OMLXGateway(host);
    const generate = jest.spyOn(gateway, 'generate');
    const broker = new LlmBroker('arbitrary-alias', gateway);

    const result = await broker.generate(messages, [answerTool], config);

    expect(unwrap(result)).toBe(text);
    expect(generate.mock.calls.map((call) => call[2]?.reasoningProfile)).toEqual([
      QWEN3_8_REASONING_PROFILE,
      QWEN3_8_REASONING_PROFILE,
    ]);
    expect(bodies).toHaveLength(2);
    expect(bodies).toEqual([
      expect.objectContaining({ reasoning_effort: 'low' }),
      expect.objectContaining({ reasoning_effort: 'low' }),
    ]);
  });

  it('keeps the profile through streaming tool continuation', async () => {
    toolTurn = true;
    const gateway = new OMLXGateway(host);
    const generate = jest.spyOn(gateway, 'generateStream');
    const broker = new LlmBroker('arbitrary-alias', gateway);
    const chunks: string[] = [];

    for await (const chunk of broker.generateStream(messages, config, [answerTool]))
      chunks.push(unwrap(chunk));

    expect(chunks.join('')).toBe(text);
    expect(generate.mock.calls.map((call) => call[2]?.reasoningProfile)).toEqual([
      QWEN3_8_REASONING_PROFILE,
      QWEN3_8_REASONING_PROFILE,
    ]);
    expect(bodies).toHaveLength(2);
    expect(bodies).toEqual([
      expect.objectContaining({ reasoning_effort: 'low' }),
      expect.objectContaining({ reasoning_effort: 'low' }),
    ]);
  });
});
