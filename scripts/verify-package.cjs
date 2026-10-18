/** Installed-artifact contract ts-packaged-library-v1. Public API only; shared JSON cases. */
const assert = require('node:assert/strict');
const historyContract = require('../src/llm/gateways/__fixtures__/reasoning-history-v1.json');
const { verifyAll: verifyReasoningHistory } = require('./reasoning-history-contract.cjs');
const reasoningContract = require('../src/llm/gateways/__fixtures__/reasoning-effort-v1.json');
const profileContract = require('../src/llm/gateways/__fixtures__/reasoning-profiles-v1.json');
const samplingContract = require('../src/llm/gateways/__fixtures__/openai-sampling-v1.json');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: join(tmpdir(), 'mojentic-package-npm-cache') },
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
  return result.stdout;
}

async function verify(consumer) {
  const installed = createRequire(join(consumer, 'package.json'));
  const api = installed('mojentic');
  await verifyReasoningHistory(api);
  console.log(
    `PASS ${historyContract.contract}: exact continuation, interruption, controls and OpenAI exclusion`
  );
  for (const name of [
    'OpenAIGateway',
    'OllamaGateway',
    'OMLXGateway',
    'LlmBroker',
    'ChatSession',
    'Message',
    'RecoveryError',
    'RecoveryPolicyError',
    'inspectRecoveryFailure',
    'getModelContextWindow',
    'effectiveContextWindow',
    'StreamEventError',
  ])
    assert.equal(typeof api[name], 'function', name);
  assert.equal(api.VERSION, installed('mojentic/package.json').version);
  const records = [];
  let replies = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    records.push({ url: request.url, headers: request.headers, body });
    const reply = replies.shift();
    assert.ok(reply, `Unexpected request ${request.url}`);
    response.writeHead(
      reply.status || 200,
      reply.headers || { 'content-type': 'application/json' }
    );
    response.end(reply.body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `http://127.0.0.1:${server.address().port}`;
  const messages = [api.Message.user('packaged contract request')];
  const answer = JSON.stringify({
    id: 'completion-v1',
    model: 'qwen',
    choices: [{ message: { content: 'verified' }, finish_reason: 'stop' }],
  });
  const unavailable = {
    status: 503,
    headers: {
      'content-type': 'application/json',
      'retry-after': '0',
      'x-request-id': '12345678-1234-1234-1234-123456789abc',
    },
    body: JSON.stringify({ error: { code: 'server_error', message: 'scripted unavailable' } }),
  };
  const gateway = new api.OMLXGateway(host);
  try {
    // Same failing response: explicit rejection forbids replay; allow recovers exact bytes.
    replies = [unavailable];
    const rejected = await gateway.generate('qwen', messages, {
      temperature: 0,
      maxTokens: 19,
      recovery: { maxAttempts: 2, baseDelayMs: 0, jitter: () => 0, admit: async () => 'reject' },
    });
    assert.equal(rejected.ok, false);
    assert.ok(rejected.error instanceof api.RecoveryError);
    assert.equal(rejected.error.outcome, 'admission_rejected');
    assert.equal(rejected.error.failure.httpStatus, 503);
    assert.equal(rejected.error.failure.providerRequestId, '12345678-1234-1234-1234-123456789abc');
    assert.equal(records.length, 1);
    assert.deepEqual(JSON.parse(records[0].body), {
      model: 'qwen',
      messages,
      temperature: 0,
      max_tokens: 19,
    });

    const wire = [];
    const events = [];
    replies = [unavailable, { body: answer }];
    const recovered = await gateway.generate('qwen', messages, {
      temperature: 0,
      maxTokens: 19,
      recovery: {
        maxAttempts: 2,
        baseDelayMs: 0,
        jitter: () => 0,
        admit: async () => 'allow',
        onWire: (event) => wire.push(event),
        onEvent: (event) => events.push(event),
      },
    });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.value.content, 'verified');
    const responses = wire.filter((event) => event.direction === 'response');
    assert.deepEqual(
      responses.map((event) => event.status),
      [503, 200]
    );
    assert.deepEqual(
      responses.map((event) => Buffer.from(event.bytes).toString()),
      [unavailable.body, answer]
    );
    assert.equal(records[1].body, records[2].body);
    assert.equal(records[1].url, '/v1/chat/completions');
    const requests = wire.filter((event) => event.direction === 'request');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].logicalRequestId, requests[1].logicalRequestId);
    assert.notEqual(requests[0].attemptId, requests[1].attemptId);
    assert.deepEqual(
      requests.map((event) => event.wireAttempt),
      [1, 2]
    );
    assert.equal(Buffer.from(requests[0].bytes).toString(), records[1].body);
    assert.equal(Buffer.from(requests[1].bytes).toString(), records[2].body);
    assert.ok(
      events.some(
        (event) =>
          event.type === 'attempt_failed' &&
          event.failure.httpStatus === 503 &&
          event.failure.classification.eligible
      )
    );
    console.log(
      'Exact recovery identities:',
      JSON.stringify(
        requests.map(({ logicalRequestId, attemptId, wireAttempt }) => ({
          logicalRequestId,
          attemptId,
          wireAttempt,
        }))
      )
    );

    replies = [{ body: JSON.stringify({ data: [{ id: 'qwen', max_model_len: 65536 }] }) }];
    assert.deepEqual(await api.getModelContextWindow(gateway, 'qwen'), {
      ok: true,
      value: { maxContextTokens: 65536, field: 'max_model_len' },
    });
    assert.equal(records.at(-1).url, '/v1/models');
    replies = [{ body: JSON.stringify({ data: [{ id: 'qwen' }] }) }];
    assert.deepEqual(await api.getModelContextWindow(gateway, 'qwen'), { ok: true, value: null });
    replies = [{ status: 404, body: '{}' }];
    assert.equal((await api.getModelContextWindow(gateway, 'qwen')).ok, false);

    // Unset controls stay absent; metadata queries cannot mutate the next request.
    replies = [{ body: answer }];
    await gateway.generate('qwen', messages);
    const baseline = records.at(-1).body;
    assert.deepEqual(JSON.parse(baseline), { model: 'qwen', messages });
    replies = [
      { body: JSON.stringify({ data: [{ id: 'qwen', max_model_len: 65536 }] }) },
      { body: answer },
    ];
    await api.getModelContextWindow(gateway, 'qwen');
    await gateway.generate('qwen', messages);
    assert.equal(records.at(-1).body, baseline);

    replies = [
      {
        body:
          'data: {"model":"keepalive","choices":[]}\n\n' +
          'data: {"choices":[{"delta":{"reasoning_content":"thought"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"visible"}}]}\n\n' +
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5,"time_to_first_token":0.7}}\n\n' +
          'data: [DONE]\n\n',
        headers: { 'content-type': 'text/event-stream' },
      },
    ];
    const stream = [];
    for await (const event of gateway.generateStreamEvents('qwen', messages, { temperature: 0 }))
      stream.push(event);
    assert.equal(
      stream
        .filter((event) => event.type === 'content')
        .map((event) => event.text)
        .join(''),
      'visible'
    );
    const terminal = stream.at(-1);
    assert.equal(terminal.type, 'completed');
    assert.equal(terminal.metadata.metadata.first_token_kind, 'thinking');
    assert.ok(terminal.metadata.metadata.time_to_first_token_ms >= 0);
    assert.ok(
      terminal.metadata.metadata.request_duration_ms >=
        terminal.metadata.metadata.time_to_first_token_ms
    );
    assert.equal(terminal.metadata.metadata.usage.time_to_first_token, 0.7);
    assert.deepEqual(JSON.parse(records.at(-1).body), {
      model: 'qwen',
      messages,
      temperature: 0,
      stream: true,
      stream_options: { include_usage: true },
    });

    replies = [{ body: answer }];
    await new api.OpenAIGateway('package-test-key', `${host}/v1`).generate('gpt-4o', messages, {
      temperature: 0,
      maxTokens: 19,
    });
    assert.deepEqual(JSON.parse(records.at(-1).body), {
      model: 'gpt-4o',
      messages,
      temperature: 0,
      max_tokens: 19,
    });
    assert.equal(records.at(-1).headers.authorization, 'Bearer package-test-key');
    replies = [
      { body: JSON.stringify({ message: { role: 'assistant', content: 'verified' }, done: true }) },
    ];
    await new api.OllamaGateway(host).generate('qwen', messages, { temperature: 0, maxTokens: 19 });
    assert.equal(records.at(-1).url, '/api/chat');
    assert.deepEqual(JSON.parse(records.at(-1).body), {
      model: 'qwen',
      messages,
      options: { temperature: 0, num_predict: 19 },
      stream: false,
    });
    assert.equal(replies.length, 0);
    // Installed executable set ts-temperature-context-v1. Each case traverses
    // the public broker and production HTTP transport from this fresh install.
    const schema = {
      type: 'object',
      properties: { answer: { type: 'number' } },
      required: ['answer'],
    };
    const configurations = [
      undefined,
      {},
      {
        temperature: undefined,
        numCtx: undefined,
        topP: undefined,
        frequencyPenalty: undefined,
        presencePenalty: undefined,
      },
      { temperature: 0, numCtx: 0 },
      { temperature: 0.4, numCtx: 4096 },
      { temperature: 0 },
      { numCtx: 8192 },
    ];
    const policies = [
      undefined,
      {},
      {
        maxAttempts: 2,
        baseDelayMs: 0,
        jitter: () => 0,
        admit: async () => 'allow',
      },
    ];
    for (const provider of [
      {
        name: 'openai',
        model: 'gpt-4o',
        gateway: new api.OpenAIGateway('fixture-key', `${host}/v1`),
      },
      {
        name: 'openai-fixed',
        model: 'o3',
        gateway: new api.OpenAIGateway('fixture-key', `${host}/v1`),
      },
      { name: 'omlx', model: 'qwen', gateway },
      { name: 'ollama', model: 'qwen', gateway: new api.OllamaGateway(host) },
    ]) {
      const ollama = provider.name === 'ollama';
      const broker = new api.LlmBroker(provider.model, provider.gateway);
      const text = '{"answer":42}';
      for (const route of ['ordinary', 'structured', 'legacy stream', 'event stream']) {
        const streaming = route.endsWith('stream');
        const success = {
          body: streaming
            ? ollama
              ? `${JSON.stringify({ message: { content: text }, done: false })}\n{"message":{"content":""},"done":true,"done_reason":"stop"}\n`
              : `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`
            : JSON.stringify(
                ollama
                  ? { message: { role: 'assistant', content: text }, done: true }
                  : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }
              ),
          headers: {
            'Content-Type': streaming
              ? ollama
                ? 'application/x-ndjson'
                : 'text/event-stream'
              : 'application/json',
          },
        };
        for (const samplingCase of [
          ...configurations.map((config) => ({ config, wire: {} })),
          ...(provider.name.startsWith('openai') ? samplingContract.cases : []),
        ])
          for (const policy of policies) {
            const sampling = samplingCase.config;
            const config = policy === undefined ? sampling : { ...sampling, recovery: policy };
            const retry = policy?.maxAttempts === 2;
            replies = retry ? [unavailable, success] : [success];
            const start = records.length;
            if (route === 'ordinary') {
              const result = await broker.generateResponse(messages, undefined, config);
              assert.equal(result.ok, true);
              assert.equal(result.value.content, text);
            } else if (route === 'structured') {
              assert.deepEqual(await broker.generateObject(messages, schema, config), {
                ok: true,
                value: { answer: 42 },
              });
            } else if (route === 'legacy stream') {
              const chunks = [];
              for await (const chunk of broker.generateStream(messages, config)) {
                assert.equal(chunk.ok, true);
                chunks.push(chunk.value);
              }
              assert.equal(chunks.join(''), text);
            } else {
              const events = [];
              for await (const event of broker.generateStreamEvents(messages, config))
                events.push(event);
              assert.deepEqual(
                events.filter((event) => event.type === 'content'),
                [{ type: 'content', text }]
              );
              assert.equal(events.at(-1).type, 'completed');
            }
            const controls = {};
            if (sampling?.temperature !== undefined)
              controls.temperature = provider.name === 'openai-fixed' ? 1 : sampling.temperature;
            const expected = { model: provider.model, messages, ...samplingCase.wire };
            if (ollama) {
              if (sampling?.numCtx !== undefined) controls.num_ctx = sampling.numCtx;
              expected.options = controls;
              expected.stream = streaming;
            } else {
              Object.assign(expected, controls);
              if (streaming) expected.stream = true;
              if (route === 'event stream') expected.stream_options = { include_usage: true };
            }
            if (route === 'structured') {
              if (ollama) expected.format = schema;
              else
                expected.response_format = {
                  type: 'json_schema',
                  json_schema: { name: 'response', schema },
                };
            }
            const sent = records.slice(start);
            assert.deepEqual(
              sent.map((record) => JSON.parse(record.body)),
              Array.from({ length: retry ? 2 : 1 }, () => expected)
            );
            for (const record of sent) {
              assert.equal(record.url, ollama ? '/api/chat' : '/v1/chat/completions');
              assert.equal(record.body, sent[0].body);
              const samplingFields = Array.from(
                record.body.matchAll(/"(top_p|frequency_penalty|presence_penalty)"\s*:/g),
                (match) => match[1]
              );
              assert.deepEqual(samplingFields.sort(), Object.keys(samplingCase.wire).sort());
            }
            assert.equal(replies.length, 0);
          }
      }
    }
    const text = '{"answer":42}';
    // Same versioned effort cases as the source public-API HTTP tests.
    for (const selection of profileContract.selections) {
      for (const provider of ['ollama', 'omlx', 'openai-reasoning', 'openai-ordinary']) {
        const ollama = provider === 'ollama';
        const model =
          provider === 'openai-reasoning'
            ? 'o3'
            : provider === 'openai-ordinary'
              ? 'gpt-4o'
              : selection.model;
        const effortGateway = ollama
          ? new api.OllamaGateway(host)
          : provider === 'omlx'
            ? gateway
            : new api.OpenAIGateway('fixture-key', `${host}/v1`);
        for (const route of ['ordinary', 'structured', 'legacy stream', 'event stream']) {
          const streaming = route.endsWith('stream');
          for (const recovery of [undefined, {}]) {
            for (const testCase of reasoningContract.cases) {
              const config = {
                ...testCase.config,
                ...(selection.profile ? { reasoningProfile: selection.profile } : {}),
                ...(recovery === undefined ? {} : { recovery }),
                ...(route === 'structured'
                  ? { responseFormat: { type: 'json_object', schema } }
                  : {}),
              };
              const providerRejects = provider.startsWith('openai') && testCase.openaiRejects;
              const profileRejects =
                selection.profile &&
                testCase.config.reasoningEffort !== undefined &&
                !selection.profile.supportedEfforts.includes(testCase.config.reasoningEffort);
              const rejects = providerRejects || profileRejects;
              const start = records.length;
              replies = rejects
                ? []
                : [
                    {
                      body: streaming
                        ? ollama
                          ? `${JSON.stringify({ message: { content: text }, done: false })}\n{"message":{"content":""},"done":true,"done_reason":"stop"}\n`
                          : `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n`
                        : JSON.stringify(
                            ollama
                              ? {
                                  message: { role: 'assistant', content: text },
                                  done: true,
                                  done_reason: 'stop',
                                }
                              : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }
                          ),
                    },
                  ];
              let error;
              if (route === 'event stream') {
                const events = [];
                for await (const event of effortGateway.generateStreamEvents(
                  model,
                  messages,
                  config
                ))
                  events.push(event);
                if (rejects) {
                  assert.equal(events.length, 1);
                  assert.equal(events[0].type, 'error');
                  assert.ok(events[0].error instanceof api.StreamEventError);
                  assert.equal(events[0].error.reason, 'request_failed');
                  error = events[0].error.detail;
                } else {
                  assert.deepEqual(
                    events.filter((event) => event.type === 'content'),
                    [{ type: 'content', text }]
                  );
                  assert.equal(events.at(-1).type, 'completed');
                }
              } else if (route === 'legacy stream') {
                const chunks = [];
                for await (const chunk of effortGateway.generateStream(model, messages, config))
                  chunks.push(chunk);
                if (rejects) {
                  assert.equal(chunks.length, 1);
                  assert.equal(chunks[0].ok, false);
                  error = chunks[0].error;
                } else {
                  assert.equal(chunks.map((chunk) => api.unwrap(chunk).content).join(''), text);
                }
              } else {
                const result = await effortGateway.generate(model, messages, config);
                if (rejects) {
                  assert.equal(result.ok, false);
                  error = result.error;
                } else assert.equal(api.unwrap(result).content, text);
              }
              if (rejects) {
                assert.ok(error instanceof api.ValidationError);
                assert.equal(error.code, 'VALIDATION_ERROR');
                assert.equal(error.field, 'reasoningEffort');
                assert.equal(
                  error.message,
                  providerRejects
                    ? `OpenAI does not support reasoningEffort "${testCase.config.reasoningEffort}" in 3.0.0`
                    : `Reasoning effort "${testCase.config.reasoningEffort}" is unsupported by profile ${selection.profile.name}; supported: ${selection.profile.supportedEfforts.join(', ')}`
                );
                assert.equal(records.length, start);
              } else {
                const wire = ollama
                  ? testCase.ollama
                  : provider === 'omlx'
                    ? testCase.omlx
                    : provider === 'openai-reasoning'
                      ? testCase.openai
                      : {};
                const expected = {
                  model,
                  messages,
                  ...wire,
                  ...(ollama ? { options: {}, stream: streaming } : {}),
                  ...(!ollama && streaming ? { stream: true } : {}),
                  ...(route === 'event stream' && !ollama
                    ? { stream_options: { include_usage: true } }
                    : {}),
                  ...(route === 'structured'
                    ? ollama
                      ? { format: schema }
                      : {
                          response_format: {
                            type: 'json_schema',
                            json_schema: { name: 'response', schema },
                          },
                        }
                    : {}),
                };
                assert.deepEqual(
                  records.slice(start).map((record) => JSON.parse(record.body)),
                  [expected]
                );
                assert.equal(records.at(-1).url, ollama ? '/api/chat' : '/v1/chat/completions');
              }
              assert.equal(replies.length, 0);
            }
          }
        }
      }
    }
    assert.deepEqual(api.QWEN3_8_REASONING_PROFILE, profileContract.selections[1].profile);
    assert.equal(api.validateReasoningProfile(api.QWEN3_8_REASONING_PROFILE).ok, true);
    console.log(
      `PASS ${profileContract.contract} with ${reasoningContract.contract}: 672 installed public-API HTTP cases`
    );
    console.log(
      JSON.stringify({ contract: 'ts-packaged-library-v1', requests: records, terminal }, null, 2)
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  if (process.argv[2] === '--consumer') return verify(resolve(process.argv[3]));
  const root = resolve(__dirname, '..');
  const consumer = mkdtempSync(join(tmpdir(), 'mojentic-package-'));
  run('npm', ['run', 'build'], root);
  const packed = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', consumer], root)
  )[0];
  assert.ok(packed.files.some(({ path }) => path === 'dist/index.js'));
  assert.ok(packed.files.some(({ path }) => path === 'dist/index.d.ts'));
  assert.deepEqual(
    packed.files.filter(({ path }) =>
      /(^|\/)(src|node_modules|\.foundry|__tests__)(\/|$)|\.(test|spec)\./.test(path)
    ),
    []
  );
  const artifact = join(consumer, packed.filename);
  console.log(
    JSON.stringify({
      artifact,
      sha256: createHash('sha256').update(readFileSync(artifact)).digest('hex'),
      integrity: packed.integrity,
      source: run('git', ['rev-parse', 'HEAD'], root).trim(),
      contract: 'ts-packaged-library-v1',
      profileContract: profileContract.contract,
      profileContractSha256: createHash('sha256')
        .update(
          readFileSync(join(root, 'src/llm/gateways/__fixtures__/reasoning-profiles-v1.json'))
        )
        .digest('hex'),
      historyContract: historyContract.contract,
      historyContractSha256: createHash('sha256')
        .update(readFileSync(join(root, 'src/llm/gateways/__fixtures__/reasoning-history-v1.json')))
        .digest('hex'),
      historyVerifierSha256: createHash('sha256')
        .update(readFileSync(join(root, 'scripts/reasoning-history-contract.cjs')))
        .digest('hex'),
      reasoningContract: reasoningContract.contract,
      reasoningContractSha256: createHash('sha256')
        .update(readFileSync(join(root, 'src/llm/gateways/__fixtures__/reasoning-effort-v1.json')))
        .digest('hex'),
      samplingContract: samplingContract.contract,
      samplingContractSha256: createHash('sha256')
        .update(readFileSync(join(root, 'src/llm/gateways/__fixtures__/openai-sampling-v1.json')))
        .digest('hex'),
      contractSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
    })
  );
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', artifact], consumer);
  writeFileSync(
    join(consumer, 'public-api.ts'),
    `
import { Message, type LlmMessage, OpenAIGateway, OMLXGateway, OllamaGateway, getModelContextWindow,
  effectiveContextWindow, QWEN3_8_REASONING_PROFILE, validateReasoningProfile, type ReasoningProfile, type CompletionConfig, type RecoveryOptions,
  type CompletionEvidence, type CompletionRecoveryCapabilities, type ReasoningEffort } from 'mojentic';
const nativeMessage: LlmMessage = Message.assistant('Visible', undefined, 'Native');
void nativeMessage;
const recovery: RecoveryOptions = { maxAttempts: 2, admit: async () => 'allow' };
const config: CompletionConfig = { retainReasoning: true, temperature: 0, maxTokens: 19, topP: 0, frequencyPenalty: 0, presencePenalty: 0, recovery };
const efforts: readonly ReasoningEffort[] = ['disabled', 'enabled', 'low', 'medium', 'high', 'xhigh'];
const profile: ReasoningProfile = QWEN3_8_REASONING_PROFILE;
const effortConfigs: CompletionConfig[] = efforts.map((reasoningEffort) => ({ reasoningEffort, reasoningProfile: profile }));
void validateReasoningProfile(profile, 'low', true);
const gateway = new OMLXGateway('http://127.0.0.1:1');
const capabilities: CompletionRecoveryCapabilities = gateway.recoveryCapabilities;
async function check(): Promise<number | null> {
  const result = await getModelContextWindow(gateway, 'qwen');
  return result.ok ? effectiveContextWindow(result.value, config) : null;
}
function evidence(value: CompletionEvidence): string | null { return value.providerModel; }
void [OpenAIGateway, OllamaGateway, capabilities, check, evidence, effortConfigs];
`
  );
  run(
    process.execPath,
    [
      join(root, 'node_modules/@typescript/native/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'node16',
      '--target',
      'es2022',
      join(consumer, 'public-api.ts'),
    ],
    consumer
  );
  run(process.execPath, [__filename, '--consumer', consumer], consumer);
  console.log(`PASS ts-packaged-library-v1 fresh consumer: ${consumer}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
