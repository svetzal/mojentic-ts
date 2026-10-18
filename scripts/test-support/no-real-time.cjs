/** Installed-consumer verification must provide its own clock and sleeper. */
function forbidden() {
  throw new Error('Real timers are forbidden in package conformance');
}
globalThis.setTimeout = forbidden;
globalThis.setInterval = forbidden;
require('node:timers').setTimeout = forbidden;
require('node:timers').setInterval = forbidden;
const timers = require('node:timers/promises');
timers.setTimeout = forbidden;
timers.setInterval = forbidden;
timers.scheduler.wait = forbidden;
Date.now = () => Date.UTC(2026, 0, 1);
