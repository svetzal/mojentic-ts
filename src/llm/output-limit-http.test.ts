import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { z } from 'zod';
import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { OpenAIGateway } from './gateways/openai';
import { OllamaGateway } from './gateways/ollama';
import { OMLXGateway } from './gateways/omlx';
import { CompletionConfig, Message } from './models';
import { RecoveryOptions } from './recovery';
import { Ok, unwrap } from '../error';
import { ChatSession } from './chat-session';
import { LlmTool } from './tools';
import type { CompletionConfig as PublicCompletionConfig } from '../index';

interface Provider {
  readonly name: string;
  readonly model: string;
  readonly field: string;
  readonly configuredControls: Record<string, unknown>;
  readonly defaultReasoningControls: Record<string, unknown>;
  readonly gateway: (host: string) => LlmGateway;
}
const providers: readonly Provider[] = [
  {
    name: 'OpenAI chat',
    configuredControls: { temperature: 0, max_tokens: 37 },
    defaultReasoningControls: { temperature: 1 },
    model: 'gpt-4o',
    field: 'max_tokens',
    gateway: (host) => new OpenAIGateway('test-key', host),
  },
  {
    name: 'OpenAI reasoning',
    configuredControls: { temperature: 1, max_completion_tokens: 37 },
    defaultReasoningControls: { temperature: 1, reasoning_effort: 'high' },
    model: 'o3',
    field: 'max_completion_tokens',
    gateway: (host) => new OpenAIGateway('test-key', host),
  },
  {
    name: 'Ollama',
    configuredControls: {
      options: { temperature: 0, top_p: 0.7, top_k: 8, num_ctx: 4096, num_predict: 37 },
      stream: false,
    },
    defaultReasoningControls: {
      options: { top_p: 0.7, top_k: 8, num_ctx: 4096, stop: ['END'] },
      think: true,
      stream: false,
    },
    model: 'qwen',
    field: 'num_predict',
    gateway: (host) => new OllamaGateway(host),
  },
  {
    configuredControls: { temperature: 0, max_tokens: 37, top_p: 0.7, top_k: 8 },
    defaultReasoningControls: { temperature: 1, top_p: 0.7, top_k: 8, reasoning_effort: 'high' },
    name: 'oMLX',
    model: 'qwen',
    field: 'max_tokens',
    gateway: (host) => new OMLXGateway(host),
  },
];
const recovery: RecoveryOptions = {
  maxAttempts: 2,
  baseDelayMs: 0,
  jitter: () => 0,
  admit: async () => 'allow',
};
const objectSchema = z.record(z.string(), z.unknown());
const messages = (): ReturnType<typeof Message.user>[] => [Message.user('hello')];
const content = '{"answer":42}';

const serializedBodies = new WeakMap<Record<string, unknown>, string>();

it('removes numPredict from the exported TypeScript CompletionConfig contract', () => {
  const fieldIsAbsent: 'numPredict' extends keyof PublicCompletionConfig ? false : true = true;

  expect(fieldIsAbsent).toBe(true);
});

const aliases = ['maxTokens', 'numPredict', 'num_predict', 'max_tokens', 'max_completion_tokens'];
function outputFields(request: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(request).filter(([name]) => aliases.includes(name)));
}
function assertLimit(
  request: Record<string, unknown>,
  provider: Provider,
  config?: CompletionConfig
): void {
  const expected = config?.maxTokens === undefined ? {} : { [provider.field]: config.maxTokens };
  const options = objectSchema.parse(request.options ?? {});
  expect(outputFields(request)).toEqual(provider.name === 'Ollama' ? {} : expected);
  expect(outputFields(options)).toEqual(provider.name === 'Ollama' ? expected : {});
  const bytes = serializedBodies.get(request);
  expect(bytes).toBeDefined();
  const wireFields = Array.from(
    (bytes ?? '').matchAll(
      /"(maxTokens|numPredict|num_predict|max_tokens|max_completion_tokens)"\s*:/g
    ),
    (match) => match[1]
  );
  expect(wireFields).toEqual(config?.maxTokens === undefined ? [] : [provider.field]);
}
async function assertLegacy(
  broker: LlmBroker,
  config?: CompletionConfig,
  tools?: LlmTool[]
): Promise<void> {
  const chunks: string[] = [];
  for await (const chunk of broker.generateStream(messages(), config, tools))
    chunks.push(unwrap(chunk));
  expect(chunks.join('')).toBe(content);
}
async function assertEvents(broker: LlmBroker, config?: CompletionConfig): Promise<void> {
  const events = [];
  for await (const event of broker.generateStreamEvents(messages(), config)) events.push(event);
  expect(events.filter((event) => event.type === 'content')).toEqual([
    { type: 'content', text: content },
  ]);
  expect(events.at(-1)).toMatchObject({ type: 'completed' });
}
const routes = [
  {
    name: 'ordinary',
    run: async (broker: LlmBroker, config?: CompletionConfig): Promise<void> => {
      expect(unwrap(await broker.generateResponse(messages(), undefined, config)).content).toBe(
        content
      );
    },
  },
  {
    name: 'structured',
    run: async (broker: LlmBroker, config?: CompletionConfig): Promise<void> => {
      expect(
        unwrap(
          await broker.generateObject(
            messages(),
            { type: 'object', properties: { answer: { type: 'number' } }, required: ['answer'] },
            config
          )
        )
      ).toEqual({ answer: 42 });
    },
  },
  { name: 'legacy stream', run: assertLegacy },
  { name: 'event stream', run: assertEvents },
];
const limits: readonly { name: string; config?: CompletionConfig }[] = [
  { name: 'omitted config' },
  { name: 'empty config', config: {} },
  { name: 'explicit undefined', config: { maxTokens: undefined } },
  { name: 'explicit limit', config: { maxTokens: 37 } },
  { name: 'explicit zero', config: { maxTokens: 0 } },
];
const policies = [
  { name: 'legacy', recovery: undefined, failures: 0 },
  { name: 'recovery enabled', recovery: {}, failures: 0 },
  { name: 'recovery resend', recovery, failures: 1 },
];
const tool: LlmTool = {
  name: () => 'answer',
  matches: (name) => name === 'answer',
  descriptor: () => ({
    type: 'function',
    function: {
      name: 'answer',
      description: 'Answer',
      parameters: { type: 'object', properties: {} },
    },
  }),
  run: async () => Ok({ answer: 42 }),
};

// Local executable conformance set ts-output-limit-v1. HTTP responses are probe
// fixtures, not independently verified provider contracts.
describe.each(providers)('$name output-limit HTTP contract', (provider) => {
  let server: Server;
  let host: string;
  let failures: number;
  let toolPending: boolean;
  let followUpFailures: number;
  const requests: Record<string, unknown>[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      let bytes = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        bytes += chunk;
      });
      request.on('end', () => {
        const body = objectSchema.parse(JSON.parse(bytes));
        requests.push(body);
        serializedBodies.set(body, bytes);
        if (failures-- > 0) {
          response.writeHead(503, { 'Content-Type': 'application/json' });
          response.end('{"error":"temporarily unavailable"}');
          return;
        }
        const ollama = provider.name === 'Ollama';
        if (toolPending) {
          toolPending = false;
          failures = followUpFailures;
          followUpFailures = 0;
          const functionCall = { name: 'answer', arguments: ollama ? {} : '{}' };
          const toolCall = { id: 'call-one', type: 'function', function: functionCall };
          response.writeHead(200, { 'Content-Type': 'application/json' });
          if (body.stream === true) {
            response.end(
              ollama
                ? JSON.stringify({
                    message: { content: '', tool_calls: [toolCall] },
                    done: false,
                  }) +
                    '\n' +
                    '{"message":{"content":""},"done":true,"done_reason":"stop"}\n'
                : `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, ...toolCall }] } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n`
            );
            return;
          }
          response.end(
            JSON.stringify(
              ollama
                ? {
                    message: { role: 'assistant', content: '', tool_calls: [toolCall] },
                    done: true,
                  }
                : {
                    choices: [
                      {
                        message: { content: '', tool_calls: [toolCall] },
                        finish_reason: 'tool_calls',
                      },
                    ],
                  }
            )
          );
          return;
        }
        if (body.stream === true) {
          response.writeHead(200, {
            'Content-Type': ollama ? 'application/x-ndjson' : 'text/event-stream',
          });
          response.end(
            ollama
              ? JSON.stringify({ message: { role: 'assistant', content }, done: false }) +
                  '\n' +
                  JSON.stringify({
                    message: { role: 'assistant', content: '' },
                    done: true,
                    done_reason: 'stop',
                  }) +
                  '\n'
              : `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`
          );
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify(
            ollama
              ? { message: { role: 'assistant', content }, done: true }
              : { choices: [{ message: { content }, finish_reason: 'stop' }] }
          )
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    requests.length = 0;
    failures = 0;
    toolPending = false;
    followUpFailures = 0;
  });

  it('characterizes unrelated request controls before output-limit correction', async () => {
    const result = await provider.gateway(host).generate(provider.model, messages(), {
      maxTokens: 37,
      temperature: 0,
      topP: 0.7,
      topK: 8,
      numCtx: 4096,
    });

    expect(unwrap(result).content).toBe(content);
    const [request] = requests;
    expect(request).toEqual({
      model: provider.model,
      messages: [{ role: 'user', content: 'hello' }],
      ...provider.configuredControls,
    });
  });

  it('preserves sampling defaults and reasoning controls without an output limit', async () => {
    const result = await provider.gateway(host).generate(provider.model, messages(), {
      topP: 0.7,
      topK: 8,
      numCtx: 4096,
      stop: ['END'],
      reasoningEffort: 'high',
      frequencyPenalty: 0.4,
      presencePenalty: 0.5,
    });

    expect(unwrap(result).content).toBe(content);
    expect(requests[0]).toEqual({
      model: provider.model,
      messages: [{ role: 'user', content: 'hello' }],
      ...provider.defaultReasoningControls,
    });
  });

  it('ignores a stale JavaScript numPredict alias in favor of maxTokens', async () => {
    const config = { numPredict: 5, maxTokens: 37 };

    expect(
      unwrap(await provider.gateway(host).generate(provider.model, messages(), config)).content
    ).toBe(content);

    assertLimit(requests[0], provider, config);
  });

  it('omits the output limit on recovered event requests and resends', async () => {
    failures = 1;
    const broker = new LlmBroker(provider.model, provider.gateway(host));
    const events = [];
    for await (const event of broker.generateStreamEvents(messages(), { recovery }))
      events.push(event);

    expect(events.filter((event) => event.type === 'content')).toEqual([
      expect.objectContaining({ text: content }),
    ]);
    expect(events.at(-1)).toMatchObject({ type: 'completed' });
    expect(requests[0]).toEqual(requests[1]);
    for (const request of requests) {
      const fields = { ...request, ...objectSchema.parse(request.options ?? {}) };
      for (const alias of [
        'maxTokens',
        'numPredict',
        'num_predict',
        'max_tokens',
        'max_completion_tokens',
      ]) {
        expect(fields).not.toHaveProperty(alias);
      }
    }
  });

  describe.each(routes)('$name', (route) => {
    describe.each(policies)('$name', (policy) => {
      it.each(limits)(
        'serializes $name exactly and returns a successful response',
        async (limit) => {
          failures = policy.failures;
          const config =
            policy.recovery === undefined
              ? limit.config
              : { ...limit.config, recovery: policy.recovery };
          const broker = new LlmBroker(provider.model, provider.gateway(host));

          await route.run(broker, config);

          expect(requests).not.toEqual([]);
          for (const request of requests) assertLimit(request, provider, config);
          expect(requests.at(-1)).toEqual(requests[0]);
        }
      );
    });
  });

  describe.each(policies)('tool follow-up $name', (policy) => {
    it.each(limits)('preserves $name through ordinary tool follow-ups', async (limit) => {
      failures = policy.failures;
      toolPending = true;
      followUpFailures = policy.failures;
      const config = { ...limit.config, recovery: policy.recovery };
      const broker = new LlmBroker(provider.model, provider.gateway(host));

      expect(unwrap(await broker.generate(messages(), [tool], config))).toBe(content);

      for (const request of requests) assertLimit(request, provider, config);
      expect(requests.at(-1)?.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'tool', content: '{"answer":42}' }),
        ])
      );
    });
    it.each(limits)('preserves $name through streaming tool follow-ups', async (limit) => {
      failures = policy.failures;
      toolPending = true;
      followUpFailures = policy.failures;
      const config = { ...limit.config, recovery: policy.recovery };
      const broker = new LlmBroker(provider.model, provider.gateway(host));

      await assertLegacy(broker, config, [tool]);

      for (const request of requests) assertLimit(request, provider, config);
      expect(requests.at(-1)?.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'tool', content: '{"answer":42}' }),
        ])
      );
    });
    it('omits the limit through session send and sendStream while retaining zero temperature', async () => {
      const session = new ChatSession(new LlmBroker(provider.model, provider.gateway(host)), {
        temperature: 0,
      });
      failures = policy.failures;

      expect(await session.send('hello', policy.recovery)).toBe(content);
      failures = policy.failures;
      const chunks: string[] = [];
      for await (const chunk of session.sendStream('hello again', policy.recovery))
        chunks.push(chunk);

      expect(chunks.join('')).toBe(content);
      for (const request of requests) {
        assertLimit(request, provider);
        expect(objectSchema.parse(request.options ?? request).temperature).toBe(
          provider.name === 'OpenAI reasoning' ? 1 : 0
        );
      }
    });
  });
});
