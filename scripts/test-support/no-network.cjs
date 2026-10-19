/** Loaded in Jest and every package-verification child process. */
const assert = require('node:assert/strict');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const guarded = [];
function deny(target, name) {
  target[name] = forbidden;
  guarded.push({ target, name });
}
function forbidden() {
  throw new Error('Network/service access is forbidden in conformance execution');
}
deny(net.Socket.prototype, 'connect');
deny(net.Server.prototype, 'listen');
deny(tls, 'connect');
// DNS uses c-ares and UDP can bypass net.Socket, so guard those boundaries too.
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(target)) {
    if (
      name.startsWith('resolve') ||
      name === 'reverse' ||
      name === 'lookup' ||
      name === 'lookupService'
    ) {
      deny(target, name);
    }
  }
}
deny(require('node:dgram'), 'createSocket');
// Verify every installed guard without constructing a socket, listener or DNS request.
function verifyInstalled() {
  for (const { target, name } of guarded) {
    assert.equal(target[name], forbidden, `Network guard replaced: ${name}`);
    assert.throws(() => Reflect.apply(target[name], target, []), {
      message: 'Network/service access is forbidden in conformance execution',
    });
  }
}
module.exports = { forbidden, verifyInstalled };
