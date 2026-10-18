import { createEndpoint } from '../../scripts/test-support/transport.cjs';
import { OpenAIGateway, Message } from '../index';

// Executable contract ts-temperature-context-v1: public API, production HTTP transport.
it('omits sampling defaults on an admitted event-stream resend with identical encoded bodies', async () => {
  const bodies: string[] = [];
  const server = createEndpoint(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += String(chunk);
    bodies.push(body);
    if (bodies.length === 1) {
      response.writeHead(503);
      response.end('{"error":"temporarily unavailable"}');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.end(
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    );
  });
  await new Promise<void>((resolve) => server.activate(0, '127.0.0.1', resolve));
  try {
    const gateway = new OpenAIGateway(
      'fixture-key',
      `http://127.0.0.1:${server.address().port}/v1`
    );
    const events = [];
    for await (const event of gateway.generateStreamEvents('gpt-4o', [Message.user('hello')], {
      recovery: { maxAttempts: 2, baseDelayMs: 0, jitter: () => 0, admit: async () => 'allow' },
    }))
      events.push(event);

    expect(events).toEqual([
      { type: 'content', text: 'hello' },
      expect.objectContaining({ type: 'completed' }),
    ]);
    expect(bodies.map((body) => JSON.parse(body))).toEqual([
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        stream_options: { include_usage: true },
      },
      {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
        stream_options: { include_usage: true },
      },
    ]);
    expect(bodies[0]).toBe(bodies[1]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
