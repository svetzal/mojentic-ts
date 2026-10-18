import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmBroker, OMLXGateway, Message, LlmTool, Ok, unwrap } from '../index';

it('retains exact completed native reasoning in the streaming continuation wire', async () => {
  const bodies: Record<string, unknown>[] = [];
  const call = {
    id: 'call-native',
    type: 'function',
    function: { name: 'lookup', arguments: '{"city":"Paris"}' },
  };
  const tool: LlmTool = {
    name: () => 'lookup',
    matches: (name) => name === 'lookup',
    descriptor: () => ({
      type: 'function',
      function: { name: 'lookup', description: 'Lookup', parameters: { type: 'object' } },
    }),
    run: async () => Ok({ temperature: 18 }),
  };
  const server = createServer(async (request, response) => {
    const buffers: Buffer[] = [];
    for await (const part of request) buffers.push(Buffer.from(part));
    bodies.push(JSON.parse(Buffer.concat(buffers).toString()) as Record<string, unknown>);
    response.setHeader('content-type', 'text/event-stream');
    response.end(
      bodies.length === 1
        ? `data: ${JSON.stringify({ choices: [{ delta: { content: 'Checking.', reasoning_content: 'Need weather.', tool_calls: [{ index: 0, ...call }] } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n`
        : 'data: {"choices":[{"delta":{"content":"18 degrees"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const broker = new LlmBroker(
      'alias',
      new OMLXGateway(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    );
    const visible: string[] = [];
    const config = { temperature: 0, retainReasoning: true };
    for await (const result of broker.generateStream([Message.user('weather?')], config, [tool]))
      visible.push(unwrap(result));

    expect(visible).toEqual(['Checking.', '18 degrees']);
    expect(bodies[1]?.messages).toEqual([
      { role: 'user', content: 'weather?' },
      {
        role: 'assistant',
        content: 'Checking.',
        reasoning_content: 'Need weather.',
        tool_calls: [call],
      },
      { role: 'tool', content: '{"temperature":18}', tool_call_id: 'call-native' },
    ]);
    expect(bodies[1]?.chat_template_kwargs).toEqual({ preserve_thinking: true });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
