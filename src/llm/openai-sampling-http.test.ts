import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmBroker, OpenAIGateway, Message, LlmTool, Ok, unwrap } from '../index';

// ts-openai-sampling-v1: public API and production HTTP, with local scripted replies.
const toolCall = {
  id: 'call-one',
  type: 'function',
  function: { name: 'answer', arguments: '{}' },
};
const descriptor = {
  type: 'function' as const,
  function: {
    name: 'answer',
    description: 'Answer',
    parameters: { type: 'object', properties: {} },
  },
};
const tool: LlmTool = {
  name: () => 'answer',
  matches: (name) => name === 'answer',
  descriptor: () => descriptor,
  run: async () => Ok({ answer: 42 }),
};
const recovery = {
  maxAttempts: 2,
  baseDelayMs: 0,
  jitter: () => 0,
  admit: async (): Promise<'allow'> => 'allow',
};
const answer = JSON.stringify({
  choices: [{ message: { content: 'verified' }, finish_reason: 'stop' }],
});

describe('OpenAI configured sampling HTTP contract', () => {
  let server: Server;
  let broker: LlmBroker;
  let replies: { status: number; body: string }[];
  const bodies: string[] = [];

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      bodies.push(body);
      const reply = replies.shift();
      response.writeHead(reply?.status ?? 500, { 'Content-Type': 'application/json' });
      response.end(reply?.body ?? '{}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    broker = new LlmBroker(
      'gpt-4o',
      new OpenAIGateway(
        'fixture-key',
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
      )
    );
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    bodies.length = 0;
    replies = [];
  });

  it('preserves configured sampling through tool continuation and byte-identical admitted retries', async () => {
    const unavailable = { status: 503, body: '{"error":"temporarily unavailable"}' };
    replies = [
      unavailable,
      {
        status: 200,
        body: JSON.stringify({
          choices: [
            { message: { content: null, tool_calls: [toolCall] }, finish_reason: 'tool_calls' },
          ],
        }),
      },
      unavailable,
      { status: 200, body: answer },
    ];

    const result = await broker.generate([Message.user('hello')], [tool], {
      topP: 0,
      frequencyPenalty: 0,
      presencePenalty: 0.5,
      recovery,
    });

    expect(unwrap(result)).toBe('verified');
    const controls = { top_p: 0, frequency_penalty: 0, presence_penalty: 0.5 };
    const initial = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [descriptor],
      ...controls,
    };
    const continuation = {
      ...initial,
      messages: [
        ...initial.messages,
        { role: 'assistant', content: '', tool_calls: [toolCall] },
        { role: 'tool', content: '{"answer":42}', tool_call_id: 'call-one' },
      ],
    };
    expect(bodies.map((body) => JSON.parse(body))).toEqual([
      initial,
      initial,
      continuation,
      continuation,
    ]);
    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[2]).toBe(bodies[3]);
    expect(replies).toEqual([]);
  });
});
