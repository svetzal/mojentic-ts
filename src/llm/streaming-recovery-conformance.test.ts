/** Public deterministic HTTP evidence for both streaming forms and all completion adapters. */
import { strict as assert } from 'node:assert';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { Ok, Result } from '../error';
import { LlmBroker } from './broker';
import { ChatSession } from './chat-session';
import { LlmGateway } from './gateway';
import { OllamaGateway } from './gateways/ollama';
import { OMLXGateway } from './gateways/omlx';
import { OpenAIGateway } from './gateways/openai';
import { CompletionConfig, LlmMessage, Message, StreamChunk } from './models';
import {
  inspectRecoveryFailure,
  RecoveryError,
  RecoveryEvent,
  RecoveryOptions,
  RecoveryWireEvent,
} from './recovery';
import { LlmStreamEvent } from './stream-events';
import { LlmTool } from './tools';

type Output = Result<StreamChunk, Error> | LlmStreamEvent;
type Reply = (response: ServerResponse, request: IncomingMessage) => void;
interface Provider {
  readonly name: 'ollama' | 'omlx' | 'openai';
  readonly gateway: (url: string) => LlmGateway;
  readonly frame: (delta: object, done?: boolean, finish?: string) => string;
  readonly end: string;
  readonly keepalive: string;
  readonly tool: object;
}
const providers: readonly Provider[] = [
  {
    name: 'ollama',
    gateway: (url) => new OllamaGateway(url),
    frame: (message, done = false, done_reason = 'stop') =>
      JSON.stringify({
        model: 'reported',
        message,
        done,
        done_reason: done ? done_reason : undefined,
        prompt_eval_count: done ? 2 : undefined,
        eval_count: done ? 3 : undefined,
        total_duration: done ? 10 : undefined,
      }) + '\n',
    end: '',
    keepalive: '\n',
    tool: { id: 'call-one', function: { name: 'counter', arguments: { value: 7 } } },
  },
  {
    name: 'omlx',
    gateway: (url) => new OMLXGateway(url, 'credential-secret', 10000),
    frame: (delta, done = false, finish = 'stop') =>
      `data: ${JSON.stringify({ id: 'provider-response', model: 'reported', choices: [{ delta, finish_reason: done ? finish : null }], usage: done ? { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5, time_to_first_token: 0.2 } : undefined })}\n\n`,
    end: 'data: [DONE]\n\n',
    keepalive: 'data: {"model":"keepalive"}\n\n',
    tool: { index: 0, id: 'call-one', function: { name: 'counter', arguments: '{"value":7}' } },
  },
  {
    name: 'openai',
    gateway: (url) => new OpenAIGateway('credential-secret', url),
    frame: (delta, done = false, finish = 'stop') =>
      `data: ${JSON.stringify({ id: 'provider-response', model: 'reported', choices: [{ delta, finish_reason: done ? finish : null }], usage: done ? { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } : undefined })}\n\n`,
    end: 'data: [DONE]\n\n',
    keepalive: ': keepalive\n\n',
    tool: { index: 0, id: 'call-one', function: { name: 'counter', arguments: '{"value":7}' } },
  },
];
interface Form {
  readonly name: 'chunks' | 'events';
  readonly stream: (
    gateway: LlmGateway,
    messages: LlmMessage[],
    config?: CompletionConfig
  ) => AsyncGenerator<Output>;
}
const forms: readonly Form[] = [
  {
    name: 'chunks',
    stream: (gateway, messages, config) => gateway.generateStream('gpt-4o', messages, config),
  },
  {
    name: 'events',
    stream: (gateway, messages, config) => {
      assert(gateway.generateStreamEvents);
      return gateway.generateStreamEvents('gpt-4o', messages, config);
    },
  },
];
async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const output: T[] = [];
  for await (const item of stream) output.push(item);
  return output;
}
function recoveryError(output: readonly (Output | Result<string, Error>)[]): RecoveryError {
  const last = output.at(-1);
  assert(last);
  let error: unknown;
  if ('ok' in last) {
    assert(!last.ok);
    error = last.error;
  } else {
    assert.equal(last.type, 'error');
    assert(last.type === 'error');
    error = last.error.detail;
  }
  assert(error instanceof RecoveryError);
  return error;
}
function content(output: readonly Output[]): string {
  return output
    .map((item) =>
      'ok' in item
        ? item.ok
          ? (item.value.content ?? '')
          : ''
        : item.type === 'content'
          ? item.text
          : ''
    )
    .join('');
}
function types(events: readonly RecoveryEvent[]): string[] {
  return events
    .filter((event) => event.type !== 'progress' && event.type !== 'metrics')
    .map((event) => event.type);
}
function truncated(text: string, status = 200): Reply {
  return (response) => {
    response.writeHead(status, { 'Content-Length': Buffer.byteLength(text) + 100 });
    response.write(text);
    setTimeout(() => response.destroy(), 10);
  };
}
let server: Server;
let url: string;
let replies: Reply[];
let requests: Buffer[];
let events: RecoveryEvent[];
let captures: RecoveryWireEvent[];
let options: RecoveryOptions;
beforeEach(async () => {
  replies = [];
  requests = [];
  events = [];
  captures = [];
  options = {
    maxAttempts: 3,
    baseDelayMs: 0,
    admit: async () => 'allow',
    onEvent: (event) => {
      events.push(event);
    },
    onWire: (event) => {
      captures.push(event);
    },
  };
  server = createServer(async (request, response) => {
    const parts: Buffer[] = [];
    for await (const part of request) parts.push(Buffer.from(part));
    requests.push(Buffer.concat(parts));
    const reply = replies.at(requests.length - 1);
    assert(reply, 'unexpected actual send');
    reply(response, request);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  if (process.env.MOJENTIC_STREAMING_EVIDENCE === '1') {
    console.log(
      'STREAMING_RECOVERY_TRACE ' +
        JSON.stringify({
          test: expect.getState().currentTestName,
          requests: requests.map((bytes) => bytes.toString('base64')),
          events,
          captures: captures.map((capture) => ({
            ...capture,
            bytes: Buffer.from(capture.bytes).toString('base64'),
            headers: Array.from(capture.headers.entries()),
          })),
        })
    );
  }
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
function respond(body: string, status = 200, headers: Record<string, string> = {}): Reply {
  return (response) => {
    response.writeHead(status, headers);
    response.end(body);
  };
}
function capturedResponse(attempt: number): Buffer {
  return Buffer.concat(
    captures
      .filter((event) => event.direction === 'response' && event.wireAttempt === attempt)
      .map((event) => Buffer.from(event.bytes))
  );
}
function checkRequests(): void {
  expect(
    captures
      .filter((event) => event.direction === 'request')
      .map((event) => Buffer.from(event.bytes))
  ).toEqual(requests);
  const started = events.filter((event) => event.type === 'attempt_started');
  expect(started.map((event) => event.wireAttempt)).toEqual(requests.map((_, index) => index + 1));
  expect(new Set(started.map((event) => event.attemptId)).size).toBe(requests.length);
  expect(new Set(started.map((event) => event.logicalRequestId)).size).toBe(1);
  for (const capture of captures) {
    const start = started.find((event) => event.wireAttempt === capture.wireAttempt);
    expect(capture.attemptId).toBe(start?.attemptId);
    expect(capture.logicalRequestId).toBe(start?.logicalRequestId);
  }
}
for (const provider of providers)
  for (const form of forms) {
    describe(`${provider.name} public ${form.name}`, () => {
      const messages = (): LlmMessage[] => [Message.user('payload-secret')];
      const run = (policy: RecoveryOptions = options): Promise<Output[]> =>
        collect(form.stream(provider.gateway(url), messages(), { recovery: policy }));
      const success = (): string => provider.frame({ content: 'answer' }, true) + provider.end;

      it('characterizes disabled one-send HTTP failure', async () => {
        replies.push(respond('{"error":"disabled"}', 503));

        const result = await collect(form.stream(provider.gateway(url), messages()));

        expect(content(result)).toBe('');
        expect(requests).toHaveLength(1);
        expect(result.at(-1)).toMatchObject(
          form.name === 'chunks' ? { ok: false } : { type: 'error' }
        );
      });

      it('preserves disabled successful content and terminal behavior', async () => {
        replies.push(respond(success()));

        const result = await collect(form.stream(provider.gateway(url), messages()));

        expect(content(result)).toBe('answer');
        expect(requests).toHaveLength(1);
      });

      it('recovers 503 with exact immutable requests, captures, identities and complete lifecycle', async () => {
        const body = success();
        replies.push(respond('{"error":"payload-secret credential-secret"}', 503), respond(body));
        const original = messages();

        const result = await collect(
          form.stream(provider.gateway(url), original, {
            recovery: {
              ...options,
              admit: async () => {
                original[0].content = 'mutated';
                return 'allow';
              },
            },
          })
        );

        expect(content(result)).toBe('answer');
        expect(requests).toHaveLength(2);
        expect(requests[1]).toEqual(requests[0]);
        expect(capturedResponse(1)).toEqual(
          Buffer.from('{"error":"payload-secret credential-secret"}')
        );
        expect(capturedResponse(2)).toEqual(Buffer.from(body));
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'admission_allowed',
          'delay_scheduled',
          'retry_started',
          'attempt_started',
          'attempt_succeeded',
        ]);
        expect(JSON.stringify(events)).not.toContain('payload-secret');
        expect(JSON.stringify(events)).not.toContain('credential-secret');
        checkRequests();
      });

      it.each([
        ['seconds', '2', 'seconds', 2000],
        ['date', 'Sat, 10 Oct 2026 00:00:02 GMT', 'date', 2000],
        ['past', 'Fri, 09 Oct 2026 00:00:00 GMT', 'date', 0],
        ['invalid', '1.5', 'invalid', 0],
        ['huge', '99999999999999999999999', 'invalid', 0],
        ['absent', '', 'absent', 0],
      ])('honors Retry-After %s without shortening delay', async (_name, header, kind, delay) => {
        const delays: number[] = [];
        replies.push(
          respond('{}', 429, header ? { 'Retry-After': header } : {}),
          respond(success())
        );

        await run({
          ...options,
          wallClock: () => Date.UTC(2026, 9, 10),
          sleep: async (ms) => {
            delays.push(ms);
          },
        });

        expect(delays).toEqual([delay]);
        expect(
          events.find((event) => event.type === 'attempt_failed')?.failure?.retryAfter.kind
        ).toBe(kind);
        expect(requests).toHaveLength(2);
        checkRequests();
      });

      it.each([
        ['ceiling', { delayCeilingMs: 999 }, 'delay_ceiling'],
        ['budget', { budgetMs: 999 }, 'deadline'],
      ] as const)('refuses Retry-After beyond %s', async (_name, limits, outcome) => {
        replies.push(respond('{}', 429, { 'Retry-After': '2' }));

        const error = recoveryError(await run({ ...options, ...limits }));

        expect(error.outcome).toBe(outcome);
        expect(requests).toHaveLength(1);
        expect(types(events)).not.toContain('retry_started');
      });

      it.each([301, 302, 307, 308, 421])(
        'sends once without hidden resends or redirects on %s',
        async (status) => {
          replies.push(
            respond('{}', status, { Location: `${url}/redirect-target` }),
            respond(success())
          );

          const error = recoveryError(await run({ ...options, maxAttempts: 1 }));

          expect(error.failure.httpStatus).toBe(status);
          expect(error.history).toHaveLength(1);
          expect(requests).toHaveLength(1);
          checkRequests();
        }
      );

      it('keeps recovery deadlines out of admitted active generation', async () => {
        let clock = 0;
        replies.push(respond('{}', 503), (response) => {
          clock = 100;
          response.end(success());
        });

        const result = await run({ ...options, wallClock: () => clock, deadlineMs: 10 });

        expect(content(result)).toBe('answer');
        expect(clock).toBe(100);
        expect(requests).toHaveLength(2);
        expect(types(events).at(-1)).toBe('attempt_succeeded');
      });

      it('refuses unselected categories and statuses without invoking admission', async () => {
        replies.push(respond('{}', 503));
        const admit = jest.fn(async (): Promise<'allow'> => 'allow');

        const error = recoveryError(
          await run({ ...options, retryableCategories: ['transport'], admit })
        );

        expect(error.failure.classification.eligible).toBe(false);
        expect(admit).not.toHaveBeenCalled();
        expect(requests).toHaveLength(1);
      });

      it('bounds persistent 504 and retains every actual attempt in history', async () => {
        replies.push(respond('{}', 504), respond('{}', 504), respond('{}', 504));

        const error = recoveryError(await run());

        expect(error.outcome).toBe('exhausted');
        expect(error.history.map((failure) => failure.wireAttempt)).toEqual([1, 2, 3]);
        expect(error.history.map((failure) => failure.attemptId)).toEqual(
          events.filter((event) => event.type === 'attempt_started').map((event) => event.attemptId)
        );
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'admission_allowed',
          'delay_scheduled',
          'retry_started',
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'admission_allowed',
          'delay_scheduled',
          'retry_started',
          'attempt_started',
          'attempt_failed',
          'exhausted',
        ]);
        checkRequests();
      });

      it.each([400, 401, 403])(
        'retains permanent %s despite truncated error bodies',
        async (status) => {
          replies.push(truncated('{"error":"payload-secret credential-secret', status));

          const error = recoveryError(await run({ ...options, retryableStatuses: [status] }));

          expect(error.failure).toMatchObject({
            httpStatus: status,
            classification: { eligible: false, reason: 'permanent' },
          });
          expect(error.history).toHaveLength(1);
          expect(Object.prototype.toString.call(inspectRecoveryFailure(error.failure)?.cause)).toBe(
            '[object Error]'
          );
          expect(inspectRecoveryFailure(error.failure)?.cause).toMatchObject({
            code: 'ECONNRESET',
          });
          expect(
            captures.filter((capture) => capture.direction === 'response').at(-1)?.complete
          ).toBe(false);
          expect(requests).toHaveLength(1);
          expect(JSON.stringify(error)).not.toContain('payload-secret');
          expect(inspectRecoveryFailure(error.failure)?.bytes).toEqual(
            Buffer.from('{"error":"payload-secret credential-secret')
          );
        }
      );

      it.each(['content', 'reasoning', 'tool'] as const)(
        'blocks replay after observed %s evidence',
        async (channel) => {
          const deltas = new Map<string, object>([
            ['content', { content: 'answer' }],
            ['reasoning', { thinking: 'thought', reasoning_content: 'thought' }],
            ['tool', { tool_calls: [provider.tool] }],
          ]);
          const partial = provider.frame(deltas.get(channel) ?? {});
          replies.push(truncated(partial));

          const error = recoveryError(await run());

          expect(error.outcome).toBe('interrupted');
          expect(error.failure.classification.reason).toBe('semantic_output');
          expect(Object.values(error.failure.progress.observed).some((count) => count > 0)).toBe(
            true
          );
          expect(requests).toHaveLength(1);
          expect(capturedResponse(1)).toEqual(Buffer.from(partial));
          expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
        }
      );

      it('recovers keepalive-only transport failure after explicit admission', async () => {
        replies.push(truncated(provider.keepalive), respond(success()));

        const result = await run();

        expect(content(result)).toBe('answer');
        expect(events.find((event) => event.type === 'attempt_failed')?.progress).toMatchObject({
          rawBytes: Buffer.byteLength(provider.keepalive),
          observed: { contentBytes: 0, reasoningBytes: 0, toolFragments: 0 },
          delivered: { contentBytes: 0 },
        });
        expect(requests).toHaveLength(2);
        checkRequests();
      });

      it.each(['content', 'reasoning', 'tools'] as const)(
        'retains observed but undelivered %s evidence when capture rejects',
        async (kind) => {
          const deltas = new Map<string, object>([
            ['content', { content: 'é🙂' }],
            [
              'reasoning',
              provider.name === 'ollama' ? { thinking: 'é🙂' } : { reasoning_content: 'é🙂' },
            ],
            ['tools', { tool_calls: [provider.tool] }],
          ]);
          const delta = deltas.get(kind);
          assert(delta);
          const body = provider.frame(delta);
          const cause = new RangeError('payload-secret capture');
          replies.push(respond(body));

          const error = recoveryError(
            await run({
              ...options,
              onWire: (event) => {
                captures.push(event);
                if (event.direction === 'response') throw cause;
              },
            })
          );

          expect(error.failure.progress).toMatchObject({
            headersReceived: true,
            rawBytes: Buffer.byteLength(body),
            observed: {
              contentBytes: kind === 'content' ? 6 : 0,
              reasoningBytes: kind === 'reasoning' ? 6 : 0,
              toolFragments: kind === 'tools' ? 1 : 0,
              completedToolCalls: 0,
            },
            delivered: {
              contentBytes: 0,
              reasoningBytes: 0,
              toolFragments: 0,
              completedToolCalls: 0,
            },
          });
          expect(error.failure.classification.reason).toBe('capture_failed');
          expect(inspectRecoveryFailure(error.failure)?.captureCause).toBe(cause);
          expect(Buffer.from(inspectRecoveryFailure(error.failure)?.bytes ?? [])).toEqual(
            Buffer.from(body)
          );
          expect(capturedResponse(1)).toEqual(Buffer.from(body));
          expect(JSON.stringify(error)).not.toContain('payload-secret');
          expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
          expect(requests).toHaveLength(1);
          checkRequests();
        }
      );

      it('preserves typed capture cause and observed progress through public broker streaming', async () => {
        const body = provider.frame({ content: 'é🙂' });
        const cause = new RangeError('payload-secret capture');
        replies.push(respond(body));
        const broker = new LlmBroker('gpt-4o', provider.gateway(url));
        const config = {
          recovery: {
            ...options,
            onWire: (event: RecoveryWireEvent) => {
              captures.push(event);
              if (event.direction === 'response') throw cause;
            },
          },
        };

        const output = await collect<Output | Result<string, Error>>(
          form.name === 'chunks'
            ? broker.generateStream(messages(), config)
            : broker.generateStreamEvents(messages(), config)
        );
        const error = recoveryError(output);

        expect(inspectRecoveryFailure(error.failure)?.captureCause).toBe(cause);
        expect(error.failure.progress).toMatchObject({
          observed: { contentBytes: 6 },
          delivered: {
            contentBytes: 0,
            reasoningBytes: 0,
            toolFragments: 0,
            completedToolCalls: 0,
          },
        });
        expect(Buffer.from(inspectRecoveryFailure(error.failure)?.bytes ?? [])).toEqual(
          Buffer.from(body)
        );
        expect(error.history).toEqual([error.failure]);
        expect(requests).toHaveLength(1);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
        checkRequests();
      });

      it('rejects malformed frames without invented telemetry or replay', async () => {
        replies.push(
          respond(provider.name === 'ollama' ? '{"done":"wrong"}\n' : 'data: not-json\n\n')
        );

        const error = recoveryError(await run());

        expect(error.failure.classification.reason).toBe('malformed');
        expect(
          events.filter((event) => event.type === 'progress' || event.type === 'metrics')
        ).toEqual([]);
        expect(requests).toHaveLength(1);
      });

      it('keeps rejected terminal telemetry without claiming successful completion', async () => {
        replies.push(
          respond(provider.frame({ content: 'partial' }, true, 'length') + provider.end)
        );

        const result = await run();
        const error = recoveryError(result);

        expect(error.outcome).toBe('interrupted');
        expect(error.failure.progress.delivered.contentBytes).toBe(
          provider.name === 'ollama' ? 0 : 7
        );
        expect(inspectRecoveryFailure(error.failure)?.responseEvidence).toMatchObject({
          finishReason: 'length',
          providerModel: 'reported',
          usage: { totalTokens: 5 },
        });
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
        expect(requests).toHaveLength(1);
      });

      it('retains accepted provider identity and reported usage', async () => {
        const body =
          provider.frame(
            provider.name === 'ollama'
              ? { content: 'é🙂', thinking: 'é🙂' }
              : { content: 'é🙂', reasoning_content: 'é🙂' },
            true
          ) + provider.end;
        replies.push(respond(body));

        const result = await run();
        const last = result.at(-1);

        expect(last).toMatchObject(
          form.name === 'chunks'
            ? {
                ok: true,
                value: {
                  evidence: {
                    providerModel: 'reported',
                    usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
                  },
                },
              }
            : {
                type: 'completed',
                metadata: {
                  providerModel: 'reported',
                  usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
                },
              }
        );
        expect(events.at(-1)?.progress).toMatchObject({
          rawBytes: Buffer.byteLength(body),
          observed: { contentBytes: 6, reasoningBytes: 6, toolFragments: 0, completedToolCalls: 0 },
          delivered: {
            contentBytes: 6,
            reasoningBytes: form.name === 'chunks' ? 6 : 0,
            toolFragments: 0,
            completedToolCalls: 0,
          },
        });
        expect(capturedResponse(1)).toEqual(Buffer.from(body));
        expect(types(events)).toEqual(['attempt_started', 'attempt_succeeded']);
        checkRequests();
      });

      it('keeps echoed provider metadata private on terminal failure', async () => {
        const echoed =
          provider.name === 'ollama'
            ? '{"model":"credential-secret payload-secret","done":true,"done_reason":"length","message":{},"total_duration":10}\n'
            : 'data: {"id":"credential-secret payload-secret","model":"credential-secret payload-secret","choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n';
        replies.push(respond(echoed, 200, { 'x-request-id': 'credential-secret payload-secret' }));

        const output = await run();
        const error = recoveryError(output);

        expect(JSON.stringify(output)).not.toContain('credential-secret');
        expect(JSON.stringify(output)).not.toContain('payload-secret');
        expect(JSON.stringify(events)).not.toContain('credential-secret');
        expect(inspectRecoveryFailure(error.failure)?.responseEvidence?.providerModel).toBe(
          'credential-secret payload-secret'
        );
        expect(requests).toHaveLength(1);
      });

      it('cancels a pending request before headers and records failure before cancellation', async () => {
        const controller = new AbortController();
        let sent: () => void = () => undefined;
        let close: () => void = () => undefined;
        const received = new Promise<void>((resolve) => {
          sent = resolve;
        });
        const closed = new Promise<void>((resolve) => {
          close = resolve;
        });
        replies.push((response) => {
          response.on('close', close);
          sent();
        });
        const result = run({ ...options, signal: controller.signal });
        await received;

        controller.abort();
        const error = recoveryError(await result);
        await closed;

        expect(error.failure.progress.headersReceived).toBe(false);
        expect(error.history).toHaveLength(1);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(requests).toHaveLength(1);
      });

      it('cancels pending response capture retaining observed but undelivered evidence', async () => {
        const controller = new AbortController();
        replies.push(respond(success()));

        const error = recoveryError(
          await run({
            ...options,
            signal: controller.signal,
            onWire: (event) => {
              captures.push(event);
              if (event.direction === 'response') {
                controller.abort();
                return new Promise(() => undefined);
              }
              return undefined;
            },
          })
        );

        expect(error.outcome).toBe('cancelled');
        expect(error.history).toHaveLength(1);
        expect(error.failure.progress).toMatchObject({
          observed: { contentBytes: 6 },
          delivered: { contentBytes: 0 },
        });
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(requests).toHaveLength(1);
      });

      it('cancels pending request capture before any send', async () => {
        const controller = new AbortController();

        const error = recoveryError(
          await run({
            ...options,
            signal: controller.signal,
            onWire: () => {
              controller.abort();
              return new Promise(() => undefined);
            },
          })
        );

        expect(error.outcome).toBe('cancelled');
        expect(error.failure.wireAttempt).toBe(0);
        expect(types(events)).toEqual(['cancelled']);
        expect(requests).toHaveLength(0);
      });

      it('keeps terminal telemetry buffered behind content and cancellation precedes completion', async () => {
        const controller = new AbortController();
        replies.push(respond(success()));
        const stream = form.stream(provider.gateway(url), messages(), {
          recovery: { ...options, signal: controller.signal },
        });
        const first = await stream.next();
        assert(!first.done);
        expect(content([first.value])).toBe('answer');

        controller.abort();
        const result = await collect(stream);
        const error = recoveryError(result);

        expect(error.outcome).toBe('cancelled');
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(error.failure.progress.delivered.contentBytes).toBe(6);
        expect(result).toHaveLength(1);
        expect(requests).toHaveLength(1);
      });

      it('closes owned resources when the consumer returns while paused', async () => {
        let close: () => void = () => undefined;
        const closed = new Promise<void>((resolve) => {
          close = resolve;
        });
        replies.push((response) => {
          response.on('close', close);
          response.write(provider.frame({ content: 'answer' }));
        });
        const stream = form.stream(provider.gateway(url), messages(), { recovery: options });
        const first = await stream.next();
        assert(!first.done);
        expect(content([first.value])).toBe('answer');

        await stream.return(undefined);
        await closed;

        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(requests).toHaveLength(1);
      });

      it('admits a pending ambiguous request only after explicit allow', async () => {
        let allow: (decision: 'allow') => void = () => undefined;
        let entered: () => void = () => undefined;
        const pending = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const decision = new Promise<'allow'>((resolve) => {
          allow = resolve;
        });
        replies.push(respond('{}', 503), respond(success()));
        const result = run({
          ...options,
          admit: () => {
            entered();
            return decision;
          },
        });
        await pending;
        expect(requests).toHaveLength(1);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'admission_pending']);

        allow('allow');
        const output = await result;

        expect(content(output)).toBe('answer');
        expect(requests).toHaveLength(2);
        checkRequests();
      });

      it('expires a pending admission budget without timing out active generation', async () => {
        replies.push(respond('{}', 503));
        let signal: AbortSignal | undefined;

        const error = recoveryError(
          await run({
            ...options,
            budgetMs: 20,
            admit: (context) => {
              signal = context.signal;
              return new Promise(() => undefined);
            },
          })
        );

        expect(error.outcome).toBe('deadline');
        expect(signal?.aborted).toBe(true);
        expect(requests).toHaveLength(1);
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'exhausted',
        ]);
      });

      it('cancellation from success telemetry suppresses buffered completion', async () => {
        const controller = new AbortController();
        replies.push(respond(success()));

        const result = await run({
          ...options,
          signal: controller.signal,
          onEvent: (event) => {
            events.push(event);
            if (event.type === 'attempt_succeeded') controller.abort();
          },
        });
        const error = recoveryError(result);

        expect(error.outcome).toBe('cancelled');
        expect(error.history).toHaveLength(1);
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_succeeded',
          'attempt_failed',
          'cancelled',
        ]);
        expect(result.at(-1)).not.toMatchObject({ type: 'completed' });
        expect(requests).toHaveLength(1);
      });

      it('does not resend while admission remains pending and cancels that wait', async () => {
        const controller = new AbortController();
        let pending: () => void = () => undefined;
        const entered = new Promise<void>((resolve) => {
          pending = resolve;
        });
        let admissionSignal: AbortSignal | undefined;
        replies.push(respond('{}', 503));
        const result = run({
          ...options,
          signal: controller.signal,
          admit: ({ signal }) => {
            admissionSignal = signal;
            pending();
            return new Promise(() => undefined);
          },
        });
        await entered;
        expect(requests).toHaveLength(1);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'admission_pending']);

        controller.abort();
        const error = recoveryError(await result);

        expect(error.outcome).toBe('cancelled');
        expect(admissionSignal?.aborted).toBe(true);
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'cancelled',
        ]);
        expect(requests).toHaveLength(1);
      });

      it('rejects ambiguous admission without another send', async () => {
        replies.push(respond('{}', 503));

        const error = recoveryError(await run({ ...options, admit: async () => 'reject' }));

        expect(error.outcome).toBe('admission_rejected');
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'admission_rejected',
        ]);
        expect(requests).toHaveLength(1);
      });

      it('cancels backoff without consuming an actual attempt', async () => {
        const controller = new AbortController();
        replies.push(respond('{}', 503));

        const error = recoveryError(
          await run({
            ...options,
            signal: controller.signal,
            sleep: async () => {
              controller.abort();
            },
          })
        );

        expect(error.outcome).toBe('cancelled');
        expect(types(events)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
          'admission_allowed',
          'delay_scheduled',
          'cancelled',
        ]);
        expect(requests).toHaveLength(1);
      });

      it('cancels before sending without recording an actual attempt', async () => {
        const controller = new AbortController();
        controller.abort();

        const error = recoveryError(await run({ ...options, signal: controller.signal }));

        expect(error.failure.wireAttempt).toBe(0);
        expect(error.history).toEqual([]);
        expect(types(events)).toEqual(['cancelled']);
        expect(requests).toHaveLength(0);
      });

      it('closes a paused consumer before cancellation is delivered', async () => {
        const controller = new AbortController();
        let close: () => void = () => undefined;
        const closed = new Promise<void>((resolve) => {
          close = resolve;
        });
        replies.push((response) => {
          response.on('close', close);
          response.write(provider.frame({ content: 'answer' }));
        });
        const stream = form.stream(provider.gateway(url), messages(), {
          recovery: { ...options, signal: controller.signal },
        });
        const first = await stream.next();
        assert(!first.done);
        expect(content([first.value])).toBe('answer');

        controller.abort();
        await closed;
        const error = recoveryError(await collect(stream));

        expect(error.outcome).toBe('cancelled');
        expect(error.history).toHaveLength(1);
        expect(error.history[0].progress.delivered.contentBytes).toBe(6);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(requests).toHaveLength(1);
      });
    });
  }

for (const provider of providers) {
  it(`${provider.name} broker executes completed tool once when the subsequent completion fails`, async () => {
    const calls: unknown[] = [];
    const tool: LlmTool = {
      name: () => 'counter',
      matches: (name) => name === 'counter',
      descriptor: () => ({
        type: 'function',
        function: {
          name: 'counter',
          description: 'Counts',
          parameters: { type: 'object', properties: { value: { type: 'number' } } },
        },
      }),
      run: async (args) => {
        calls.push(args);
        return Ok('counted');
      },
    };
    const history = [Message.user('payload-secret')];
    replies.push(
      respond(
        provider.frame(
          { tool_calls: [provider.tool] },
          true,
          provider.name === 'ollama' ? 'stop' : 'tool_calls'
        ) + provider.end
      ),
      respond('{}', 503),
      respond('{}', 503)
    );
    const broker = new LlmBroker('gpt-4o', provider.gateway(url));

    const output = [];
    for await (const item of broker.generateStream(
      history,
      { recovery: { ...options, maxAttempts: 2 } },
      [tool]
    ))
      output.push(item);

    expect(calls).toEqual([{ value: 7 }]);
    expect(requests).toHaveLength(3);
    expect(requests[2]).toEqual(requests[1]);
    expect(requests[1].toString()).toContain('counted');
    expect(history.map((message) => message.role)).toEqual(['user', 'assistant', 'tool']);
    expect(output.at(-1)).toMatchObject({
      ok: false,
      error: { outcome: 'exhausted', history: [{ wireAttempt: 1 }, { wireAttempt: 2 }] },
    });
    const starts = events.filter((event) => event.type === 'attempt_started');
    expect(starts[0].logicalRequestId).not.toBe(starts[1].logicalRequestId);
    expect(starts[1].logicalRequestId).toBe(starts[2].logicalRequestId);
    expect(types(events)).toEqual([
      'attempt_started',
      'attempt_succeeded',
      'attempt_started',
      'attempt_failed',
      'admission_pending',
      'admission_allowed',
      'delay_scheduled',
      'retry_started',
      'attempt_started',
      'attempt_failed',
      'exhausted',
    ]);
    const requestCaptures = captures.filter((capture) => capture.direction === 'request');
    expect(requestCaptures.map((capture) => Buffer.from(capture.bytes))).toEqual(requests);
    expect(requestCaptures.map((capture) => capture.attemptId)).toEqual(
      starts.map((event) => event.attemptId)
    );
    expect(requestCaptures.map((capture) => capture.logicalRequestId)).toEqual(
      starts.map((event) => event.logicalRequestId)
    );
  });
}

for (const form of forms) {
  it(`Ollama ${form.name} emits length-terminated Progress/Metrics/Failed without completed tools`, async () => {
    const provider = providers[0];
    const terminal =
      JSON.stringify({
        model: 'reported',
        message: { content: 'é🙂', thinking: 'é🙂', tool_calls: [provider.tool] },
        done: true,
        done_reason: 'length',
        prompt_eval_count: 2,
        eval_count: 3,
        total_duration: 10,
        load_duration: 2,
        prompt_eval_duration: 3,
        eval_duration: 5,
      }) + '\n';
    replies.push(respond(terminal));

    const output = await collect(
      form.stream(provider.gateway(url), [Message.user('test')], { recovery: options })
    );
    const error = recoveryError(output);

    expect(events.map((event) => event.type)).toEqual([
      'attempt_started',
      'progress',
      'metrics',
      'attempt_failed',
      'interrupted',
    ]);
    expect(events[1].frameIndex).toBe(1);
    expect(events[2].metrics).toEqual({
      total_duration: 10,
      load_duration: 2,
      prompt_eval_duration: 3,
      eval_duration: 5,
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
    });
    expect(events[1].progress).toMatchObject({
      rawBytes: Buffer.byteLength(terminal),
      observed: { contentBytes: 6, reasoningBytes: 6, toolFragments: 1, completedToolCalls: 0 },
      delivered: { contentBytes: 0, reasoningBytes: 0, toolFragments: 0, completedToolCalls: 0 },
    });
    expect(events[2].attemptId).toBe(events[0].attemptId);
    expect(events[2].logicalRequestId).toBe(events[0].logicalRequestId);
    expect(capturedResponse(1)).toEqual(Buffer.from(terminal));
    expect(error.failure.progress.observed.completedToolCalls).toBe(0);
    expect(error.failure.progress.delivered.completedToolCalls).toBe(0);
    expect(error.failure.progress.delivered.toolFragments).toBe(0);
    expect(output).not.toContainEqual(
      expect.objectContaining({ ok: true, value: expect.objectContaining({ done: true }) })
    );
    expect(requests).toHaveLength(1);
  });

  it(`Ollama ${form.name} resets telemetry frame indices for each actual attempt`, async () => {
    const provider = providers[0];
    replies.push(
      truncated(provider.frame({})),
      respond(provider.frame({ content: 'answer' }, true))
    );

    const output = await collect(
      form.stream(provider.gateway(url), [Message.user('test')], { recovery: options })
    );

    expect(content(output)).toBe('answer');
    expect(
      events
        .filter((event) => event.type === 'progress')
        .map((event) => [event.wireAttempt, event.frameIndex])
    ).toEqual([
      [1, 1],
      [2, 1],
    ]);
    checkRequests();
  });

  it.each(['progress', 'metrics'] as const)(
    `Ollama ${form.name} cancellation from terminal %s precedes buffered content/completion`,
    async (transition) => {
      const provider = providers[0];
      const controller = new AbortController();
      replies.push(respond(provider.frame({ content: 'answer' }, true)));

      const output = await collect(
        form.stream(provider.gateway(url), [Message.user('test')], {
          recovery: {
            ...options,
            signal: controller.signal,
            onEvent: (event) => {
              events.push(event);
              if (event.type === transition) controller.abort();
            },
          },
        })
      );
      const error = recoveryError(output);

      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'progress',
        ...(transition === 'metrics' ? ['metrics'] : []),
        'attempt_failed',
        'cancelled',
      ]);
      expect(content(output)).toBe('');
      expect(error.failure.progress).toMatchObject({
        observed: { contentBytes: 6 },
        delivered: { contentBytes: 0 },
      });
      expect(error.history).toHaveLength(1);
      expect(requests).toHaveLength(1);
    }
  );
}

for (const provider of providers.filter((item) => item.name !== 'openai'))
  for (const form of forms) {
    it(`${provider.name} ${form.name} requires explicit admission for ambiguous local sends`, async () => {
      replies.push(truncated(provider.keepalive));

      const output = await collect(
        form.stream(provider.gateway(url), [Message.user('test')], {
          recovery: { ...options, admit: undefined },
        })
      );
      const error = recoveryError(output);

      expect(error.outcome).toBe('admission_required');
      expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'admission_required']);
      expect(requests).toHaveLength(1);
    });
  }

for (const provider of providers) {
  it(`${provider.name} broker event streaming recovers one turn without introducing tools`, async () => {
    const body = provider.frame({ content: 'answer' }, true) + provider.end;
    replies.push(respond('{}', 503), respond(body));
    const broker = new LlmBroker('gpt-4o', provider.gateway(url));

    const output = await collect(
      broker.generateStreamEvents([Message.user('test')], { recovery: options })
    );

    expect(content(output)).toBe('answer');
    expect(output.at(-1)).toMatchObject({ type: 'completed' });
    expect(requests[0].toString()).not.toContain('"tools"');
    expect(requests[1]).toEqual(requests[0]);
    checkRequests();
  });

  it(`${provider.name} explicit event signal cannot override an aborted recovery signal`, async () => {
    const controller = new AbortController();
    const explicit = new AbortController();
    controller.abort();
    const broker = new LlmBroker('gpt-4o', provider.gateway(url));

    const output = await collect(
      broker.generateStreamEvents(
        [Message.user('test')],
        { recovery: { ...options, signal: controller.signal } },
        { signal: explicit.signal }
      )
    );

    expect(recoveryError(output).outcome).toBe('cancelled');
    expect(requests).toHaveLength(0);
    expect(types(events)).toEqual(['cancelled']);
  });
}

for (const provider of providers.filter((item) => item.name !== 'ollama'))
  for (const form of forms) {
    it(`${provider.name} ${form.name} observes escaped semantic keys before a capture failure`, async () => {
      replies.push(
        respond('data: {"choices":[{"delt\\u0061":{"content":"answer"},"finish_reason":null}]}\n\n')
      );

      const output = await collect(
        form.stream(provider.gateway(url), [Message.user('test')], {
          recovery: {
            ...options,
            onWire: (event) => {
              if (event.direction === 'response') throw new Error('capture');
            },
          },
        })
      );
      const error = recoveryError(output);

      expect(error.failure.progress).toMatchObject({
        observed: { contentBytes: 6 },
        delivered: { contentBytes: 0 },
      });
      expect(error.failure.classification.reason).toBe('capture_failed');
      expect(requests).toHaveLength(1);
    });

    it(`${provider.name} ${form.name} observes whitespace-prefixed SSE before interruption`, async () => {
      replies.push(truncated('  ' + provider.frame({ content: 'answer' })));

      const output = await collect(
        form.stream(provider.gateway(url), [Message.user('test')], { recovery: options })
      );
      const error = recoveryError(output);

      expect(content(output)).toBe('answer');
      expect(error.failure.progress.observed.contentBytes).toBe(6);
      expect(error.failure.classification.reason).toBe('semantic_output');
      expect(requests).toHaveLength(1);
    });

    it(`${provider.name} ${form.name} observes a legacy function call without replay`, async () => {
      replies.push(
        respond(provider.frame({ function_call: { name: 'counter', arguments: '{}' } }))
      );

      const output = await collect(
        form.stream(provider.gateway(url), [Message.user('test')], { recovery: options })
      );
      const error = recoveryError(output);

      expect(error.failure.progress.observed.toolFragments).toBe(1);
      expect(error.failure.classification.reason).toBe('semantic_output');
      expect(requests).toHaveLength(1);
    });
  }

// This assignable signature exercises the missing optional argument on the preserved source too.
it('session recovery proof preserves completed tools and exact admitted follow-up bytes', async () => {
  const calls: unknown[] = [];
  const tool: LlmTool = {
    name: () => 'counter',
    matches: (name) => name === 'counter',
    descriptor: () => ({
      type: 'function',
      function: { name: 'counter', description: 'Counts', parameters: { type: 'object' } },
    }),
    run: async (args) => {
      calls.push(args);
      return Ok('counted');
    },
  };
  const provider = providers[0];
  replies.push(
    respond(provider.frame({ tool_calls: [provider.tool] }, true)),
    respond('{}', 503),
    respond(provider.frame({ content: 'answer' }, true))
  );
  const session = new ChatSession(new LlmBroker('gpt-4o', provider.gateway(url)), {
    tools: [tool],
    temperature: 0.4,
  });
  const send: (query: string, recovery?: RecoveryOptions) => AsyncGenerator<string> =
    session.sendStream.bind(session);

  const output = await collect(send('payload-secret', options));

  expect(output).toEqual(['answer']);
  expect(calls).toEqual([{ value: 7 }]);
  expect(session.getMessages().map((message) => message.role)).toEqual([
    'system',
    'user',
    'assistant',
    'tool',
    'assistant',
  ]);
  expect(requests).toHaveLength(3);
  expect(requests[2]).toEqual(requests[1]);
  expect(requests[1].toString()).toContain('counted');
  expect(JSON.parse(requests[1].toString()).options.temperature).toBe(0.4);
  const starts = events.filter((event) => event.type === 'attempt_started');
  expect(starts.map((event) => event.wireAttempt)).toEqual([1, 1, 2]);
  expect(new Set(starts.map((event) => event.attemptId)).size).toBe(3);
  expect(starts[0].logicalRequestId).not.toBe(starts[1].logicalRequestId);
  expect(starts[1].logicalRequestId).toBe(starts[2].logicalRequestId);
  expect(
    captures
      .filter((capture) => capture.direction === 'request')
      .map((capture) => Buffer.from(capture.bytes))
  ).toEqual(requests);
  session.dispose();
});

/** Retain the thrown object, rather than converting public session errors to result strings. */
async function sessionFailure(stream: AsyncGenerator<string>): Promise<RecoveryError> {
  try {
    await collect(stream);
  } catch (error) {
    assert(error instanceof RecoveryError);
    return error;
  }
  throw new Error('Expected the public session stream to reject');
}
function counterTool(calls: unknown[]): LlmTool {
  return {
    name: () => 'counter',
    matches: (name) => name === 'counter',
    descriptor: () => ({
      type: 'function',
      function: {
        name: 'counter',
        description: 'Counts',
        parameters: { type: 'object', properties: { value: { type: 'number' } } },
      },
    }),
    run: async (args) => {
      calls.push(args);
      return Ok('counted');
    },
  };
}
for (const provider of providers) {
  describe(`${provider.name} public session streaming`, () => {
    let session: ChatSession;
    let calls: unknown[];
    let sized: string[];
    beforeEach(() => {
      calls = [];
      sized = [];
      session = new ChatSession(new LlmBroker('gpt-4o', provider.gateway(url)), {
        systemPrompt: 'system-secret',
        temperature: 0.4,
        tools: [counterTool(calls)],
        tokenizerGateway: {
          encode: (text) => {
            sized.push(text);
            return Array.from(text, (_, index) => index);
          },
          decode: () => '',
          free: () => undefined,
        },
      });
    });
    afterEach(() => session.dispose());
    const answer = (): string => provider.frame({ content: 'answer' }, true) + provider.end;
    const toolReply = (): string =>
      provider.frame(
        { tool_calls: [provider.tool] },
        true,
        provider.name === 'ollama' ? 'stop' : 'tool_calls'
      ) + provider.end;

    it('characterizes disabled tool success copying history and sizing only final content', async () => {
      replies.push(respond(toolReply()), respond(answer()));

      const output = await collect(session.sendStream('query'));

      expect(output).toEqual(['answer']);
      expect(calls).toEqual([{ value: 7 }]);
      expect(session.getMessages().map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
      ]);
      expect(sized).toEqual(['system-secret', 'query', 'answer']);
      expect(requests[1].toString()).toContain('counted');
      expect(events).toEqual([]);
    });

    it('characterizes disabled partial failure retaining user without assistant or retry', async () => {
      replies.push(truncated(provider.frame({ content: 'partial' })));
      const chunks: string[] = [];

      await expect(
        (async () => {
          for await (const chunk of session.sendStream('query')) chunks.push(chunk);
        })()
      ).rejects.toBeInstanceOf(Error);

      expect(chunks).toEqual(['partial']);
      expect(requests).toHaveLength(1);
      expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
      expect(sized).toEqual(['system-secret', 'query']);
    });

    it('consumer return closes recovery resources and omits incomplete assistant', async () => {
      let close: () => void = () => undefined;
      const closed = new Promise<void>((resolve) => {
        close = resolve;
      });
      replies.push((response) => {
        response.on('close', close);
        response.write(provider.frame({ content: 'partial' }));
      });
      const stream = session.sendStream('query', options);
      expect(await stream.next()).toEqual({ value: 'partial', done: false });

      await stream.return(undefined);
      await closed;

      expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
      expect(sized).toEqual(['system-secret', 'query']);
      expect(requests).toHaveLength(1);
      expect(events.filter((event) => event.type === 'attempt_succeeded')).toEqual([]);
    });

    it('characterizes disabled consumer return without promising legacy transport cancellation', async () => {
      replies.push((response) => {
        response.write(provider.frame({ content: 'partial' }));
      });
      const stream = session.sendStream('query');
      expect(await stream.next()).toEqual({ value: 'partial', done: false });

      await stream.return(undefined);

      expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
      expect(sized).toEqual(['system-secret', 'query']);
      expect(requests).toHaveLength(1);
      expect(events).toEqual([]);
    });

    it('sizes successful tool history before applying the existing exact context eviction order', async () => {
      session.dispose();
      session = new ChatSession(new LlmBroker('gpt-4o', provider.gateway(url)), {
        systemPrompt: 'system-secret',
        maxContext: 35,
        tools: [counterTool(calls)],
        tokenizerGateway: {
          encode: (text) => Array.from(text, (_, index) => index),
          decode: () => '',
          free: () => undefined,
        },
      });
      replies.push(respond(toolReply()), respond(answer()), respond(answer()));
      await collect(session.sendStream('query', options));
      expect(session.getMessages().map((message) => message.role)).toEqual([
        'system',
        'user',
        'assistant',
        'tool',
        'assistant',
      ]);

      await collect(session.sendStream('next-query', options));

      expect(session.getMessages()).toEqual([
        { role: 'system', content: 'system-secret' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'next-query' },
        { role: 'assistant', content: 'answer' },
      ]);
      expect(JSON.parse(requests[2].toString()).messages).toEqual([
        { role: 'system', content: 'system-secret' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'next-query' },
      ]);
      expect(calls).toEqual([{ value: 7 }]);
    });

    it('cancels buffered terminal frames while paused without storing final assistant text', async () => {
      const controller = new AbortController();
      let close: () => void = () => undefined;
      const closed = new Promise<void>((resolve) => {
        close = resolve;
      });
      replies.push((response) => {
        response.on('close', close);
        response.end(answer());
      });
      const stream = session.sendStream('query', { ...options, signal: controller.signal });
      expect(await stream.next()).toEqual({ done: false, value: 'answer' });
      await closed;

      controller.abort();
      const error = await sessionFailure(stream);

      expect(error.outcome).toBe('cancelled');
      expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
      expect(error.failure.progress.delivered.contentBytes).toBe(6);
      expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
      checkRequests();
    });

    it('recovers with immutable supported prior history, tools and temperature', async () => {
      replies.push(respond(answer()));
      await collect(session.sendStream('previous'));
      const history = session.getMessages();
      replies.push(respond('{}', 503), respond(answer()));

      const output = await collect(
        session.sendStream('query', {
          ...options,
          admit: async () => {
            history[1].content = 'mutated external snapshot';
            return 'allow';
          },
        })
      );

      expect(output).toEqual(['answer']);
      expect(requests[2]).toEqual(requests[1]);
      const request = JSON.parse(requests[1].toString());
      expect(request.messages).toEqual([
        { role: 'system', content: 'system-secret' },
        { role: 'user', content: 'previous' },
        { role: 'assistant', content: 'answer' },
        { role: 'user', content: 'query' },
      ]);
      expect(request.tools[0].function).toEqual(counterTool([]).descriptor().function);
      expect(provider.name === 'ollama' ? request.options.temperature : request.temperature).toBe(
        0.4
      );
      expect(session.getMessages()[1].content).toBe('previous');
      expect(
        captures
          .filter((capture) => capture.direction === 'request')
          .map((capture) => Buffer.from(capture.bytes))
      ).toEqual(requests.slice(1));
      // The first, disabled completion emits no recovery lifecycle.
      expect(
        events.filter((event) => event.type === 'attempt_started').map((event) => event.wireAttempt)
      ).toEqual([1, 2]);
      expect(
        new Set(
          events.filter((event) => event.type === 'attempt_started').map((event) => event.attemptId)
        ).size
      ).toBe(2);
      expect(
        new Set(
          events
            .filter((event) => event.type === 'attempt_started')
            .map((event) => event.logicalRequestId)
        ).size
      ).toBe(1);
    });

    it.each(['success', 'exhausted', 'interrupted'] as const)(
      'executes completed tools once and preserves history on follow-up %s',
      async (outcome) => {
        replies.push(respond(toolReply()));
        const followups = new Map<string, Reply[]>([
          ['success', [respond('{}', 503), respond(answer())]],
          ['exhausted', [respond('{}', 503), respond('{}', 503)]],
          ['interrupted', [truncated(provider.frame({ content: 'partial' }))]],
        ]);
        const selected = followups.get(outcome);
        assert(selected);
        replies.push(...selected);
        const result = await settleSession(
          session.sendStream('query', { ...options, maxAttempts: 2 })
        );
        const expected = new Map<string, object>([
          ['success', { output: ['answer'] }],
          [
            'exhausted',
            { error: { outcome: 'exhausted', history: [{ wireAttempt: 1 }, { wireAttempt: 2 }] } },
          ],
          ['interrupted', { error: { outcome: 'interrupted', history: [{ wireAttempt: 1 }] } }],
        ]);
        const expectedResult = expected.get(outcome);
        assert(expectedResult);
        expect(result).toMatchObject(expectedResult);
        expect(result.error?.history.at(-1)).toBe(result.error?.failure);

        expect(calls).toEqual([{ value: 7 }]);
        expect(session.getMessages().map((message) => message.role)).toEqual(
          outcome === 'success'
            ? ['system', 'user', 'assistant', 'tool', 'assistant']
            : ['system', 'user', 'assistant', 'tool']
        );
        expect(session.getMessages()[3].content).toBe(JSON.stringify('counted'));
        expect(sized).toEqual(
          outcome === 'success'
            ? ['system-secret', 'query', JSON.stringify('counted'), 'answer']
            : ['system-secret', 'query']
        );
        const starts = events.filter((event) => event.type === 'attempt_started');
        expect(starts.map((event) => event.wireAttempt)).toEqual(
          outcome === 'interrupted' ? [1, 1] : [1, 1, 2]
        );
        expect(starts[0].logicalRequestId).not.toBe(starts[1].logicalRequestId);
        expect(new Set(starts.slice(1).map((event) => event.logicalRequestId)).size).toBe(1);
        expect(new Set(starts.map((event) => event.attemptId)).size).toBe(requests.length);
        expect(
          captures
            .filter((capture) => capture.direction === 'request')
            .map((capture) => Buffer.from(capture.bytes))
        ).toEqual(requests);
        expect(requests[1].toString()).toContain('counted');
        expect(requests.slice(1)).toEqual(
          Array.from({ length: outcome === 'interrupted' ? 1 : 2 }, () => requests[1])
        );
        // A later success sizes completed history retained by a failed follow-up too.
        replies.push(respond(answer()));
        await collect(session.sendStream('next', options));
        expect(sized).toContain(JSON.stringify('counted'));
      }
    );

    it.each(['content', 'reasoning', 'tools'] as const)(
      'retains original capture cause and observed/undelivered %s through session',
      async (kind) => {
        const body = provider.frame(semanticDelta(provider, kind));
        const cause = new RangeError('payload-secret credential-secret capture');
        replies.push(respond(body));

        const error = await sessionFailure(
          session.sendStream('query', {
            ...options,
            onWire: (event) => {
              captures.push(event);
              if (event.direction === 'response') throw cause;
            },
          })
        );

        expect(inspectRecoveryFailure(error.failure)?.captureCause).toBe(cause);
        expect(Buffer.from(inspectRecoveryFailure(error.failure)?.bytes ?? [])).toEqual(
          Buffer.from(body)
        );
        expect(error.history).toEqual([error.failure]);
        expect(error.failure.progress).toMatchObject({
          rawBytes: Buffer.byteLength(body),
          observed: {
            contentBytes: kind === 'content' ? 6 : 0,
            reasoningBytes: kind === 'reasoning' ? 6 : 0,
            toolFragments: kind === 'tools' ? 1 : 0,
            completedToolCalls: 0,
          },
          delivered: {
            contentBytes: 0,
            reasoningBytes: 0,
            toolFragments: 0,
            completedToolCalls: 0,
          },
        });
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
        expect(JSON.stringify({ error, events })).not.toMatch(
          /payload-secret|credential-secret|system-secret/
        );
        expect(calls).toEqual([]);
        expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
        checkRequests();
      }
    );

    it.each(['content', 'reasoning', 'tools'] as const)(
      'interrupts observed %s without replay or incomplete tool execution',
      async (kind) => {
        const body = provider.frame(semanticDelta(provider, kind));
        replies.push(truncated(body));

        const result = await settleSession(session.sendStream('query', options));

        expect(result.output).toEqual(kind === 'content' ? ['é🙂'] : []);
        assert(result.error);
        expect(result.error.outcome).toBe('interrupted');
        expect(result.error.failure.progress.observed).toEqual({
          contentBytes: kind === 'content' ? 6 : 0,
          reasoningBytes: kind === 'reasoning' ? 6 : 0,
          toolFragments: kind === 'tools' ? 1 : 0,
          completedToolCalls: 0,
        });
        // Delivered progress measures the gateway boundary, including reasoning/tool fragments
        // consumed by the broker; the session's public output remains strings of content.
        expect(result.error.failure.progress.delivered).toEqual(
          result.error.failure.progress.observed
        );
        expect(result.error.history).toEqual([result.error.failure]);
        expect(events.find((event) => event.type === 'attempt_failed')?.failure).toBe(
          result.error.failure
        );
        expect(inspectRecoveryFailure(result.error.failure)?.cause).toMatchObject({
          code: 'ECONNRESET',
        });
        expect(calls).toEqual([]);
        expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'interrupted']);
        checkRequests();
      }
    );

    it('recovers keepalive-only interruption with explicit admission and fixed request bytes', async () => {
      replies.push(truncated(provider.keepalive), respond(answer()));

      const output = await collect(session.sendStream('query', options));

      expect(output).toEqual(['answer']);
      expect(requests[1]).toEqual(requests[0]);
      expect(events.find((event) => event.type === 'attempt_failed')?.progress).toMatchObject({
        rawBytes: Buffer.byteLength(provider.keepalive),
        observed: { contentBytes: 0, reasoningBytes: 0, toolFragments: 0 },
      });
      expect(types(events)).toEqual([
        'attempt_started',
        'attempt_failed',
        'admission_pending',
        'admission_allowed',
        'delay_scheduled',
        'retry_started',
        'attempt_started',
        'attempt_succeeded',
      ]);
      checkRequests();
    });

    it.each(['active', 'admission', 'backoff'] as const)(
      'cancels during %s with one terminal cancellation and no later success',
      async (phase) => {
        const controller = new AbortController();
        let requestSeen: () => void = () => undefined;
        const seen = new Promise<void>((resolve) => {
          requestSeen = resolve;
        });
        const reply =
          phase === 'active'
            ? (response: ServerResponse) => response.flushHeaders()
            : respond('{}', 503);
        replies.push((response, request) => {
          reply(response, request);
          requestSeen();
        });
        const stream = session.sendStream('query', {
          ...options,
          signal: controller.signal,
          admit:
            phase === 'admission'
              ? async () => {
                  controller.abort();
                  return new Promise(() => undefined);
                }
              : async () => 'allow',
          sleep: async () => {
            controller.abort();
          },
        });
        const failure = sessionFailure(stream);
        await seen;
        const cancel = phase === 'active' ? () => controller.abort() : () => undefined;
        cancel();

        const error = await failure;

        expect(error.outcome).toBe('cancelled');
        expect(error.history).toHaveLength(1);
        const lifecycle = types(events);
        expect(lifecycle.indexOf('attempt_failed')).toBeLessThan(lifecycle.indexOf('cancelled'));
        expect(lifecycle.filter((type) => type === 'cancelled')).toHaveLength(1);
        expect(lifecycle).not.toContain('attempt_succeeded');
        expect(lifecycle.at(-1)).toBe('cancelled');
        expect(requests).toHaveLength(1);
        expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
        checkRequests();
      }
    );

    it('closes an active socket while consumer is paused before delivering cancellation', async () => {
      const controller = new AbortController();
      let close: () => void = () => undefined;
      const closed = new Promise<void>((resolve) => {
        close = resolve;
      });
      replies.push((response) => {
        response.on('close', close);
        response.write(provider.frame({ content: 'é🙂' }));
      });
      const stream = session.sendStream('query', { ...options, signal: controller.signal });
      expect(await stream.next()).toEqual({ done: false, value: 'é🙂' });

      controller.abort();
      await closed;
      const error = await sessionFailure(stream);

      expect(error.outcome).toBe('cancelled');
      expect(error.failure.progress.delivered.contentBytes).toBe(6);
      expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
      expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
      checkRequests();
    });

    it.each(provider.name === 'ollama' ? ['progress', 'metrics'] : ['wire'])(
      'cancels buffered terminal content from %s before delivery',
      async (transition) => {
        const controller = new AbortController();
        replies.push(respond(answer()));

        const error = await sessionFailure(
          session.sendStream('query', {
            ...options,
            signal: controller.signal,
            onWire: (event) => {
              captures.push(event);
              const cancel =
                transition === 'wire' && event.direction === 'response'
                  ? () => controller.abort()
                  : () => undefined;
              cancel();
            },
            onEvent: (event) => {
              events.push(event);
              const cancel = event.type === transition ? () => controller.abort() : () => undefined;
              cancel();
            },
          })
        );

        expect(error.outcome).toBe('cancelled');
        expect(error.failure.progress).toMatchObject({
          observed: { contentBytes: 6 },
          delivered: { contentBytes: 0 },
        });
        expect(types(events)).toEqual(['attempt_started', 'attempt_failed', 'cancelled']);
        expect(session.getMessages().map((message) => message.role)).toEqual(['system', 'user']);
        checkRequests();
      }
    );

    it('reports provider terminal telemetry before completion without invented fields', async () => {
      replies.push(respond(answer()));

      expect(await collect(session.sendStream('query', options))).toEqual(['answer']);

      const metrics = events.filter((event) => event.type === 'metrics');
      expect(metrics.map((event) => event.metrics)).toEqual(
        provider.name === 'ollama'
          ? [{ promptTokens: 2, completionTokens: 3, totalTokens: 5, total_duration: 10 }]
          : []
      );
      const ordered = events.map((event) => event.type);
      expect(ordered).toEqual(
        provider.name === 'ollama'
          ? ['attempt_started', 'progress', 'metrics', 'attempt_succeeded']
          : ['attempt_started', 'attempt_succeeded']
      );
      checkRequests();
    });
  });
}

async function settleSession(
  stream: AsyncGenerator<string>
): Promise<{ output: string[]; error?: RecoveryError }> {
  const output: string[] = [];
  try {
    for await (const chunk of stream) output.push(chunk);
    return { output };
  } catch (error) {
    assert(error instanceof RecoveryError);
    return { output, error };
  }
}

function semanticDelta(provider: Provider, kind: 'content' | 'reasoning' | 'tools'): object {
  const deltas = new Map<string, object>([
    ['content', { content: 'é🙂' }],
    ['reasoning', provider.name === 'ollama' ? { thinking: 'é🙂' } : { reasoning_content: 'é🙂' }],
    ['tools', { tool_calls: [provider.tool] }],
  ]);
  const delta = deltas.get(kind);
  assert(delta);
  return delta;
}
