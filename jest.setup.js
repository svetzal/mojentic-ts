// Jest setup file to polyfill Web Crypto API for Node.js
// This is needed because the tracer events use crypto.randomUUID()
// which is available globally in browsers but needs the crypto module in Node.js

const { webcrypto } = require('crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}
