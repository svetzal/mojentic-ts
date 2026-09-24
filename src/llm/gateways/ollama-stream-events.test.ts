/**
 * Contract tests for OllamaGateway.generateStreamEvents over a fake NDJSON transport.
 */

import { OllamaGateway } from './ollama';
import { LlmStreamEvent, StreamEventError } from '../stream-events';
import { Message } from '../models';

const mockFetch = jest.fn();
global.fetch = mockFetch;

interface FakeTransport {
  wasCancelled: () => boolean;
}

/** Serve NDJSON lines from a body that stays open unless `close` is set. */
function serveLines(lines: string[], options: { close: boolean } = { close: true }): FakeTransport {
  let cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
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

function contentLine(content: string): string {
  return JSON.stringify({
    model: 'llama3:8b',
    message: { role: 'assistant', content },
    done: false,
  });
}

function finalLine(doneReason?: string): string {
  return JSON.stringify({
    model: 'llama3:8b',
    message: { role: 'assistant', content: '' },
    done: true,
    ...(doneReason !== undefined && { done_reason: doneReason }),
    total_duration: 900,
    load_duration: 100,
    prompt_eval_count: 9,
    prompt_eval_duration: 200,
    eval_count: 2,
    eval_duration: 600,
  });
}

const durations = {
  total_duration: 900,
  load_duration: 100,
  prompt_eval_duration: 200,
  eval_duration: 600,
};

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

describe('OllamaGateway.generateStreamEvents', () => {
  let gateway: OllamaGateway;

  beforeEach(() => {
    mockFetch.mockReset();
    gateway = new OllamaGateway('http://ollama.test:11434');
  });

  function events(): AsyncGenerator<LlmStreamEvent> {
    return gateway.generateStreamEvents('llama3', [Message.user('Hi')]);
  }

  it('should yield content then completed when the final frame reports stop', async () => {
    serveLines([contentLine('Hel'), contentLine('lo'), finalLine('stop')]);

    const result = await collect(events());

    expect(result).toEqual([
      { type: 'content', text: 'Hel' },
      { type: 'content', text: 'lo' },
      {
        type: 'completed',
        metadata: {
          finishReason: 'stop',
          usage: reportedUsage,
          providerModel: 'llama3:8b',
          metadata: { done_reason: 'stop', ...durations },
        },
      },
    ]);
  });

  it('should send one streaming request that carries no tools', async () => {
    serveLines([finalLine('stop')]);

    await collect(events());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(sentInit().body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ stream: true });
    expect(body).not.toHaveProperty('tools');
  });

  it('should report an incomplete completion with its evidence when the done reason is length', async () => {
    serveLines([contentLine('{"partial":'), finalLine('length')]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'incomplete_completion',
        evidence: {
          finishReason: 'length',
          usage: reportedUsage,
          providerModel: 'llama3:8b',
          metadata: { done_reason: 'length', ...durations },
        },
      })
    );
  });

  it('should report an incomplete completion when the final frame has no done reason', async () => {
    serveLines([finalLine()]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'incomplete_completion' }));
  });

  it('should report an incomplete stream when the body ends without a final frame', async () => {
    serveLines([contentLine('Hi')]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'incomplete_stream',
        evidence: { finishReason: null, usage: null, providerModel: 'llama3:8b', metadata: null },
      })
    );
  });

  it('should report unexpected tool calls when a frame carries tool calls', async () => {
    serveLines([
      JSON.stringify({
        model: 'llama3:8b',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'x', arguments: {} } }],
        },
        done: false,
      }),
      finalLine('stop'),
    ]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'unexpected_tool_calls' }));
  });

  it('should report a non-success HTTP status as a provider error carrying the status', async () => {
    mockFetch.mockResolvedValueOnce(new Response('model not found', { status: 404 }));

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({
        reason: 'provider_error',
        detail: { status: 404, body: 'model not found' },
      })
    );
  });

  it('should report a network failure as a failed request', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'request_failed' }));
  });

  it('should report a provider error frame as a provider error', async () => {
    serveLines([JSON.stringify({ error: 'model not found' })]);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(
      errorWith({ reason: 'provider_error', detail: 'model not found' })
    );
  });

  it('should report a malformed frame as an invalid stream event', async () => {
    serveLines(['{"done": "sometimes"}']);

    const result = await collect(events());

    expect(lastEvent(result)).toEqual(errorWith({ reason: 'invalid_stream_event' }));
  });

  it('should cancel the request when the consumer stops early', async () => {
    const transport = serveLines([contentLine('Hi')], { close: false });

    for await (const event of events()) {
      expect(event.type).toBe('content');
      break;
    }

    expect(sentInit().signal?.aborted).toBe(true);
    expect(transport.wasCancelled()).toBe(true);
  });

  it('should forward the configured response format', async () => {
    serveLines([finalLine('stop')]);

    await collect(
      gateway.generateStreamEvents('llama3', [Message.user('Hi')], {
        responseFormat: { type: 'json_object' },
      })
    );

    const body = JSON.parse(sentInit().body as string) as Record<string, unknown>;
    expect(body.format).toBe('json');
  });
});
