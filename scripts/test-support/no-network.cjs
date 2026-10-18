/** Loaded in Jest and every package-verification child process. */
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
function forbidden() {
  throw new Error('Network/service access is forbidden in conformance execution');
}
net.Socket.prototype.connect = forbidden;
net.Server.prototype.listen = forbidden;
tls.connect = forbidden;
// DNS uses c-ares and UDP can bypass net.Socket, so guard those boundaries too.
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(target)) {
    if (
      name.startsWith('resolve') ||
      name === 'reverse' ||
      name === 'lookup' ||
      name === 'lookupService'
    ) {
      target[name] = forbidden;
    }
  }
}
require('node:dgram').createSocket = forbidden;
module.exports = { forbidden };
