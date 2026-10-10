import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { OllamaGateway } from './gateways/ollama';
import { Message } from './models';
import { RecoveryEvent, RecoveryWireEvent } from './recovery';

it('recovers through public HTTP with exact bytes then cancels while the consumer is paused', async () => {
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
    expect(await stream.next()).toMatchObject({
      value: { ok: false, error: { outcome: 'cancelled' } },
    });
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
