/** Public loopback conformance. No fetch mocks, no live inference, no private engine tests. */
import { strict as assert } from 'node:assert';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmBroker } from './broker';
import { ChatSession } from './chat-session';
import { LlmGateway } from './gateway';
import { CompletionConfig, Message } from './models';
import { OllamaGateway } from './gateways/ollama';
import { OMLXGateway } from './gateways/omlx';
import { OpenAIGateway } from './gateways/openai';
import {
  RecoveryError,
  RecoveryEvent,
  RecoveryOptions,
  RecoveryWireEvent,
  inspectRecoveryFailure,
} from './recovery';
import { Err, Ok, Result } from '../error';
import { LlmTool } from './tools';

type Reply = (response: ServerResponse, request: IncomingMessage) => void;
interface Send {
  readonly bytes: Buffer;
  readonly path: string | undefined;
  readonly authorization: string | undefined;
}
interface Provider {
  readonly name: 'ollama' | 'omlx' | 'openai';
  readonly gateway: (url: string) => LlmGateway;
  readonly path: string;
  readonly success: (content: string) => object;
  readonly tool: object;
  readonly partial: string;
}
const providers: Provider[] = [
  {
    name: 'ollama',
    gateway: (url) => new OllamaGateway(url),
    path: '/api/chat',
    success: (content) => ({ model: 'test', done: true, message: { role: 'assistant', content } }),
    tool: {
      done: true,
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call-one', function: { name: 'counter', arguments: {} } }],
      },
    },
    partial: '{"message":{"content":"payload-secret',
  },
  {
    name: 'omlx',
    gateway: (url) => new OMLXGateway(url, 'credential-secret', 10000),
    path: '/v1/chat/completions',
    success: (content) => ({
      model: 'test',
      choices: [{ message: { content }, finish_reason: 'stop' }],
    }),
    tool: {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              { id: 'call-one', type: 'function', function: { name: 'counter', arguments: '{}' } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    },
    partial: '{"choices":[{"message":{"content":"payload-secret',
  },
  {
    name: 'openai',
    gateway: (url) => new OpenAIGateway('credential-secret', url),
    path: '/chat/completions',
    success: (content) => ({
      model: 'test',
      choices: [{ message: { content }, finish_reason: 'stop' }],
    }),
    tool: {
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              { id: 'call-one', type: 'function', function: { name: 'counter', arguments: '{}' } },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    },
    partial: '{"choices":[{"message":{"content":"payload-secret',
  },
];
const jsonReply =
  (status: number, value: object, headers: Record<string, string> = {}): Reply =>
  (response) => {
    response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    response.end(JSON.stringify(value));
  };
const truncate =
  (status: number, body: string, headers: Record<string, string> = {}): Reply =>
  (response) => {
    response.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body) + 100,
      ...headers,
    });
    response.write(body);
    setTimeout(() => response.destroy(), 10);
  };
function failed<T>(result: Result<T, Error>): RecoveryError {
  assert(!result.ok);
  assert(result.error instanceof RecoveryError);
  return result.error;
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {
    throw new Error('uninitialized deferred');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.each(providers)('$name public HTTP recovery', (provider) => {
  let server: Server;
  let url: string;
  let replies: Reply[];
  let sends: Send[];
  let events: RecoveryEvent[];
  let wires: RecoveryWireEvent[];
  beforeEach(async () => {
    sends = [];
    events = [];
    wires = [];
    replies = [];
    server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      sends.push({
        bytes: Buffer.concat(chunks),
        path: request.url,
        authorization: request.headers.authorization,
      });
      const reply = replies.shift() ?? jsonReply(599, { error: 'unexpected send' });
      reply(response, request);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const policy = (extra: RecoveryOptions = {}): RecoveryOptions => ({
    maxAttempts: 3,
    baseDelayMs: 0,
    admit: async () => 'allow',
    onEvent: (event) => events.push(event),
    onWire: (wire) => {
      wires.push(wire);
    },
    ...extra,
  });
  const call = (
    operation: 'ordinary' | 'structured',
    recovery?: RecoveryOptions
  ): Promise<Result<unknown, Error>> => {
    const broker = new LlmBroker('gpt-4o', provider.gateway(url));
    const messages = [Message.system('instructions'), Message.user('payload-secret')];
    const config: CompletionConfig = {
      temperature: 0.3,
      maxTokens: 37,
      topP: 0.7,
      topK: 8,
      numCtx: 1024,
      numPredict: 17,
      stop: ['END'],
      recovery,
    };
    return operation === 'structured'
      ? broker.generateObject(
          messages,
          { type: 'object', properties: { answer: { type: 'number' } }, required: ['answer'] },
          config
        )
      : broker.generateResponse(messages, undefined, config);
  };
  const assertSends = (expected: number): void => {
    expect(sends.map((send) => send.path)).toEqual(Array(expected).fill(provider.path));
    expect(sends.map((send) => send.bytes)).toEqual(Array(expected).fill(sends[0].bytes));
    expect(sends.map((send) => send.authorization)).toEqual(
      Array(expected).fill(provider.name === 'ollama' ? undefined : 'Bearer credential-secret')
    );
    expect(
      wires.filter((wire) => wire.direction === 'request').map((wire) => Buffer.from(wire.bytes))
    ).toEqual(sends.map((send) => send.bytes));
  };
  const assertHistory = (error: RecoveryError, statuses: number[]): void => {
    expect(error.history.map((failure) => failure.httpStatus)).toEqual(statuses);
    expect(error.history.map((failure) => failure.wireAttempt)).toEqual(
      statuses.map((_, index) => index + 1)
    );
    expect(new Set(error.history.map((failure) => failure.attemptId)).size).toBe(statuses.length);
    expect(error.history.map((failure) => failure.logicalRequestId)).toEqual(
      Array(statuses.length).fill(error.failure.logicalRequestId)
    );
    expect(
      events.filter((event) => event.type === 'attempt_started').map((event) => event.attemptId)
    ).toEqual(error.history.map((failure) => failure.attemptId));
    expect(JSON.stringify(error)).not.toMatch(/credential-secret|payload-secret/);
    expect(JSON.stringify(events)).not.toMatch(/credential-secret|payload-secret/);
  };

  describe.each(['ordinary', 'structured'] as const)('%s', (operation) => {
    const content = operation === 'ordinary' ? 'answer' : '{"answer":42}';
    it('accounts for a terminal 421 without a hidden transport resend', async () => {
      replies = [
        jsonReply(421, { error: 'misdirected request' }),
        jsonReply(200, provider.success(content)),
      ];
      const result = await call(operation, policy({ maxAttempts: 1 }));

      assertSends(1);
      const error = failed(result);
      expect(error.failure).toMatchObject({
        category: 'http',
        httpStatus: 421,
        operation,
        classification: { eligible: false },
      });
      assertHistory(error, [421]);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'interrupted',
      ]);
      expect(wires.map((wire) => [wire.direction, wire.status, wire.complete])).toEqual([
        ['request', undefined, true],
        ['response', 421, true],
      ]);
      expect(Buffer.from(wires[1].bytes)).toEqual(Buffer.from('{"error":"misdirected request"}'));
      expect(
        wires.map((wire) => [wire.logicalRequestId, wire.attemptId, wire.wireAttempt])
      ).toEqual(Array(2).fill([error.failure.logicalRequestId, error.failure.attemptId, 1]));
    });
    it('recovers a 503 with exact bytes, supported controls, history, identities, and ordered lifecycle', async () => {
      replies = [
        jsonReply(503, { error: 'payload-secret credential-secret' }),
        jsonReply(200, provider.success(content)),
      ];
      const result = await call(operation, policy());

      expect(result).toMatchObject({ ok: true });
      assertSends(2);
      const body: unknown = JSON.parse(sends[0].bytes.toString());
      expect(body).toMatchObject({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'instructions' },
          { role: 'user', content: 'payload-secret' },
        ],
      });
      const expectedControls = {
        ollama: {
          options: {
            temperature: 0.3,
            num_predict: 17,
            top_p: 0.7,
            top_k: 8,
            num_ctx: 1024,
            stop: ['END'],
          },
          stream: false,
        },
        omlx: { temperature: 0.3, max_tokens: 37, top_p: 0.7, top_k: 8 },
        openai: { temperature: 0.3, max_tokens: 37 },
      };
      expect(body).toMatchObject(
        Object.entries(expectedControls).find(([key]) => key === provider.name)?.[1] ?? {}
      );
      const schemaFields =
        operation === 'ordinary'
          ? {}
          : provider.name === 'ollama'
            ? {
                format: {
                  type: 'object',
                  properties: { answer: { type: 'number' } },
                  required: ['answer'],
                },
              }
            : {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'response',
                    schema: {
                      type: 'object',
                      properties: { answer: { type: 'number' } },
                      required: ['answer'],
                    },
                  },
                },
              };
      expect(body).toMatchObject(schemaFields);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'admission_pending',
        'admission_allowed',
        'delay_scheduled',
        'retry_started',
        'attempt_started',
        'attempt_succeeded',
      ]);
      expect(
        wires.map((wire) => [
          wire.direction,
          wire.wireAttempt,
          wire.attemptId,
          wire.logicalRequestId,
        ])
      ).toEqual([
        ['request', 1, events[0].attemptId, events[0].logicalRequestId],
        ['response', 1, events[0].attemptId, events[0].logicalRequestId],
        ['request', 2, events[6].attemptId, events[0].logicalRequestId],
        ['response', 2, events[6].attemptId, events[0].logicalRequestId],
      ]);
      expect(events[6].attemptId).not.toBe(events[0].attemptId);
      expect(JSON.stringify(events)).not.toMatch(/payload-secret|credential-secret/);
    });
    it('exhausts persistent 504 with full inspectable history and exactly three actual sends', async () => {
      replies = Array(3).fill(jsonReply(504, { error: 'payload-secret credential-secret' }));
      const error = failed(await call(operation, policy()));

      expect(error.outcome).toBe('exhausted');
      assertSends(3);
      assertHistory(error, [504, 504, 504]);
      expect(error.failure).toBe(error.history[2]);
      expect(inspectRecoveryFailure(error.failure)?.bytes).toEqual(
        Buffer.from('{"error":"payload-secret credential-secret"}')
      );
      expect(events.map((event) => event.type)).toEqual([
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
    });
    it.each([
      ['seconds', '2', 2000, 3000, undefined, 'success'],
      ['date', 'Sat, 10 Oct 2026 00:00:02 GMT', 2000, 3000, undefined, 'success'],
      ['past', 'Fri, 09 Oct 2026 00:00:00 GMT', 100, 3000, undefined, 'success'],
      ['invalid', 'payload-secret', 100, 3000, undefined, 'success'],
      ['ceiling', '4', undefined, 3000, undefined, 'delay_ceiling'],
      ['budget', '2', undefined, 3000, 1000, 'deadline'],
    ] as const)(
      'handles Retry-After %s without shortening the minimum',
      async (_name, retryAfter, delay, delayCeilingMs, budgetMs, outcome) => {
        replies = [
          jsonReply(429, { error: 'rate limit' }, { 'Retry-After': retryAfter }),
          jsonReply(200, provider.success(content)),
        ];
        const sleeper = jest.fn(async () => {});
        const result = await call(
          operation,
          policy({
            baseDelayMs: 100,
            jitter: () => 1,
            delayCeilingMs,
            budgetMs,
            wallClock: () => Date.parse('2026-10-10T00:00:00Z'),
            sleep: sleeper,
          })
        );

        expect(result).toMatchObject(
          outcome === 'success' ? { ok: true } : { ok: false, error: { outcome } }
        );
        expect(sleeper.mock.calls).toEqual(
          delay === undefined ? [] : [[delay, expect.any(AbortSignal)]]
        );
        expect(sends.map((send) => send.bytes)).toEqual(
          Array(outcome === 'success' ? 2 : 1).fill(sends[0].bytes)
        );
        expect(
          events.filter((event) => event.type === 'delay_scheduled').map((event) => event.delayMs)
        ).toEqual(delay === undefined ? [] : [delay]);
      }
    );
    it.each(['allow', 'reject'] as const)(
      'keeps admission pending until explicit %s',
      async (decision) => {
        replies = [
          jsonReply(504, { error: 'ambiguous' }),
          jsonReply(200, provider.success(content)),
        ];
        const pending = deferred<void>();
        const admission = deferred<'allow' | 'reject'>();
        const request = call(
          operation,
          policy({
            admit: async (context) => {
              expect(context.nextAttempt).toBe(2);
              expect(context.failure.acceptance).toBe('unknown');
              pending.resolve();
              return admission.promise;
            },
          })
        );
        await pending.promise;

        expect(events.map((event) => event.type)).toEqual([
          'attempt_started',
          'attempt_failed',
          'admission_pending',
        ]);
        expect(sends.map((send) => send.path)).toEqual([provider.path]);
        admission.resolve(decision);
        const result = await request;
        expect(result.ok).toBe(decision === 'allow');
        expect(sends.map((send) => send.bytes)).toEqual(
          Array(decision === 'allow' ? 2 : 1).fill(sends[0].bytes)
        );
      }
    );
    it.each(['request', 'admission', 'backoff'] as const)(
      'cancels during %s and records the failed wire attempt before one terminal event',
      async (phase) => {
        const controller = new AbortController();
        const reached = deferred<void>();
        const holding: Reply = (response) => {
          response.writeHead(200);
          response.write(' ');
          reached.resolve();
        };
        replies = [phase === 'request' ? holding : jsonReply(503, { error: 'ambiguous' })];
        const request = call(
          operation,
          policy({
            signal: controller.signal,
            admit:
              phase === 'admission'
                ? async () => {
                    reached.resolve();
                    return new Promise<'allow'>(() => {});
                  }
                : async () => 'allow',
            sleep:
              phase === 'backoff'
                ? async () => {
                    reached.resolve();
                    return new Promise<void>(() => {});
                  }
                : async () => {},
          })
        );
        await reached.promise;
        controller.abort(new Error('credential-secret'));
        const error = failed(await request);

        expect(error.outcome).toBe('cancelled');
        expect(error.failure.category).toBe('cancellation');
        expect(error.history.map((failure) => failure.wireAttempt)).toEqual([1]);
        expect(events.slice(-1).map((event) => event.type)).toEqual(['cancelled']);
        expect(events.filter((event) => event.type === 'cancelled')).toHaveLength(1);
        expect(events.filter((event) => event.type === 'attempt_failed')).toHaveLength(1);
        expect(sends.map((send) => send.path)).toEqual([provider.path]);
        expect(JSON.stringify(error)).not.toContain('credential-secret');
      }
    );
    it.each([400, 401, 403])(
      'retains permanent truncated HTTP %s and original body transport cause',
      async (status) => {
        replies = [truncate(status, '{"error":"credential-secret')];
        const error = failed(await call(operation, policy({ retryableStatuses: [status] })));

        expect(error.failure).toMatchObject({
          category: 'http',
          httpStatus: status,
          classification: { eligible: false, reason: 'permanent' },
          progress: { headersReceived: true, rawBytes: 27 },
        });
        assertHistory(error, [status]);
        expect(Object.prototype.toString.call(inspectRecoveryFailure(error.failure)?.cause)).toBe(
          '[object Error]'
        );
        expect(Buffer.from(inspectRecoveryFailure(error.failure)?.bytes ?? []).toString()).toBe(
          '{"error":"credential-secret'
        );
        expect(wires.at(-1)).toMatchObject({ direction: 'response', complete: false, status });
        expect(sends.map((send) => send.path)).toEqual([provider.path]);
      }
    );
    it.each(['malformed', 'partial', 'shape'] as const)(
      'does not replay %s successful HTTP bodies',
      async (kind) => {
        replies = [
          kind === 'partial'
            ? truncate(200, provider.partial)
            : kind === 'malformed'
              ? (response) => {
                  response.end('not JSON');
                }
              : jsonReply(200, {}),
        ];
        const error = failed(
          await call(operation, policy({ retryableCategories: ['protocol', 'transport'] }))
        );

        expect(error.failure.classification.eligible).toBe(false);
        expect(error.failure.progress.headersReceived).toBe(true);
        expect(sends.map((send) => send.path)).toEqual([provider.path]);
        expect(inspectRecoveryFailure(error.failure)?.bytes.length).toBeGreaterThan(0);
        expect(Object.prototype.toString.call(inspectRecoveryFailure(error.failure)?.cause)).toBe(
          '[object Error]'
        );
      }
    );
    it('accounts for semantic progress before terminal capture failure and retains the exact exception', async () => {
      replies = [jsonReply(503, provider.success('payload-secret'))];
      const captureCause = new Error('credential-secret capture');
      const error = failed(
        await call(
          operation,
          policy({
            onWire: (wire) => {
              wires.push(wire);
              if (wire.direction === 'response') throw captureCause;
            },
          })
        )
      );

      expect(error.failure.classification.eligible).toBe(false);
      expect(error.failure.progress.observed.contentBytes).toBe(14);
      expect(error.failure.progress.delivered.contentBytes).toBe(0);
      expect(inspectRecoveryFailure(error.failure)?.cause).toBe(captureCause);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
      expect(JSON.stringify(error)).not.toMatch(/payload-secret|credential-secret/);
    });
    it.each(['content', 'reasoning', 'tools', 'escaped_content', 'quoted_control'] as const)(
      'recognizes partial %s evidence at the wire boundary',
      async (kind) => {
        const prefix = provider.name === 'ollama' ? '{"message":{' : '{"choices":[{"message":{';
        const fragments = {
          content: '"content":"payload-secret',
          reasoning:
            provider.name === 'ollama'
              ? '"thinking":"payload-secret'
              : '"reasoning_content":"payload-secret',
          tools: '"tool_calls":[{"id":"credential-secret',
          escaped_content: '"con\\u0074ent":"payload-secret',
          quoted_control: '"content":"quoted \\"tool_calls\\": [ { marker',
        };
        const fragment = Object.entries(fragments).find(([key]) => key === kind)?.[1] ?? '';
        const body = prefix + fragment;
        replies = [truncate(503, body)];
        const error = failed(await call(operation, policy()));

        expect(error.failure.classification).toEqual({
          eligible: false,
          reason: 'semantic_output',
        });
        expect(error.failure.progress.observed).toMatchObject(
          kind === 'tools'
            ? { toolFragments: 1, contentBytes: 0 }
            : kind === 'reasoning'
              ? { reasoningBytes: 14 }
              : { contentBytes: expect.any(Number), toolFragments: 0 }
        );
        expect(Buffer.from(inspectRecoveryFailure(error.failure)?.bytes ?? []).toString()).toBe(
          body
        );
        expect(sends.map((send) => send.path)).toEqual([provider.path]);
        expect(wires.at(-1)).toMatchObject({ direction: 'response', complete: false, status: 503 });
      }
    );
    it('gives cancellation in a synchronous success observer precedence over the returned result', async () => {
      replies = [jsonReply(200, provider.success(content))];
      const controller = new AbortController();
      const error = failed(
        await call(
          operation,
          policy({
            signal: controller.signal,
            onEvent: (event) => {
              events.push(event);
              if (event.type === 'attempt_succeeded') controller.abort('credential-secret');
            },
          })
        )
      );

      expect(error.outcome).toBe('cancelled');
      expect(error.failure.progress.delivered).toEqual({
        contentBytes: 0,
        reasoningBytes: 0,
        toolFragments: 0,
        completedToolCalls: 0,
      });
      expect(error.history.map((failure) => failure.wireAttempt)).toEqual([1]);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_succeeded',
        'attempt_failed',
        'cancelled',
      ]);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
    });
    it('cancellation from successful body capture wins and records the actual attempt first', async () => {
      replies = [jsonReply(200, provider.success(content))];
      const controller = new AbortController();
      const error = failed(
        await call(
          operation,
          policy({
            signal: controller.signal,
            onWire: (wire) => {
              wires.push(wire);
              if (wire.direction === 'response') controller.abort('credential-secret');
            },
          })
        )
      );

      expect(error.outcome).toBe('cancelled');
      expect(error.history.map((failure) => [failure.httpStatus, failure.wireAttempt])).toEqual([
        [200, 1],
      ]);
      expect(error.failure.classification.reason).toBe('cancelled');
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'cancelled',
      ]);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
    });
    it('makes request capture failure terminal without sending HTTP', async () => {
      const cause = new Error('credential-secret');
      const error = failed(
        await call(
          operation,
          policy({
            onWire: () => {
              throw cause;
            },
          })
        )
      );

      expect(error.failure).toMatchObject({
        wireAttempt: 0,
        classification: { eligible: false, reason: 'capture_failed' },
      });
      expect(error.history).toEqual([]);
      expect(inspectRecoveryFailure(error.failure)?.cause).toBe(cause);
      expect(sends).toEqual([]);
      expect(events.map((event) => event.type)).toEqual(['interrupted']);
    });
    it('does not apply recovery budgets or deadlines to active generation', async () => {
      replies = [
        (response, request) => {
          setTimeout(() => jsonReply(200, provider.success(content))(response, request), 15);
        },
      ];
      const result = await call(operation, policy({ budgetMs: 1, deadlineMs: Date.now() - 1000 }));

      expect(result.ok).toBe(true);
      expect(events.map((event) => event.type)).toEqual(['attempt_started', 'attempt_succeeded']);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
    });
    it('cancels an unresolved admission at the recovery budget and aborts its signal', async () => {
      replies = [jsonReply(503, { error: 'ambiguous' })];
      let admissionSignal: AbortSignal | undefined;
      const error = failed(
        await call(
          operation,
          policy({
            budgetMs: 20,
            admit: async (context) => {
              admissionSignal = context.signal;
              return new Promise<'allow'>(() => {});
            },
          })
        )
      );

      expect(error.outcome).toBe('deadline');
      expect(admissionSignal?.aborted).toBe(true);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'admission_pending',
        'exhausted',
      ]);
    });
    it('rechecks the recovery budget immediately before sending after admission and delay', async () => {
      replies = [jsonReply(503, { error: 'ambiguous' })];
      let elapsed = 0;
      const error = failed(
        await call(
          operation,
          policy({
            budgetMs: 100,
            monotonicClock: () => elapsed,
            sleep: async () => {
              elapsed = 100;
            },
          })
        )
      );

      expect(error.outcome).toBe('deadline');
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'admission_pending',
        'admission_allowed',
        'delay_scheduled',
        'exhausted',
      ]);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
    });
    it('uses bounded exponential full jitter for every retry', async () => {
      replies = [
        jsonReply(503, { error: 'transient' }),
        jsonReply(503, { error: 'transient' }),
        jsonReply(503, { error: 'transient' }),
        jsonReply(200, provider.success(content)),
      ];
      const fractions = [0, 0.5, 1];
      const delays: number[] = [];
      const result = await call(
        operation,
        policy({
          maxAttempts: 4,
          baseDelayMs: 100,
          delayCeilingMs: 250,
          jitter: () => fractions.shift() ?? 1,
          sleep: async (delay) => {
            delays.push(delay);
          },
        })
      );

      expect(result.ok).toBe(true);
      expect(delays).toEqual([0, 100, 250]);
      expect(
        events.filter((event) => event.type === 'delay_scheduled').map((event) => event.delayMs)
      ).toEqual(delays);
      assertSends(4);
    });
    it('keeps raw keepalive progress separate from observed and delivered semantics', async () => {
      replies = [truncate(503, ' \n '), jsonReply(200, provider.success(content))];
      const result = await call(operation, policy());

      expect(result.ok).toBe(true);
      expect(events[1].failure).toMatchObject({
        progress: {
          rawBytes: 3,
          observed: { contentBytes: 0, reasoningBytes: 0, toolFragments: 0, completedToolCalls: 0 },
          delivered: {
            contentBytes: 0,
            reasoningBytes: 0,
            toolFragments: 0,
            completedToolCalls: 0,
          },
        },
        classification: { eligible: true, reason: 'transient' },
      });
      assertSends(2);
    });
    it('preserves both body transport and capture causes on a partial failure', async () => {
      replies = [truncate(503, provider.partial)];
      const captureCause = new Error('credential-secret capture');
      const error = failed(
        await call(
          operation,
          policy({
            onWire: (wire) => {
              wires.push(wire);
              if (wire.direction === 'response') throw captureCause;
            },
          })
        )
      );

      expect(Object.prototype.toString.call(inspectRecoveryFailure(error.failure)?.cause)).toBe(
        '[object Error]'
      );
      expect(inspectRecoveryFailure(error.failure)?.cause).not.toBe(captureCause);
      expect(inspectRecoveryFailure(error.failure)?.captureCause).toBe(captureCause);
      expect(error.failure.progress.observed.contentBytes).toBe(14);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
    });
    it.each([301, 302, 303, 307, 308])(
      'rejects HTTP %s redirects before reaching a second endpoint',
      async (status) => {
        const redirected: Buffer[] = [];
        const destination = createServer(async (request, response) => {
          const chunks: Buffer[] = [];
          for await (const chunk of request) chunks.push(Buffer.from(chunk));
          redirected.push(Buffer.concat(chunks));
          jsonReply(200, provider.success(content))(response, request);
        });
        await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
        try {
          const port = (destination.address() as AddressInfo).port;
          replies = [jsonReply(status, {}, { Location: `http://127.0.0.1:${port}/redirected` })];
          const error = failed(await call(operation, policy({ maxAttempts: 1 })));

          expect(redirected).toEqual([]);
          assertSends(1);
          assertHistory(error, [status]);
          expect(error.failure.classification.eligible).toBe(false);
          expect(events.map((event) => event.type)).toEqual([
            'attempt_started',
            'attempt_failed',
            'interrupted',
          ]);
          expect(wires.map((wire) => [wire.direction, wire.status])).toEqual([
            ['request', undefined],
            ['response', status],
          ]);
          expect(wires.map((wire) => wire.attemptId)).toEqual(
            Array(2).fill(error.failure.attemptId)
          );
          expect(Buffer.from(wires[1].bytes)).toEqual(Buffer.from('{}'));
        } finally {
          destination.closeAllConnections();
          await new Promise<void>((resolve) => destination.close(() => resolve()));
        }
      }
    );
    it.each([204, 205, 304])(
      'records bodyless HTTP %s without throwing in the transport',
      async (status) => {
        replies = [
          (response) => {
            response.writeHead(status);
            response.end();
          },
        ];
        const error = failed(await call(operation, policy({ maxAttempts: 1 })));

        assertSends(1);
        assertHistory(error, [status]);
        expect(wires[1]).toMatchObject({ direction: 'response', status, complete: true });
        expect(Buffer.from(wires[1].bytes)).toEqual(Buffer.alloc(0));
      }
    );
    it('keeps recognized metadata private when echoed from credentials or payload', async () => {
      const uuid = '12345678-1234-1234-1234-123456789abc';
      replies = [jsonReply(503, { error: { code: 'server_error' } }, { 'x-request-id': uuid })];
      const gateway =
        provider.name === 'ollama'
          ? new OllamaGateway(url)
          : provider.name === 'omlx'
            ? new OMLXGateway(url, `${uuid} server_error`)
            : new OpenAIGateway(`${uuid} server_error`, url);
      const error = failed(
        await new LlmBroker('gpt-4o', gateway).generateResponse(
          [Message.user(`${uuid} server_error`)],
          undefined,
          { recovery: policy({ maxAttempts: 1 }) }
        )
      );

      expect(error.failure.providerCode).toBeUndefined();
      expect(error.failure.providerRequestId).toBeUndefined();
      expect(JSON.stringify(events)).not.toMatch(/server_error|12345678/);
      expect(inspectRecoveryFailure(error.failure)?.headers?.get('x-request-id')).toBe(uuid);
    });
    it('retains transport causes and accounts for failed sends without hidden retries', async () => {
      replies = [
        (_response, request) => {
          request.socket.destroy();
        },
        jsonReply(200, provider.success(content)),
      ];
      const result = await call(operation, policy());

      expect(result.ok).toBe(true);
      expect(events[1].failure).toMatchObject({
        category: 'transport',
        acceptance: 'unknown',
        progress: { headersReceived: false, rawBytes: 0 },
        classification: { eligible: true, reason: 'transient' },
      });
      assert(events[1].failure);
      expect(Object.prototype.toString.call(inspectRecoveryFailure(events[1].failure)?.cause)).toBe(
        '[object Error]'
      );
      expect(wires.map((wire) => [wire.direction, wire.complete, wire.status])).toEqual([
        ['request', true, undefined],
        ['response', false, undefined],
        ['request', true, undefined],
        ['response', true, 200],
      ]);
      assertSends(2);
    });
    it('retains an admission exception without calling it deadline exhaustion', async () => {
      replies = [jsonReply(503, { error: 'ambiguous' })];
      const cause = new Error('credential-secret admission');
      const error = failed(
        await call(
          operation,
          policy({
            admit: async () => {
              throw cause;
            },
          })
        )
      );

      expect(error.outcome).toBe('admission_rejected');
      expect(inspectRecoveryFailure(error.failure)?.admissionCause).toBe(cause);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'admission_pending',
        'admission_rejected',
      ]);
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
      expect(JSON.stringify(error)).not.toContain('credential-secret');
    });
    it('keeps the opt-in default to one wire attempt', async () => {
      replies = [jsonReply(503, { error: 'transient' })];
      const error = failed(await call(operation, policy({ maxAttempts: undefined })));

      expect(error.outcome).toBe('exhausted');
      assertHistory(error, [503]);
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'exhausted',
      ]);
      assertSends(1);
    });
    it('cancels before sending without inventing a failed wire attempt', async () => {
      const controller = new AbortController();
      controller.abort('credential-secret');
      const error = failed(await call(operation, policy({ signal: controller.signal })));

      expect(error.outcome).toBe('cancelled');
      expect(error.history).toEqual([]);
      expect(error.failure.wireAttempt).toBe(0);
      expect(events.map((event) => event.type)).toEqual(['cancelled']);
      expect(sends).toEqual([]);
      expect(wires).toEqual([]);
    });
    it('honors category selection independently from HTTP status selection', async () => {
      replies = [jsonReply(503, { error: 'transient' })];
      const error = failed(
        await call(
          operation,
          policy({ retryableCategories: ['transport'], retryableStatuses: [503] })
        )
      );

      expect(error.failure.classification).toEqual({ eligible: false, reason: 'permanent' });
      expect(events.map((event) => event.type)).toEqual([
        'attempt_started',
        'attempt_failed',
        'interrupted',
      ]);
      assertSends(1);
    });
    it('preserves image and completed tool history plus descriptors with an immutable encoded schema', async () => {
      replies = [jsonReply(503, { error: 'transient' }), jsonReply(200, provider.success(content))];
      const image = {
        type: 'image_url' as const,
        image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
      };
      const messages = [
        Message.system('rules'),
        {
          ...Message.user(''),
          content: [{ type: 'text' as const, text: 'payload-secret' }, image],
        },
        Message.assistant('', [
          {
            id: 'call-prior',
            type: 'function',
            function: { name: 'counter', arguments: '{"value":1}' },
          },
        ]),
        Message.tool('{"counted":1}', 'call-prior', 'counter'),
      ];
      const descriptor = {
        type: 'function' as const,
        function: {
          name: 'counter',
          description: 'counter description',
          parameters: {
            type: 'object',
            properties: { value: { type: 'number' } },
            required: ['value'],
          },
        },
      };
      const schema = { type: 'object', properties: { answer: { type: 'number' } } };
      const recovery = policy({
        admit: async () => {
          schema.properties.answer.type = 'string';
          messages[0].content = 'mutated';
          descriptor.function.description = 'mutated';
          return 'allow';
        },
      });
      const result = await provider.gateway(url).generate(
        'gpt-4o',
        messages,
        {
          recovery,
          responseFormat: operation === 'structured' ? { type: 'json_object', schema } : undefined,
        },
        [descriptor]
      );

      expect(result.ok).toBe(true);
      assertSends(2);
      const request: unknown = JSON.parse(sends[0].bytes.toString());
      expect(request).toMatchObject({
        tools: [
          {
            type: 'function',
            function: {
              name: 'counter',
              description: 'counter description',
              parameters: {
                type: 'object',
                properties: { value: { type: 'number' } },
                required: ['value'],
              },
            },
          },
        ],
        messages: [
          { role: 'system', content: 'rules' },
          provider.name === 'ollama'
            ? { role: 'user', content: 'payload-secret', images: ['aW1hZ2U='] }
            : { role: 'user', content: [{ type: 'text', text: 'payload-secret' }, image] },
          {
            role: 'assistant',
            content: '',
            tool_calls: [
              {
                id: 'call-prior',
                function: {
                  name: 'counter',
                  arguments: provider.name === 'ollama' ? { value: 1 } : '{"value":1}',
                },
              },
            ],
          },
          provider.name === 'ollama'
            ? { role: 'tool', content: '{"counted":1}' }
            : { role: 'tool', content: '{"counted":1}', tool_call_id: 'call-prior' },
        ],
      });
      expect(JSON.stringify(request)).not.toContain('mutated');
      expect(wires.map((wire) => wire.wireAttempt)).toEqual([1, 1, 2, 2]);
    });
    it('keeps disabled recovery to one legacy attempt', async () => {
      replies = [jsonReply(503, { error: 'legacy body' })];
      const result = await call(operation);

      expect(result).toMatchObject({ ok: false, error: { statusCode: 503 } });
      expect(sends.map((send) => send.path)).toEqual([provider.path]);
      expect(events).toEqual([]);
    });
    it('omits echoed credential/payload metadata and exposes original headers only on inspection', async () => {
      const uuid = '12345678-1234-1234-1234-123456789abc';
      replies = [
        jsonReply(
          503,
          { error: { code: 'server_error', message: 'credential-secret' } },
          { 'x-request-id': uuid, 'x-secret': 'credential-secret' }
        ),
      ];
      const broker = new LlmBroker('gpt-4o', provider.gateway(url));
      const result = await broker.generateResponse(
        [Message.user(`server_error ${uuid}`)],
        undefined,
        { recovery: policy({ maxAttempts: 1 }) }
      );
      const error = failed(result);

      expect(error.failure.providerCode).toBeUndefined();
      expect(error.failure.providerRequestId).toBeUndefined();
      expect(inspectRecoveryFailure(error.failure)?.headers?.get('x-request-id')).toBe(uuid);
      expect(inspectRecoveryFailure(error.failure)?.headers?.get('x-secret')).toBe(
        'credential-secret'
      );
      expect(JSON.stringify(error)).not.toMatch(/credential-secret|server_error|12345678/);
    });
  });

  it('requires ambiguous local admission while OpenAI may use policy admission', async () => {
    replies = [jsonReply(504, { error: 'ambiguous' }), jsonReply(200, provider.success('answer'))];
    const result = await call('ordinary', policy({ admit: undefined }));

    expect(result.ok).toBe(provider.name === 'openai');
    expect(events.map((event) => event.type)).toEqual(
      provider.name === 'openai'
        ? [
            'attempt_started',
            'attempt_failed',
            'delay_scheduled',
            'retry_started',
            'attempt_started',
            'attempt_succeeded',
          ]
        : ['attempt_started', 'attempt_failed', 'admission_required']
    );
  });
  it.each(['broker', 'session'] as const)(
    'preserves completed tools exactly once when the final %s completion exhausts',
    async (entrypoint) => {
      replies = [
        jsonReply(200, provider.tool),
        jsonReply(504, { error: 'failed completion' }),
        jsonReply(504, { error: 'failed completion' }),
      ];
      const run = jest.fn(async () => Ok({ counted: 1 }));
      const tool: LlmTool = {
        run,
        descriptor: () => ({
          type: 'function',
          function: {
            name: 'counter',
            description: 'increment once',
            parameters: { type: 'object', properties: {} },
          },
        }),
        name: () => 'counter',
        matches: (name) => name === 'counter',
      };
      const messages = [Message.user('count once')];
      const broker = new LlmBroker('gpt-4o', provider.gateway(url));
      const session = new ChatSession(broker, {
        tools: [tool],
        tokenizerGateway: { encode: () => [], decode: () => '', free: () => {} },
      });
      const recovery = policy({ maxAttempts: 2 });
      const result =
        entrypoint === 'broker'
          ? await broker.generate(messages, [tool], { recovery })
          : await session.send('count once', recovery).then(
              (value) => Ok(value),
              (error: Error) => Err(error)
            );
      const error = failed(result);

      expect(error.outcome).toBe('exhausted');
      expect(run.mock.calls).toEqual([[{}, expect.any(Object)]]);
      const history = entrypoint === 'broker' ? messages : session.getMessages();
      expect(history.slice(-2)).toMatchObject([
        { role: 'assistant', tool_calls: [{ id: 'call-one' }] },
        { role: 'tool', tool_call_id: 'call-one', content: '{"counted":1}' },
      ]);
      expect(sends.slice(1).map((send) => send.bytes)).toEqual([sends[1].bytes, sends[1].bytes]);
      const second: unknown = JSON.parse(sends[1].bytes.toString());
      expect(second).toMatchObject({
        tools: [tool.descriptor()],
        messages: expect.arrayContaining([
          provider.name === 'ollama'
            ? { role: 'tool', content: '{"counted":1}' }
            : { role: 'tool', content: '{"counted":1}', tool_call_id: 'call-one' },
        ]),
      });
      expect(error.history.map((failure) => failure.httpStatus)).toEqual([504, 504]);
      expect(error.history.map((failure) => failure.logicalRequestId)).toEqual([
        error.failure.logicalRequestId,
        error.failure.logicalRequestId,
      ]);
      expect(
        events.filter((event) => event.type === 'attempt_started').map((event) => event.wireAttempt)
      ).toEqual([1, 1, 2]);
      expect(events[0].logicalRequestId).not.toBe(error.failure.logicalRequestId);
      session.dispose();
    }
  );
});
