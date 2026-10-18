/** Executable ts-native-reasoning-history-v1; shared by source and fresh installed consumer. */
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fixture = require('../src/llm/gateways/__fixtures__/reasoning-history-v1.json');
assert.equal(fixture.contract, 'ts-native-reasoning-history-v1');

async function boundary(run) {
  const records = [];
  const replies = [];
  const server = createServer(async (request, response) => {
    const buffers = [];
    for await (const part of request) buffers.push(part);
    records.push({ url: request.url, body: JSON.parse(Buffer.concat(buffers).toString()) });
    const reply = replies.shift();
    if (!reply) {
      response.writeHead(500);
      response.end('Unexpected request');
      return;
    }
    response.writeHead(reply.status || 200, {
      'content-type': reply.stream ? 'text/event-stream' : 'application/json',
    });
    response.end(reply.body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`, records, replies);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function gateway(api, provider, host) {
  if (provider === 'ollama') return new api.OllamaGateway(host);
  if (provider === 'omlx') return new api.OMLXGateway(host);
  return new api.OpenAIGateway('contract-key', host);
}
function configFor(api, retain, recovery) {
  return {
    retainReasoning: retain,
    reasoningProfile: api.QWEN3_8_REASONING_PROFILE,
    ...(recovery ? { recovery: { maxAttempts: 1 } } : {}),
  };
}
function toolsFor(api, executions) {
  return fixture.calls.map((call, index) => ({
    name: () => call.function.name,
    matches: (name) => name === call.function.name,
    descriptor: () => ({
      type: 'function',
      function: {
        name: call.function.name,
        description: 'Contract tool',
        parameters: { type: 'object' },
      },
    }),
    run: async (arguments_) => {
      executions.push({ name: call.function.name, arguments: arguments_ });
      return api.Ok(fixture.toolResults[index]);
    },
  }));
}

async function verifyContinuation(
  api,
  { provider, stream, retain, recovery, ending = 'success', native = true }
) {
  await boundary(async (host, records, replies) => {
    const wire = fixture.providers[provider];
    const first = native
      ? stream
        ? wire.stream
        : wire.ordinary
      : stream
        ? wire.streamWithoutReasoning
        : wire.ordinaryWithoutReasoning;
    replies.push({ body: first, stream });
    replies.push(
      ending === 'failure' || ending === 'retry'
        ? { status: ending === 'retry' ? 503 : 400, body: '{"error":{"message":"later failure"}}' }
        : { body: stream ? wire.finalStream : wire.final, stream }
    );
    if (ending === 'retry') replies.push({ body: stream ? wire.finalStream : wire.final, stream });
    const messages = [api.Message.user(fixture.request.content)];
    const executions = [];
    const broker = new api.LlmBroker('caller-alias', gateway(api, provider, host));
    const config = {
      ...configFor(api, retain, recovery),
      ...(ending === 'retry'
        ? {
            recovery: {
              maxAttempts: 2,
              baseDelayMs: 0,
              jitter: () => 0,
              admit: async () => 'allow',
            },
          }
        : {}),
    };
    const results = [];
    if (stream) {
      for await (const result of broker.generateStream(messages, config, toolsFor(api, executions)))
        results.push(result);
      assert.equal(
        results
          .filter((result) => result.ok)
          .map((result) => result.value)
          .join(''),
        ending === 'failure' ? fixture.content : `${fixture.content}18 degrees`
      );
      assert.equal(
        results.some((result) => !result.ok),
        ending === 'failure'
      );
    } else {
      const result = await broker.generate(messages, toolsFor(api, executions), config);
      assert.equal(result.ok, ending !== 'failure');
      if (result.ok) assert.equal(result.value, '18 degrees');
    }
    const expected = retain && native ? wire.on : wire.off;
    if (ending === 'retry') {
      assert.deepEqual(records[2], records[1]);
      records.pop();
    }
    assert.deepEqual(
      records.map((record) => record.url),
      [
        provider === 'ollama' ? '/api/chat' : '/v1/chat/completions',
        provider === 'ollama' ? '/api/chat' : '/v1/chat/completions',
      ]
    );
    assert.deepEqual(records[0].body.messages, [fixture.request]);
    assert.deepEqual(records[1].body.messages, expected);
    assert.deepEqual(
      records.map((record) => record.body.chat_template_kwargs),
      provider === 'omlx' && retain
        ? [{ preserve_thinking: true }, { preserve_thinking: true }]
        : [undefined, undefined]
    );
    assert.deepEqual(
      executions,
      fixture.calls.map((call) => ({
        name: call.function.name,
        arguments: JSON.parse(call.function.arguments),
      }))
    );
    const assistant = {
      role: 'assistant',
      content: fixture.content,
      tool_calls: fixture.calls,
      ...(retain && native ? { thinking: fixture.thinking } : {}),
    };
    assert.deepEqual(
      JSON.parse(JSON.stringify(messages)),
      retain || recovery
        ? [
            fixture.request,
            assistant,
            ...fixture.calls.map((call, index) => ({
              role: 'tool',
              content: JSON.stringify(fixture.toolResults[index]),
              tool_call_id: call.id,
              name: call.function.name,
            })),
          ]
        : [fixture.request]
    );
  });
}

async function verifyInterrupted(api, { provider, recovery, cancel = false, ending = 'eof' }) {
  await boundary(async (host, records, replies) => {
    const partial = fixture.providers[provider].partial;
    const suffix =
      ending === 'error'
        ? provider === 'ollama'
          ? '{bad json}\n'
          : 'data: {bad json}\n\n'
        : ending === 'marker'
          ? 'data: [DONE]\n\n'
          : '';
    replies.push({ stream: true, body: partial + suffix });
    const messages = [api.Message.user(fixture.request.content)];
    const executions = [];
    const broker = new api.LlmBroker('alias', gateway(api, provider, host));
    const iterator = broker.generateStream(
      messages,
      configFor(api, true, recovery),
      toolsFor(api, executions)
    );
    if (cancel) {
      assert.deepEqual(await iterator.next(), { done: false, value: api.Ok(fixture.content) });
      await iterator.return();
    } else {
      for await (const result of iterator) {
        assert.equal(typeof result.ok, 'boolean');
      }
    }
    assert.deepEqual(messages, [fixture.request]);
    assert.deepEqual(executions, []);
    assert.deepEqual(
      records.map((record) => record.body.messages),
      [[fixture.request]]
    );
  });
}

async function verifyControls(api, { provider, recovery, route, unsupported = false }) {
  await boundary(async (host, records, replies) => {
    const selected = gateway(api, provider, host);
    const config = {
      ...configFor(api, true, recovery),
      ...(unsupported
        ? {
            reasoningProfile: {
              name: 'no-history',
              supportedEfforts: ['low'],
              supportsReasoningHistory: false,
            },
          }
        : {}),
    };
    const rejects = provider === 'openai' || unsupported;
    const messages = [
      api.Message.assistant('Visible', undefined, 'Native'),
      api.Message.user('next'),
    ];
    const ollama = provider === 'ollama';
    const text = '{"answer":42}';
    replies.push({
      body: JSON.stringify(
        ollama
          ? { message: { role: 'assistant', content: text }, done: true, done_reason: 'stop' }
          : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }
      ),
    });
    let result;
    if (route === 'structured') {
      result = await new api.LlmBroker('alias', selected).generateObject(
        messages,
        { type: 'object', properties: { answer: { type: 'number' } } },
        config
      );
    } else if (route === 'ordinary') result = await selected.generate('alias', messages, config);
    else if (route === 'stream') {
      const chunks = [];
      for await (const chunk of selected.generateStream('alias', messages, config))
        chunks.push(chunk);
      result = chunks[0];
    } else {
      const events = [];
      for await (const event of selected.generateStreamEvents('alias', messages, config))
        events.push(event);
      assert.equal(events[0].type, 'error');
      result = { ok: false, error: events[0].error.detail };
    }
    if (rejects) {
      assert.equal(result.ok, false);
      assert.equal(result.error.name, 'ValidationError');
      assert.equal(result.error.field, 'retainReasoning');
      assert.deepEqual(records, []);
    } else {
      assert.equal(result.ok, true);
      assert.deepEqual(records[0].body.messages, [
        ollama
          ? { role: 'assistant', content: 'Visible', thinking: 'Native' }
          : { role: 'assistant', content: 'Visible', reasoning_content: 'Native' },
        { role: 'user', content: 'next' },
      ]);
      assert.deepEqual(
        records[0].body.chat_template_kwargs,
        ollama ? undefined : { preserve_thinking: true }
      );
      assert.deepEqual(
        ollama ? records[0].body.format : records[0].body.response_format,
        ollama
          ? { type: 'object', properties: { answer: { type: 'number' } } }
          : {
              type: 'json_schema',
              json_schema: {
                name: 'response',
                schema: { type: 'object', properties: { answer: { type: 'number' } } },
              },
            }
      );
    }
  });
}

async function verifyOpenAIExclusion(api, recovery) {
  await boundary(async (host, records, replies) => {
    replies.push({ body: '{"choices":[{"message":{"content":"ok"},"finish_reason":"stop"}]}' });
    const result = await gateway(api, 'openai', host).generate(
      'gpt-4o',
      [api.Message.assistant('Visible', undefined, 'Native')],
      { retainReasoning: false, ...(recovery ? { recovery: {} } : {}) }
    );
    assert.equal(result.ok, true);
    assert.deepEqual(
      records.map((record) => record.body),
      [{ model: 'gpt-4o', messages: [{ role: 'assistant', content: 'Visible' }] }]
    );
  });
}

async function verifyAll(api) {
  for (const provider of ['ollama', 'omlx'])
    for (const recovery of [false, true]) {
      for (const stream of [false, true])
        for (const retain of [false, true])
          for (const ending of ['success', 'failure'])
            await verifyContinuation(api, { provider, recovery, stream, retain, ending });
      for (const cancel of [false, true])
        await verifyInterrupted(api, { provider, recovery, cancel });
      await verifyInterrupted(api, { provider, recovery, ending: 'error' });
      if (provider === 'omlx')
        await verifyInterrupted(api, { provider, recovery, ending: 'marker' });
      for (const stream of [false, true])
        await verifyContinuation(api, {
          provider,
          recovery: true,
          stream,
          retain: true,
          ending: 'retry',
        });
      for (const stream of [false, true])
        await verifyContinuation(api, { provider, recovery, stream, retain: true, native: false });
      await verifyControls(api, { provider, recovery, route: 'structured' });
    }
  for (const provider of ['ollama', 'omlx', 'openai'])
    for (const recovery of [false, true])
      for (const route of ['ordinary', 'structured', 'stream', 'events'])
        await verifyControls(api, {
          provider,
          recovery,
          route,
          unsupported: provider !== 'openai',
        });
  for (const recovery of [false, true]) await verifyOpenAIExclusion(api, recovery);
}
module.exports = {
  verifyAll,
  verifyContinuation,
  verifyInterrupted,
  verifyControls,
  verifyOpenAIExclusion,
};
