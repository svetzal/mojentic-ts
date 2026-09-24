/**
 * Contract tests for OpenAIGateway.generateStreamEvents over a fake SSE transport.
 */

import { OpenAIGateway } from './openai';
import { LlmStreamEvent, StreamEventError } from '../stream-events';
import { Message } from '../models';

const mockFetch = jest.fn();
global.fetch = mockFetch;

interface FakeTransport {
  wasCancelled: () => boolean;
}

/** Serve SSE frames from a body that stays open unless `close` is set. */
function serveFrames(
  frames: string[],
  options: { close: boolean } = { close: true }
): FakeTransport {
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
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

function frame(delta: Record<string, unknown>, finishReason: string | null = null): string {
  return JSON.stringify({
    id: 'c1',
    model: 'gpt-4o-2024-08-06',
    system_fingerprint: 'fp_7',
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
}

const usageFrame = JSON.stringify({
  id: 'c1',
  model: 'gpt-4o-2024-08-06',
  choices: [],
  usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 },
});

const reportedUsage = { promptTokens: 9, completionTokens: 2, totalTokens: 11 };

async function collect(iterable: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

function lastEvent(events: LlmStreamEvent[]): LlmStreamEvent {
  return events[events.length - 1];
}

function errorWith(fields: Partial<StreamEventError>): unknown {
  return { type: 'error', error: expect.objectContaining(fields) };
}

function sentInit(): RequestInit {
  return mockFetch.mock.calls[0][1] as RequestInit;
}

describe('OpenAIGateway.generateStreamEvents', () => {
  let gateway: OpenAIGateway;

  beforeEach(() => {
    mockFetch.mockReset();
    gateway = new OpenAIGateway('test-key', 'https://api.example.test/v1');
  });

  function events(): AsyncGenerator<LlmStreamEvent> {
    return gateway.generateStreamEvents('gpt-4o', [Message.user('Hi')]);
  }

  it('should yield content then completed when stop is followed by the done marker', async () => {
    serveFrames([
      frame({ role: 'assistant', content: 'Hel' }),
      frame({ content: 'lo' }),
      frame({}, 'stop'),
      usageFrame,
      '[DONE]',
    ]);

    const result = await collect(events());

    expect(result).toEqual([
      { type: 'content', text: 'Hel' },
      { type: 'content', text: 'lo' },
      {
        type: 'completed',
        metadata: {
          finishReason: 'stop',
          usage: reportedUsage,
          providerModel: 'gpt-4o-2024-08-06',
          metadata: { id: 'c1', system_fingerprint: 'fp_7' },
        },
      },
    ]);
  });

  it('should send one streaming request that asks for usage and carries no tools', async () => {
    serveFrames([frame({}, 'stop'), '[DONE]']);

    await collect(events());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(sentInit().body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(body).not.toHaveProperty('tools');
  });

  it('should report an incomplete completion with its evidence when the finish reason is length', async () => {
    serveFrames([frame({ content: '{"partial":' }), frame({}, 'length'), usageFrame, '[DONE]']);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'incomplete_completion',
        evidence: {
          finishReason: 'length',
          usage: reportedUsage,
          providerModel: 'gpt-4o-2024-08-06',
          metadata: { id: 'c1', system_fingerprint: 'fp_7' },
        },
      })
    );
  });

  it('should report an incomplete stream when the body ends without the done marker', async () => {
    serveFrames([frame({ content: 'Hi' }), frame({}, 'stop')]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'incomplete_stream' }));
  });

  it('should keep the evidence that arrived before an incomplete stream ended', async () => {
    serveFrames([frame({ content: 'Hi' }), frame({}, 'stop'), usageFrame]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'incomplete_stream',
        evidence: {
          finishReason: 'stop',
          usage: reportedUsage,
          providerModel: 'gpt-4o-2024-08-06',
          metadata: { id: 'c1', system_fingerprint: 'fp_7' },
        },
      })
    );
  });

  it('should report null evidence when the stream ended before any frame', async () => {
    serveFrames([]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'incomplete_stream',
        evidence: { finishReason: null, usage: null, providerModel: null, metadata: null },
      })
    );
  });

  it('should report unexpected tool calls when a tool-call delta arrives', async () => {
    serveFrames([
      frame({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'x', arguments: '' } }] }),
      frame({}, 'tool_calls'),
      '[DONE]',
    ]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'unexpected_tool_calls' }));
  });

  it('should report a provider error frame as a provider error', async () => {
    serveFrames([JSON.stringify({ error: { message: 'overloaded', type: 'server_error' } })]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'provider_error',
        detail: { message: 'overloaded', type: 'server_error' },
      })
    );
  });

  it('should report a non-success HTTP status as a provider error', async () => {
    mockFetch.mockResolvedValueOnce(new Response('rate limited', { status: 429 }));

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({ reason: 'provider_error', detail: expect.objectContaining({ status: 429 }) })
    );
  });

  it('should report a malformed frame as an invalid stream event', async () => {
    serveFrames(['{not json']);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'invalid_stream_event' }));
  });

  it('should report a network failure as a failed request', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'request_failed' }));
  });

  it('should end with exactly one terminal event', async () => {
    serveFrames([frame({}, 'stop'), '[DONE]', frame({ content: 'after the end' })]);

    const result = await collect(events());

    expect(result.map((event) => event.type)).toEqual(['completed']);
  });

  it('should cancel the request when the consumer stops early', async () => {
    const transport = serveFrames([frame({ content: 'Hi' })], { close: false });

    for await (const event of events()) {
      expect(event.type).toBe('content');
      break;
    }

    expect(sentInit().signal?.aborted).toBe(true);
    expect(transport.wasCancelled()).toBe(true);
  });

  it('should end with a cancelled error when the caller aborts the signal', async () => {
    serveFrames([frame({ content: 'Hi' })], { close: false });
    const controller = new AbortController();
    const received: LlmStreamEvent[] = [];

    for await (const event of gateway.generateStreamEvents(
      'gpt-4o',
      [Message.user('Hi')],
      undefined,
      controller.signal
    )) {
      received.push(event);
      controller.abort();
    }

    expect(received.map((event) => event.type)).toEqual(['content', 'error']);
    expect(lastEvent(received)).toEqual(errorWith({ reason: 'cancelled' }));
  });

  it('should not send a request when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await collect(
      gateway.generateStreamEvents('gpt-4o', [Message.user('Hi')], undefined, controller.signal)
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(lastEvent(result)).toEqual(errorWith({ reason: 'cancelled' }));
  });
});
