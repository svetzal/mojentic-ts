/**
 * Tests for OpenAIRealtimeGateway against a scripted transport.
 */

import { Err, Ok, Result, isOk } from '../error';
import { OpenAIRealtimeGateway } from './openai-gateway';
import { RealtimeTransport, TransportListener } from './transport';

class FakeTransport implements RealtimeTransport {
  sent: unknown[] = [];
  listener?: TransportListener;
  closed = false;

  async connect(listener: TransportListener): Promise<Result<void, Error>> {
    this.listener = listener;
    listener.onOpen();
    return Ok(undefined);
  }

  async send(payload: unknown): Promise<Result<void, Error>> {
    if (this.closed) return Err(new Error('closed'));
    this.sent.push(payload);
    return Ok(undefined);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.listener?.onClose('client');
  }

  isClosed(): boolean {
    return this.closed;
  }

  emit(raw: unknown): void {
    this.listener?.onMessage(JSON.stringify(raw));
  }

  emitRawString(str: string): void {
    this.listener?.onMessage(str);
  }

  triggerClose(reason: 'server' | 'error' = 'server'): void {
    this.closed = true;
    this.listener?.onClose(reason);
  }
}

class FailingTransport implements RealtimeTransport {
  async connect(): Promise<Result<void, Error>> {
    return Err(new Error('connect failed'));
  }
  async send(): Promise<Result<void, Error>> {
    return Err(new Error('not open'));
  }
  async close(): Promise<void> {
    /* no-op */
  }
  isClosed(): boolean {
    return true;
  }
}

describe('OpenAIRealtimeGateway', () => {
  test('throws when constructed without an apiKey and no env var', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      expect(() => new OpenAIRealtimeGateway()).toThrow(/apiKey/);
    } finally {
      if (original !== undefined) process.env.OPENAI_API_KEY = original;
    }
  });

  test('opens a session and surfaces parsed server events', async () => {
    const transport = new FakeTransport();
    let capturedProtocols: string[] | undefined;
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: (_u, _h, p) => {
        capturedProtocols = p;
        return transport;
      },
    });

    const sessionResult = await gateway.open('gpt-realtime', {});
    expect(isOk(sessionResult)).toBe(true);
    if (!isOk(sessionResult)) return;
    const session = sessionResult.value;

    const iter = session.events();

    transport.emit({
      type: 'session.created',
      session: { id: 'sess_xyz' },
    });
    transport.emit({
      type: 'response.audio.delta',
      response_id: 'resp_1',
      delta: 'YmFzZTY0',
    });

    const first = await iter.next();
    const second = await iter.next();

    expect(first.value?.type).toBe('session.created');
    expect(second.value?.type).toBe('response.audio.delta');
    expect(capturedProtocols).toEqual(['realtime', 'openai-insecure-api-key.test']);

    await session.close();
  });

  test('forwards client events through the transport', async () => {
    const transport = new FakeTransport();
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: () => transport,
    });

    const sessionResult = await gateway.open('gpt-realtime', {});
    if (!isOk(sessionResult)) throw new Error('open failed');
    const session = sessionResult.value;

    await session.sendEvent({ type: 'response.create' });

    expect(transport.sent).toEqual([{ type: 'response.create' }]);
  });

  test('surfaces malformed JSON as an error event', async () => {
    const transport = new FakeTransport();
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: () => transport,
    });

    const sessionResult = await gateway.open('gpt-realtime', {});
    if (!isOk(sessionResult)) throw new Error('open failed');
    const session = sessionResult.value;

    const iter = session.events();
    transport.emitRawString('{ this is not json');

    const next = await iter.next();
    expect(next.value?.type).toBe('error');
  });

  test('iterator terminates when the server closes the channel', async () => {
    const transport = new FakeTransport();
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: () => transport,
    });

    const sessionResult = await gateway.open('gpt-realtime', {});
    if (!isOk(sessionResult)) throw new Error('open failed');
    const session = sessionResult.value;

    const iter = session.events();
    transport.triggerClose('server');

    const next = await iter.next();
    expect(next.done).toBe(true);
  });

  test('propagates connect failures', async () => {
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: () => new FailingTransport(),
    });
    const result = await gateway.open('gpt-realtime', {});
    expect(isOk(result)).toBe(false);
  });

  test('returns raw payload for unknown server event types', async () => {
    const transport = new FakeTransport();
    const gateway = new OpenAIRealtimeGateway({
      apiKey: 'test',
      transportFactory: () => transport,
    });

    const sessionResult = await gateway.open('gpt-realtime', {});
    if (!isOk(sessionResult)) throw new Error('open failed');
    const session = sessionResult.value;

    const iter = session.events();
    transport.emit({ type: 'response.brand_new_event', custom: 1 });

    const next = await iter.next();
    expect(next.value?.type).toBe('response.brand_new_event');
    expect((next.value as { custom?: number }).custom).toBe(1);
  });
});
