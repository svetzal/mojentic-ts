import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmBroker } from './broker';
import { OllamaGateway } from './gateways/ollama';
import { CompletionConfig, Message } from './models';

let server: Server;
let url: string;
const requests: Buffer[] = [];
beforeEach(async () => {
  requests.length = 0;
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(Buffer.concat(chunks));
    response.setHeader('Content-Type', 'application/json');
    if (requests.length === 1) {
      response.writeHead(503);
      response.end('{"error":"credential-secret payload-secret"}');
    } else {
      response.end(
        JSON.stringify({ message: { role: 'assistant', content: 'answer' }, done: true })
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it('holds ambiguous admission pending, freezes request bytes, and reports exact wire identities', async () => {
  const messages = [Message.user('payload-secret')];
  const events: {
    type: string;
    logicalRequestId: string;
    attemptId: string;
    wireAttempt: number;
  }[] = [];
  let allow: (decision: 'allow') => void = () => {
    throw new Error('admission not pending');
  };
  let entered: () => void = () => {
    throw new Error('probe not ready');
  };
  const pending = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const config: CompletionConfig = Object.assign(
    { temperature: 0.2 },
    {
      recovery: {
        maxAttempts: 2,
        baseDelayMs: 0,
        onEvent: (event: (typeof events)[number]) => events.push(event),
        admit: () =>
          new Promise<'allow'>((resolve) => {
            allow = resolve;
            entered();
          }),
      },
    }
  );
  const resultPromise = new LlmBroker('local', new OllamaGateway(url)).generateResponse(
    messages,
    undefined,
    config
  );
  const outcome = await Promise.race([
    pending.then(() => 'pending'),
    resultPromise.then(() => 'finished'),
  ]);

  expect(outcome).toBe('pending');
  expect(requests).toEqual([
    Buffer.from(
      '{"model":"local","messages":[{"role":"user","content":"payload-secret"}],"options":{"temperature":0.2},"stream":false}'
    ),
  ]);
  messages[0].content = 'changed-after-encoding';
  allow('allow');
  const result = await resultPromise;

  expect(result).toMatchObject({ ok: true, value: { content: 'answer' } });
  expect(requests[1]).toEqual(requests[0]);
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
  const first = events[0];
  const second = events[6];
  expect(first.logicalRequestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(second.logicalRequestId).toBe(first.logicalRequestId);
  expect(second.attemptId).not.toBe(first.attemptId);
  expect(first.wireAttempt).toBe(1);
  expect(second.wireAttempt).toBe(2);
  expect(JSON.stringify(events)).not.toMatch(/credential-secret|payload-secret/);
});
