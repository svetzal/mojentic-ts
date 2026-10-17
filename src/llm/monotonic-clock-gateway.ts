/** Monotonic process clock for elapsed client timings, independent of wall-clock changes. */
export class MonotonicClockGateway {
  /** Return monotonic milliseconds. */
  now(): number {
    return performance.now();
  }
}
