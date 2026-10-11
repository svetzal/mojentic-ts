import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { OllamaGateway } from './gateways/ollama';
import { Message } from './models';
import { RecoveryError, RecoveryEvent, RecoveryWireEvent } from './recovery';

it('replacement proof preserves exact public Ollama wire evidence and typed history on paused cancellation', async () => {
  const requests: Buffer[] = [];
  const captures: RecoveryWireEvent[] = [];
  const events: RecoveryEvent[] = [];
  let closed: () => void = () => undefined;
  const socketClosed = new Promise<void>((resolve) => {
    closed = resolve;
  });
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(Buffer.concat(chunks));
    if (requests.length === 1) {
      response.writeHead(503);
      response.end('{"error":"payload-secret"}');
      return;
    }
    response.on('close', closed);
    response.write('{"model":"local","message":{"content":"answer"},"done":false}\n');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const controller = new AbortController();
  const gateway = new OllamaGateway(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  const stream = gateway.generateStream('local', [Message.user('payload-secret')], {
    recovery: {
      maxAttempts: 2,
      baseDelayMs: 0,
      signal: controller.signal,
      admit: async () => 'allow',
      onEvent: (event) => {
        events.push(event);
      },
      onWire: (event) => {
        captures.push(event);
      },
    },
  });
  try {
    expect(await stream.next()).toMatchObject({
      value: { ok: true, value: { content: 'answer' } },
    });
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(
      captures
        .filter((event) => event.direction === 'request')
        .map((event) => Buffer.from(event.bytes))
    ).toEqual(requests);
    controller.abort();
    await socketClosed;
    const cancelled = await stream.next();
    expect(cancelled).toMatchObject({
      value: { ok: false, error: { outcome: 'cancelled' } },
    });
    assert(!cancelled.done);
    assert(!cancelled.value.ok);
    assert(cancelled.value.error instanceof RecoveryError);
    expect(
      cancelled.value.error.history.map((failure) => [failure.wireAttempt, failure.httpStatus])
    ).toEqual([
      [1, 503],
      [2, 200],
    ]);
    expect(cancelled.value.error.history.map((failure) => failure.attemptId)).toEqual([
      events[0].attemptId,
      events[6].attemptId,
    ]);
    expect(cancelled.value.error.history.map((failure) => failure.logicalRequestId)).toEqual([
      events[0].logicalRequestId,
      events[0].logicalRequestId,
    ]);
    expect(events[9].failure).toMatchObject({
      operation: 'streaming',
      remoteTerminationConfirmed: false,
      progress: { headersReceived: true, observed: { contentBytes: 6 } },
    });
    expect(
      Buffer.concat(
        captures
          .filter((event) => event.direction === 'response' && event.wireAttempt === 2)
          .map((event) => Buffer.from(event.bytes))
      )
    ).toEqual(Buffer.from('{"model":"local","message":{"content":"answer"},"done":false}\n'));
    expect(events[0].logicalRequestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[0].attemptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(events.map((event) => event.type)).toEqual([
      'attempt_started',
      'attempt_failed',
      'admission_pending',
      'admission_allowed',
      'delay_scheduled',
      'retry_started',
      'attempt_started',
      'progress',
      'attempt_failed',
      'cancelled',
    ]);
    expect(events[8].progress).toMatchObject({
      observed: { contentBytes: 6 },
      delivered: { contentBytes: 6 },
    });
    expect(events[0].logicalRequestId).toBe(events[6].logicalRequestId);
    expect(events[0].attemptId).not.toBe(events[6].attemptId);
    expect(events[9].failure?.wireAttempt).toBe(2);
  } finally {
    controller.abort();
    await stream.return(undefined);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
