/** In-process HTTP boundary double. No sockets, DNS, redirects or automatic retries. */
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const endpoints = new Map();
let nextPort = 10000;

function createEndpoint(handler = () => {}) {
  const endpoint = {
    activate(_port, _host, ready) {
      this.port = nextPort++;
      endpoints.set(`http://127.0.0.1:${this.port}`, handler);
      ready();
    },
    address() {
      return { port: this.port };
    },
    closeAllConnections() {},
    close(done) {
      endpoints.delete(`http://127.0.0.1:${this.port}`);
      done();
    },
  };
  return endpoint;
}

async function dispatch(url, options = {}) {
  const destination = new URL(url);
  const handler = endpoints.get(destination.origin);
  if (!handler) throw new TypeError(`Unexpected transport destination: ${url}`);
  const signal = options.signal;
  if (signal?.aborted) throw signal.reason;
  const request = Readable.from(options.body ? [Buffer.from(options.body)] : []);
  request.url = destination.pathname + destination.search;
  request.method = options.method || 'GET';
  request.headers = Object.fromEntries(new Headers(options.headers));
  request.headers.host = destination.host;
  return new Promise((resolve, reject) => {
    let controller;
    let opened = false;
    let ended = false;
    const headers = new Headers();
    const response = new EventEmitter();
    response.statusCode = 200;
    const body = new ReadableStream({
      start(value) {
        controller = value;
      },
      cancel() {
        ended = true;
        response.emit('close');
      },
    });
    function open() {
      if (opened) return;
      opened = true;
      resolve({
        status: response.statusCode,
        ok: response.statusCode >= 200 && response.statusCode < 300,
        headers,
        body,
        text: () => new Response(body).text(),
        json: () => new Response(body).json(),
      });
    }
    response.setHeader = (name, value) => {
      headers.set(name, String(value));
      return response;
    };
    response.writeHead = (status, values = {}) => {
      response.statusCode = status;
      for (const [name, value] of Object.entries(values)) headers.set(name, String(value));
      return response;
    };
    response.flushHeaders = open;
    response.write = (chunk) => {
      open();
      if (!ended) controller.enqueue(Buffer.from(chunk));
      return true;
    };
    response.end = (chunk) => {
      if (chunk !== undefined) response.write(chunk);
      open();
      if (!ended) {
        ended = true;
        controller.close();
        response.emit('close');
      }
    };
    response.destroy = () => {
      const error = Object.assign(new Error('Transport interrupted'), { code: 'ECONNRESET' });
      if (!opened) reject(error);
      if (!ended) {
        ended = true;
        controller.error(error);
        response.emit('close');
      }
    };
    request.socket = { destroy: response.destroy };
    signal?.addEventListener(
      'abort',
      () => {
        if (!opened) reject(signal.reason);
        if (!ended) {
          ended = true;
          controller.error(signal.reason);
          response.emit('close');
        }
      },
      { once: true }
    );
    Promise.resolve()
      .then(() => handler(request, response))
      .catch(reject);
  });
}
function install(Transport) {
  globalThis.fetch = dispatch;
  Transport.prototype.send = function (url, headers, body, signal) {
    return dispatch(url, { method: 'POST', headers, body, signal });
  };
}
module.exports = { createEndpoint, dispatch, install };
