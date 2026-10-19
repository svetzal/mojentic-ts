/** Executable ts-in-process-boundary-v1; source and installed public API verification. */
const assert = require('node:assert/strict');
const { verifyInstalled } = require('./test-support/no-network.cjs');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { createEndpoint } = require('./test-support/transport.cjs');

function contractIdentity() {
  return {
    contract: 'ts-in-process-boundary-v1',
    verifierSha256: createHash('sha256').update(readFileSync(__filename)).digest('hex'),
  };
}

async function verify(api) {
  verifyInstalled();
  const records = [];
  const endpoint = createEndpoint(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    records.push({
      method: request.method,
      destination: `http://${request.headers.host}${request.url}`,
      path: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString(),
    });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      '{"model":"model","done":true,"message":{"role":"assistant","content":"configured reply"}}'
    );
  });
  await new Promise((resolve) => endpoint.activate(0, '127.0.0.1', resolve));
  const host = `http://127.0.0.1:${endpoint.address().port}`;
  const messages = [api.Message.user('destination contract')];
  try {
    const rejected = await new api.OllamaGateway('https://unexpected.example').generate(
      'model',
      messages
    );
    assert.equal(rejected.ok, false);
    assert.equal(rejected.error.code, 'GATEWAY_ERROR');
    assert.equal(
      rejected.error.message,
      'Failed to generate completion: Unexpected transport destination: https://unexpected.example/api/chat'
    );
    assert.deepEqual(
      records,
      [],
      'unconfigured destination must fail before a transport handler runs'
    );

    const accepted = await new api.OllamaGateway(host).generate('model', messages);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.value.content, 'configured reply');
    assert.deepEqual(records, [
      {
        method: 'POST',
        destination: `${host}/api/chat`,
        path: '/api/chat',
        headers: { 'content-type': 'application/json', host: new URL(host).host },
        body: JSON.stringify({ model: 'model', messages, options: {}, stream: false }),
      },
    ]);
  } finally {
    await new Promise((resolve) => endpoint.close(resolve));
  }
}
module.exports = { contractIdentity, verify };
