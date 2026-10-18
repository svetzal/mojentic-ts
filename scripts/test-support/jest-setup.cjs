require('./no-network.cjs');
const { setImmediate: yieldTurn } = require('node:timers');
const boundary = require('./transport.cjs');
const { CompletionTransportGateway } = require('../../src/llm/recovery-transport');
boundary.install(CompletionTransportGateway);

// Drive pending virtual timers only after the current microtask/stream work drains.
// No real timer, polling delay, or elapsed wall time participates in a test decision.
function withVirtualTime(callback) {
  if (!callback) return callback;
  return async function (...args) {
    let settled = false;
    const result = Promise.resolve().then(() => callback.apply(this, args));
    result.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    while (!settled) {
      await new Promise(yieldTurn);
      if (!settled && jest.getTimerCount() > 0) await jest.advanceTimersToNextTimerAsync();
    }
    return result;
  };
}
function timedRegistration(register) {
  const timed = (name, callback, timeout) => register(name, withVirtualTime(callback), timeout);
  timed.each = (...table) => {
    const cases = register.each(...table);
    return (name, callback, timeout) => cases(name, withVirtualTime(callback), timeout);
  };
  return timed;
}
for (const name of ['test', 'it']) {
  const original = globalThis[name];
  const timed = timedRegistration(original);
  timed.only = timedRegistration(original.only);
  timed.skip = original.skip;
  timed.todo = original.todo;
  timed.concurrent = timedRegistration(original.concurrent);
  globalThis[name] = timed;
}
for (const name of ['beforeEach', 'afterEach', 'beforeAll', 'afterAll']) {
  const register = globalThis[name];
  globalThis[name] = (callback, timeout) => register(withVirtualTime(callback), timeout);
}
beforeEach(() => {
  jest.useFakeTimers({ now: Date.UTC(2026, 0, 1), doNotFake: ['nextTick', 'setImmediate'] });
});
