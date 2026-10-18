import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Message, OllamaGateway, unwrap } from '../index';

it('sends the exact named Ollama effort through the production HTTP transport', async () => {
  const bodies: unknown[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    bodies.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ message: { content: 'verified' }, done: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  try {
    const result = await new OllamaGateway(host).generate('qwen', [Message.user('hello')], {
      reasoningEffort: 'low',
    });

    expect(unwrap(result).content).toBe('verified');
    expect(bodies).toEqual([
      {
        model: 'qwen',
        messages: [{ role: 'user', content: 'hello' }],
        options: {},
        stream: false,
        think: 'low',
      },
    ]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
