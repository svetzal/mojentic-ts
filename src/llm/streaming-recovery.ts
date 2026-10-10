/** Streaming execution shares the completion engine's retry and admission policy. */
import { Err, Result } from '../error';
import { GatewayResponse, StreamChunk } from './models';
import {
  inspectRecoveryFailure,
  recoverCompletion,
  RecoveryAttemptState,
  RecoveryError,
  RecoveryOptions,
  RecoveryProvider,
  RecoveryWireEvent,
} from './recovery';
import { CompletionTransportGateway } from './recovery-transport';
import { LlmStreamEvent, StreamEventError } from './stream-events';
import { LineParser } from './gateways/stream-event-transport';
import {
  add,
  eventStreamParser,
  NO_EVIDENCE,
  Parser,
  safeEvidence,
  StreamingProgressObserver,
  streamParser,
  zero,
} from './streaming-recovery-protocol';
const transport = new CompletionTransportGateway();
async function cancellable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
interface Pending<T> {
  readonly value: T;
  readonly resume: () => void;
  readonly commit?: () => void;
  readonly terminal?: boolean;
  readonly failure?: boolean;
}

/** One encoded request, one engine, and backpressure at each delivery. Abort owns the socket. */
async function* recoverStream<T>(
  provider: RecoveryProvider,
  url: string,
  headers: Headers | Record<string, string>,
  payload: object,
  options: RecoveryOptions,
  parser: () => Parser<T>,
  failure: (error: Error, sensitive: (value: string) => boolean) => T
): AsyncGenerator<T> {
  const controller = new AbortController();
  const abort = (): void => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const signal = controller.signal;
  const queue: Pending<T>[] = [];
  let wake: (() => void) | undefined;
  let finished = false;
  let terminal: T | undefined;
  let sensitive: (value: string) => boolean = () => true;
  const deliver = async (value: T, commit?: () => void, terminal = false): Promise<void> => {
    await cancellable(
      new Promise<void>((resolve) => {
        queue.push({ value, resume: resolve, commit, terminal });
        wake?.();
      }),
      signal
    );
  };
  const execute = async (
    state: RecoveryAttemptState,
    body: string,
    frozenHeaders: Headers,
    attemptSignal: AbortSignal,
    policy: RecoveryOptions,
    isSensitive: (value: string) => boolean
  ): Promise<GatewayResponse | undefined> => {
    sensitive = isSensitive;
    const decode = parser();
    let frameIndex = 0;
    let captureIndex = 0;
    const chunks: Uint8Array[] = [];
    const observer = new StreamingProgressObserver(provider);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const capture = async (event: RecoveryWireEvent): Promise<void> => {
      try {
        if (policy.onWire)
          await cancellable(
            Promise.resolve().then(() => policy.onWire?.(event)),
            attemptSignal
          );
      } catch (cause) {
        state.captureCause = cause;
        state.reason = 'capture_failed';
        throw cause;
      }
    };
    try {
      state.response = await transport.send(url, frozenHeaders, body, attemptSignal);
      state.phase = 'streaming';
      state.category = state.response.ok ? 'transport' : 'http';
      state.progress = Object.freeze({ ...state.progress, headersReceived: true });
      reader = state.response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let buffer = '';
      for (;;) {
        if (state.response.ok) state.category = 'transport';
        state.phase = 'streaming';
        const { done, value } = await reader.read();
        if (value) {
          chunks.push(value);
          state.progress = Object.freeze({
            ...state.progress,
            rawBytes: state.progress.rawBytes + value.length,
            observed: state.response.ok ? observer.observe(value) : zero(),
          });
        }
        await capture({
          ...state.identity,
          direction: 'response',
          bytes: value?.slice() ?? new Uint8Array(),
          headers: new Headers(state.response.headers),
          status: state.response.status,
          complete: done,
          frameIndex: ++captureIndex,
        });
        if (!state.response.ok) {
          if (done) return undefined;
          else continue;
        }
        state.category = 'protocol';
        state.phase = 'decoding';
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = done ? '' : (lines.pop() ?? '');
        for (const line of lines) {
          if (attemptSignal.aborted) throw attemptSignal.reason;
          const frame = decode.parse(line);
          state.responseEvidence = frame.evidence;
          if (frame.completedToolCalls !== undefined) {
            state.progress = Object.freeze({
              ...state.progress,
              observed: Object.freeze({
                ...state.progress.observed,
                completedToolCalls: frame.completedToolCalls,
              }),
            });
          }
          if (frame.valid) {
            frameIndex++;
            if (provider === 'ollama') {
              policy.onEvent?.(
                Object.freeze({
                  ...state.identity,
                  type: 'progress',
                  progress: state.progress,
                  frameIndex,
                })
              );
              if (attemptSignal.aborted) throw attemptSignal.reason;
              if (frame.done)
                policy.onEvent?.(
                  Object.freeze({
                    ...state.identity,
                    type: 'metrics',
                    progress: state.progress,
                    frameIndex,
                    metrics: frame.metrics,
                  })
                );
            }
          }
          if (attemptSignal.aborted) throw attemptSignal.reason;
          for (const delivery of frame.deliveries) {
            await deliver(delivery.value, () => {
              state.progress = Object.freeze({
                ...state.progress,
                delivered: add(state.progress.delivered, delivery.semantic),
              });
            });
          }
          if (frame.error) {
            state.category =
              frame.error.reason === 'provider_error' ? 'provider_response' : 'protocol';
            throw frame.error;
          }
          if (frame.terminal !== undefined) {
            terminal = frame.terminal;
            await deliver(
              terminal,
              () => {
                state.progress = Object.freeze({
                  ...state.progress,
                  delivered: Object.freeze({
                    ...state.progress.delivered,
                    completedToolCalls: frame.completedToolCalls ?? 0,
                  }),
                });
              },
              true
            );
            return { content: '' };
          }
        }
        if (done) {
          state.category = 'transport';
          throw new StreamEventError('incomplete_stream', 'Stream ended before completion');
        }
      }
    } catch (cause) {
      if (cause instanceof StreamEventError) {
        state.category =
          cause.reason === 'provider_error'
            ? 'provider_response'
            : cause.reason === 'incomplete_stream'
              ? 'transport'
              : 'protocol';
      }
      state.cause = cause;
      if (state.reason !== 'capture_failed' && !attemptSignal.aborted) {
        try {
          await capture({
            ...state.identity,
            direction: 'response',
            bytes: new Uint8Array(),
            headers: new Headers(state.response?.headers),
            status: state.response?.status,
            complete: false,
            frameIndex: ++captureIndex,
          });
        } catch (captureCause) {
          state.captureCause = captureCause;
        }
      }
      return undefined;
    } finally {
      state.bytes = Buffer.concat(chunks);
      // Cancellation runs even when the consumer is paused at a yield.
      try {
        await reader?.cancel();
      } catch {
        /* The transport may already be closed. */
      }
      reader?.releaseLock();
    }
  };
  const task = recoverCompletion(
    provider,
    url,
    headers,
    payload,
    { ...options, signal },
    () => ({ content: '' }),
    false,
    { execute }
  )
    .then((result) => {
      if (!result.ok)
        queue.push({
          value: failure(result.error, sensitive),
          resume: () => undefined,
          failure: true,
        });
    })
    .catch((cause: unknown) => {
      queue.push({
        value: failure(
          cause instanceof Error ? cause : new Error('Streaming recovery failed'),
          sensitive
        ),
        resume: () => undefined,
        failure: true,
      });
    })
    .finally(() => {
      finished = true;
      wake?.();
    });
  try {
    while (!finished || queue.length > 0) {
      if (queue.length === 0)
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      const item = queue.shift();
      if (item) {
        if (item.terminal) {
          item.resume();
          await task;
          if (!signal.aborted && queue.length === 0) {
            item.commit?.();
            yield item.value;
          }
        } else if (signal.aborted && !item.failure) {
          item.resume();
          await task;
        } else {
          item.commit?.();
          try {
            yield item.value;
          } finally {
            item.resume();
          }
        }
      }
    }
  } finally {
    controller.abort();
    options.signal?.removeEventListener('abort', abort);
    await task;
  }
}

/** Single-turn streaming retains the event parser's terminal evidence and forbids tools. */
export async function* recoverStreamEvents(
  provider: RecoveryProvider,
  url: string,
  headers: Headers | Record<string, string>,
  payload: object,
  options: RecoveryOptions,
  parseLine: LineParser
): AsyncGenerator<LlmStreamEvent> {
  yield* recoverStream<LlmStreamEvent>(
    provider,
    url,
    headers,
    payload,
    options,
    () => eventStreamParser(provider, parseLine),
    (error, sensitive) => ({
      type: 'error',
      error: new StreamEventError(
        error instanceof RecoveryError && error.outcome === 'cancelled'
          ? 'cancelled'
          : error instanceof RecoveryError && error.outcome === 'interrupted'
            ? 'interrupted_stream'
            : 'request_failed',
        'Streaming completion recovery failed',
        {
          evidence: safeEvidence(
            error instanceof RecoveryError
              ? (inspectRecoveryFailure(error.failure)?.responseEvidence ?? NO_EVIDENCE)
              : NO_EVIDENCE,
            sensitive
          ),
          detail: error,
          recovery: error instanceof RecoveryError ? error : undefined,
        }
      ),
    })
  );
}
/** Opted-in legacy chunks expose reasoning and fragments without executing partial calls. */
export async function* recoverStreamChunks(
  provider: RecoveryProvider,
  url: string,
  headers: Headers | Record<string, string>,
  payload: object,
  options: RecoveryOptions,
  parseLine: LineParser
): AsyncGenerator<Result<StreamChunk, Error>> {
  yield* recoverStream(
    provider,
    url,
    headers,
    payload,
    options,
    () => streamParser(provider, parseLine),
    (error) => Err(error)
  );
}
