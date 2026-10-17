/** Installed-artifact contract ts-packaged-library-v1. No source/internal imports. */
const assert = require('node:assert/strict');
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

    // Characterize remaining default; metadata queries cannot mutate the next request.
    replies = [{ body: answer }];
    await gateway.generate('qwen', messages);
    const baseline = records.at(-1).body;
    assert.deepEqual(JSON.parse(baseline), { model: 'qwen', messages, temperature: 1 });
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
      contractSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
    })
  );
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', artifact], consumer);
  writeFileSync(
    join(consumer, 'public-api.ts'),
    `
import { OpenAIGateway, OMLXGateway, OllamaGateway, getModelContextWindow,
  effectiveContextWindow, type CompletionConfig, type RecoveryOptions,
  type CompletionEvidence, type CompletionRecoveryCapabilities } from 'mojentic';
const recovery: RecoveryOptions = { maxAttempts: 2, admit: async () => 'allow' };
const config: CompletionConfig = { temperature: 0, maxTokens: 19, recovery };
const gateway = new OMLXGateway('http://127.0.0.1:1');
const capabilities: CompletionRecoveryCapabilities = gateway.recoveryCapabilities;
async function check(): Promise<number | null> {
  const result = await getModelContextWindow(gateway, 'qwen');
  return result.ok ? effectiveContextWindow(result.value, config) : null;
}
function evidence(value: CompletionEvidence): string | null { return value.providerModel; }
void [OpenAIGateway, OllamaGateway, capabilities, check, evidence];
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
