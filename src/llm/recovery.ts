/** Opt-in recovery of a single non-streaming HTTP completion. */
import { randomUUID } from 'node:crypto';
import { Err, Ok, Result, MojenticError } from '../error';
import { GatewayResponse } from './models';
import { observeCompletionPrefix } from './recovery-progress';

export type RecoveryProvider = 'ollama' | 'omlx' | 'openai';
export type RecoveryCategory =
  'transport' | 'http' | 'provider_response' | 'protocol' | 'cancellation' | 'client_timeout';
export type RecoveryReason =
  | 'transient'
  | 'permanent'
  | 'malformed'
  | 'semantic_output'
  | 'partial_response'
  | 'cancelled'
  | 'capture_failed';
export type RecoveryOutcome =
  | 'exhausted'
  | 'interrupted'
  | 'cancelled'
  | 'admission_required'
  | 'admission_rejected'
  | 'deadline'
  | 'delay_ceiling';
export interface RecoveryIdentity {
  readonly logicalRequestId: string;
  readonly attemptId: string;
  readonly wireAttempt: number;
}
export interface SemanticProgress {
  readonly reasoningBytes: number;
  readonly contentBytes: number;
  readonly toolFragments: number;
  readonly completedToolCalls: number;
}
export interface RecoveryProgress {
  readonly headersReceived: boolean;
  readonly rawBytes: number;
  readonly observed: SemanticProgress;
  readonly delivered: SemanticProgress;
}
export type RetryAfter =
  | { readonly kind: 'absent' | 'invalid' }
  | { readonly kind: 'seconds'; readonly delayMs: number }
  | { readonly kind: 'date'; readonly unixMs: number; readonly delayMs: number };
export interface RecoveryFailure extends RecoveryIdentity {
  readonly provider: RecoveryProvider;
  readonly operation: 'ordinary' | 'structured';
  readonly category: RecoveryCategory;
  readonly httpStatus?: number;
  readonly providerCode?: string;
  readonly providerRequestId?: string;
  readonly retryAfter: RetryAfter;
  readonly phase?: 'connecting' | 'sending' | 'awaiting_headers' | 'streaming' | 'decoding';
  readonly acceptance: 'yes' | 'no' | 'unknown';
  readonly remoteTerminationConfirmed: false;
  readonly progress: RecoveryProgress;
  readonly classification: { readonly eligible: boolean; readonly reason: RecoveryReason };
}
export type RecoveryTransition =
  | 'attempt_started'
  | 'attempt_succeeded'
  | 'attempt_failed'
  | 'admission_pending'
  | 'admission_allowed'
  | 'admission_rejected'
  | 'admission_required'
  | 'delay_scheduled'
  | 'retry_started'
  | 'exhausted'
  | 'interrupted'
  | 'cancelled';
export interface RecoveryEvent extends RecoveryIdentity {
  readonly type: RecoveryTransition;
  readonly progress: RecoveryProgress;
  readonly phase?: RecoveryFailure['phase'];
  readonly failure?: RecoveryFailure;
  readonly delayMs?: number;
}
export interface RecoveryAdmission {
  readonly failure: RecoveryFailure;
  readonly nextAttempt: number;
  readonly signal: AbortSignal;
}
/** Sensitive bytes and headers are available only to an explicitly configured hook. */
export interface RecoveryWireEvent extends RecoveryIdentity {
  readonly direction: 'request' | 'response';
  readonly bytes: Uint8Array;
  readonly headers: Headers;
  readonly status?: number;
  readonly complete: boolean;
}
export interface RecoveryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly delayCeilingMs?: number;
  readonly retryableCategories?: readonly RecoveryCategory[];
  readonly retryableStatuses?: readonly number[];
  /** Measured from the first failure; never a timeout for active generation. */
  readonly budgetMs?: number;
  /** Absolute wall-clock deadline; applies only to recovery admission and resend. */
  readonly deadlineMs?: number;
  readonly signal?: AbortSignal;
  readonly admit?: (context: RecoveryAdmission) => Promise<'allow' | 'reject'>;
  readonly onEvent?: (event: RecoveryEvent) => void;
  readonly onWire?: (event: RecoveryWireEvent) => void | Promise<void>;
  readonly jitter?: () => number;
  readonly wallClock?: () => number;
  readonly monotonicClock?: () => number;
  readonly sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
}
export interface RecoveryEvidence {
  readonly cause: unknown;
  readonly captureCause?: unknown;
  readonly admissionCause?: unknown;
  readonly delayCause?: unknown;
  readonly bytes: Uint8Array;
  readonly headers?: Headers;
}
const evidence = new WeakMap<RecoveryFailure, RecoveryEvidence>();
/** Explicit sensitive inspection; copies prevent mutation of retained bytes and headers. */
export function inspectRecoveryFailure(failure: RecoveryFailure): RecoveryEvidence | undefined {
  const original = evidence.get(failure);
  return (
    original && {
      cause: original.cause,
      captureCause: original.captureCause,
      admissionCause: original.admissionCause,
      delayCause: original.delayCause,
      bytes: original.bytes.slice(),
      headers: original.headers && new Headers(original.headers),
    }
  );
}
export class RecoveryError extends MojenticError {
  readonly name = 'RecoveryError';
  constructor(
    readonly outcome: RecoveryOutcome,
    readonly failure: RecoveryFailure,
    readonly history: readonly RecoveryFailure[]
  ) {
    super(
      `Completion recovery: ${outcome} (${failure.category}/${failure.classification.reason})`,
      'RECOVERY_ERROR'
    );
    Object.setPrototypeOf(this, RecoveryError.prototype);
    Object.freeze(history);
  }
  /** Safe serialization deliberately excludes raw evidence. */
  toJSON(): object {
    return { name: this.name, outcome: this.outcome, failure: this.failure, history: this.history };
  }
}
/** Client HTTP abort is available; remote per-request termination/status remain unsupported. */
export const completionRecoveryCapabilities = Object.freeze({
  clientAbort: 'supported',
  requestCancellation: 'unsupported',
  requestStatus: 'unsupported',
  idempotency: 'unknown',
  remoteTerminationEvidence: 'none',
  streamingRecovery: 'pending',
} as const);

const emptySemantic = (): SemanticProgress =>
  Object.freeze({ reasoningBytes: 0, contentBytes: 0, toolFragments: 0, completedToolCalls: 0 });
const emptyProgress = (): RecoveryProgress =>
  Object.freeze({
    headersReceived: false,
    rawBytes: 0,
    observed: emptySemantic(),
    delivered: emptySemantic(),
  });
function parseRetryAfter(value: string | null, now: number): RetryAfter {
  if (value === null) return { kind: 'absent' };
  if (/^\d+$/.test(value.trim())) {
    const delayMs = Number(value) * 1000;
    return Number.isSafeInteger(delayMs) ? { kind: 'seconds', delayMs } : { kind: 'invalid' };
  }
  // HTTP dates must have the RFC 1123 shape; Date.parse alone accepts non-HTTP strings.
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value))
    return { kind: 'invalid' };
  const unixMs = Date.parse(value);
  return Number.isFinite(unixMs)
    ? { kind: 'date', unixMs, delayMs: Math.max(0, unixMs - now) }
    : { kind: 'invalid' };
}
function safeRequestId(headers: Headers): string | undefined {
  const value = headers.get('x-request-id');
  return value &&
    /^(req_)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
}
function safeProviderCode(bytes: Uint8Array): string | undefined {
  try {
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof data !== 'object' || data === null || !('error' in data)) return undefined;
    const error = data.error;
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      typeof error.code !== 'string'
    )
      return undefined;
    return [
      'rate_limit_exceeded',
      'server_error',
      'invalid_request_error',
      'invalid_api_key',
      'model_not_found',
      'insufficient_quota',
      'overloaded_error',
    ].includes(error.code)
      ? error.code
      : undefined;
  } catch {
    return undefined;
  }
}

class RecoveryDeadline extends Error {}

/** Cancellable wait with cleanup, including hooks that never resolve. */
async function wait<T>(task: Promise<T>, signal: AbortSignal, limitMs?: number): Promise<T> {
  if (signal.aborted) throw signal.reason;
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => finish(() => reject(signal.reason));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (action: () => void): void => {
      signal.removeEventListener('abort', abort);
      clearTimeout(timer);
      action();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (limitMs !== undefined)
      timer = setTimeout(
        () => finish(() => reject(new RecoveryDeadline('Recovery deadline'))),
        Math.min(limitMs, 2147483647)
      );
    task.then(
      (value) => finish(() => resolve(value)),
      (cause: unknown) => finish(() => reject(cause))
    );
  });
}
async function sleep(delayMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const abort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
  });
}

interface AttemptState {
  identity: RecoveryIdentity;
  progress: RecoveryProgress;
  response?: Response;
  bytes: Uint8Array;
  category: RecoveryCategory;
  reason?: RecoveryReason;
  cause?: unknown;
  captureCause?: unknown;
  phase?: RecoveryFailure['phase'];
}
function classify(state: AttemptState, policy: RecoveryOptions): RecoveryFailure['classification'] {
  if (state.category === 'cancellation') return { eligible: false, reason: 'cancelled' };
  const status = state.response?.status;
  if (status === 400 || status === 401 || status === 403)
    return { eligible: false, reason: 'permanent' };
  if (state.reason === 'capture_failed') return { eligible: false, reason: 'capture_failed' };
  if (Object.values(state.progress.observed).some((value) => value > 0))
    return { eligible: false, reason: 'semantic_output' };
  if (state.category === 'protocol') return { eligible: false, reason: 'malformed' };
  if (state.response?.ok && state.progress.rawBytes > 0)
    return { eligible: false, reason: 'partial_response' };
  const categories = policy.retryableCategories ?? ['transport', 'http'];
  const eligible =
    categories.includes(state.category) &&
    (state.category === 'http'
      ? (policy.retryableStatuses ?? [429, 500, 502, 503, 504]).includes(status ?? 0)
      : state.category === 'transport' || state.category === 'client_timeout');
  return { eligible, reason: eligible ? 'transient' : 'permanent' };
}
function failureOf(
  state: AttemptState,
  provider: RecoveryProvider,
  operation: RecoveryFailure['operation'],
  policy: RecoveryOptions,
  sensitive?: (value: string) => boolean
): RecoveryFailure {
  const headers = state.response?.headers;
  const code = safeProviderCode(state.bytes);
  const requestId = headers && safeRequestId(headers);
  const failure: RecoveryFailure = Object.freeze({
    ...state.identity,
    provider,
    operation,
    category: state.category,
    httpStatus: state.response?.status,
    providerCode: code && !sensitive?.(code) ? code : undefined,
    providerRequestId: requestId && !sensitive?.(requestId) ? requestId : undefined,
    retryAfter: Object.freeze(
      parseRetryAfter(headers?.get('retry-after') ?? null, (policy.wallClock ?? Date.now)())
    ),
    phase: state.phase,
    acceptance: state.response?.ok ? 'yes' : 'unknown',
    remoteTerminationConfirmed: false,
    progress: state.progress,
    classification: Object.freeze(classify(state, policy)),
  });
  evidence.set(failure, {
    cause: state.cause,
    captureCause: state.captureCause,
    bytes: state.bytes.slice(),
    headers: headers && new Headers(headers),
  });
  return failure;
}

async function capture(
  policy: RecoveryOptions,
  event: RecoveryWireEvent,
  signal: AbortSignal
): Promise<void> {
  if (policy.onWire)
    await wait(
      Promise.resolve().then(() => policy.onWire?.(event)),
      signal
    );
}
async function execute(
  state: AttemptState,
  url: string,
  headers: Headers | Record<string, string>,
  body: string,
  policy: RecoveryOptions,
  signal: AbortSignal,
  decode: (json: unknown, headers: Headers) => GatewayResponse,
  structured: boolean
): Promise<GatewayResponse | undefined> {
  try {
    // fetch cannot distinguish connecting, sending, and awaiting headers.
    state.phase = undefined;
    state.response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal,
    });
    state.phase = 'streaming';
    state.progress = Object.freeze({ ...state.progress, headersReceived: true });
    state.category = state.response.ok ? 'transport' : 'http';
    const chunks: Uint8Array[] = [];
    try {
      const reader = state.response.body?.getReader();
      if (reader) {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            state.bytes = Buffer.concat(chunks);
            state.progress = Object.freeze({
              ...state.progress,
              rawBytes: state.bytes.length,
              observed: observeCompletionPrefix(state.bytes),
            });
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (cause) {
      state.cause = cause;
    }
    const bodyFailed = state.cause !== undefined;
    // Evidence is accounted for even when capture rejects or cancels.
    try {
      await capture(
        policy,
        {
          ...state.identity,
          direction: 'response',
          bytes: state.bytes.slice(),
          headers: new Headers(state.response.headers),
          status: state.response.status,
          complete: !bodyFailed,
        },
        signal
      );
    } catch (cause) {
      state.captureCause = cause;
      state.cause ??= cause;
      state.reason = 'capture_failed';
      return undefined;
    }
    if (bodyFailed || !state.response.ok) return undefined;
    state.phase = 'decoding';
    state.category = 'protocol';
    const json: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(state.bytes));
    if (typeof json === 'object' && json !== null && 'error' in json) {
      state.category = 'provider_response';
      return undefined;
    }
    const result = decode(json, state.response.headers);
    if (structured && (result.toolCalls?.length ?? 0) === 0) JSON.parse(result.content);
    return result;
  } catch (cause) {
    state.cause = cause;
    if (!state.response) {
      try {
        await capture(
          policy,
          {
            ...state.identity,
            direction: 'response',
            bytes: state.bytes.slice(),
            headers: new Headers(),
            complete: false,
          },
          signal
        );
      } catch (captureCause) {
        state.captureCause = captureCause;
        state.reason = 'capture_failed';
      }
    }
    return undefined;
  }
}
function validate(policy: RecoveryOptions): void {
  if (!Number.isSafeInteger(policy.maxAttempts ?? 1) || (policy.maxAttempts ?? 1) < 1)
    throw new RangeError('maxAttempts must be a positive safe integer');
  for (const value of [policy.baseDelayMs, policy.delayCeilingMs, policy.budgetMs]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 2147483647))
      throw new RangeError('Recovery durations must be bounded nonnegative milliseconds');
  }
  if (policy.deadlineMs !== undefined && !Number.isFinite(policy.deadlineMs))
    throw new RangeError('Recovery deadline must be finite');
}

/** Encodes once, sends no redirects, retries only this completion, and never executes tools. */
export async function recoverCompletion(
  provider: RecoveryProvider,
  url: string,
  headers: Headers | Record<string, string>,
  payload: object,
  options: RecoveryOptions,
  decode: (json: unknown, headers: Headers) => GatewayResponse,
  structured: boolean
): Promise<Result<GatewayResponse, Error>> {
  const policy: RecoveryOptions = Object.freeze({
    ...options,
    retryableCategories:
      options.retryableCategories && Object.freeze([...options.retryableCategories]),
    retryableStatuses: options.retryableStatuses && Object.freeze([...options.retryableStatuses]),
  });
  validate(policy);
  const body = JSON.stringify(payload);
  const frozenHeaders = new Headers(headers);
  const sensitive = (value: string): boolean =>
    body.includes(value) ||
    Array.from(frozenHeaders.values()).some((header) => header.includes(value));
  const logicalRequestId = randomUUID();
  const signal = policy.signal ?? new AbortController().signal;
  const monotonic = policy.monotonicClock ?? (() => performance.now());
  const wall = policy.wallClock ?? Date.now;
  const history: RecoveryFailure[] = [];
  let firstFailure: number | undefined;
  let state: AttemptState = {
    identity: { logicalRequestId, attemptId: randomUUID(), wireAttempt: 0 },
    progress: emptyProgress(),
    bytes: new Uint8Array(),
    category: 'transport',
  };
  const remaining = (): number | undefined => {
    const limits = [
      policy.deadlineMs === undefined ? Infinity : policy.deadlineMs - wall(),
      policy.budgetMs === undefined || firstFailure === undefined
        ? Infinity
        : policy.budgetMs - (monotonic() - firstFailure),
    ];
    const minimum = Math.min(...limits);
    return minimum === Infinity ? undefined : minimum;
  };
  const emit = (type: RecoveryTransition, failure?: RecoveryFailure, delayMs?: number): void => {
    policy.onEvent?.(
      Object.freeze({
        ...state.identity,
        type,
        progress: state.progress,
        phase: state.phase,
        failure,
        delayMs,
      })
    );
  };
  const finish = (
    outcome: RecoveryOutcome,
    failure: RecoveryFailure
  ): Result<GatewayResponse, Error> => {
    emit(
      outcome === 'cancelled'
        ? 'cancelled'
        : outcome === 'interrupted'
          ? 'interrupted'
          : 'exhausted',
      failure
    );
    return Err(new RecoveryError(outcome, failure, [...history]));
  };
  const cancelled = (): Result<GatewayResponse, Error> => {
    const cancellation = failureOf(
      { ...state, category: 'cancellation', reason: undefined, cause: signal.reason },
      provider,
      structured ? 'structured' : 'ordinary',
      policy,
      sensitive
    );
    return finish('cancelled', cancellation);
  };
  for (let number = 1; number <= (policy.maxAttempts ?? 1); number++) {
    if (signal.aborted) return cancelled();
    state = {
      identity: { logicalRequestId, attemptId: randomUUID(), wireAttempt: number - 1 },
      progress: emptyProgress(),
      bytes: new Uint8Array(),
      category: 'transport',
    };
    try {
      await capture(
        policy,
        {
          ...state.identity,
          wireAttempt: number,
          direction: 'request',
          bytes: new TextEncoder().encode(body),
          headers: new Headers(frozenHeaders),
          complete: true,
        },
        signal
      );
    } catch (cause) {
      if (signal.aborted) return cancelled();
      state.cause = cause;
      state.category = 'protocol';
      state.reason = 'capture_failed';
      return finish(
        'interrupted',
        failureOf(state, provider, structured ? 'structured' : 'ordinary', policy, sensitive)
      );
    }
    if (signal.aborted) return cancelled();
    if (number > 1 && (remaining() ?? Infinity) <= 0)
      return finish('deadline', history[history.length - 1]);
    state.identity = Object.freeze({ ...state.identity, wireAttempt: number });
    emit('attempt_started');
    const result = await execute(
      state,
      url,
      frozenHeaders,
      body,
      policy,
      signal,
      decode,
      structured
    );
    if (result && !signal.aborted) {
      state.progress = Object.freeze({ ...state.progress, delivered: state.progress.observed });
      emit('attempt_succeeded');
      if (!signal.aborted) return Ok(result);
      state.progress = Object.freeze({ ...state.progress, delivered: emptySemantic() });
    }
    const failure = failureOf(
      state,
      provider,
      structured ? 'structured' : 'ordinary',
      policy,
      sensitive
    );
    history.push(failure);
    firstFailure ??= monotonic();
    emit('attempt_failed', failure);
    if (signal.aborted) return cancelled();
    if (!failure.classification.eligible) return finish('interrupted', failure);
    if (number === (policy.maxAttempts ?? 1)) return finish('exhausted', failure);
    if ((remaining() ?? Infinity) <= 0) return finish('deadline', failure);
    if (policy.admit) {
      emit('admission_pending', failure);
      const admissionAbort = new AbortController();
      const abortAdmission = (): void => admissionAbort.abort(signal.reason);
      signal.addEventListener('abort', abortAdmission, { once: true });
      let decision: 'allow' | 'reject';
      try {
        decision = await wait(
          Promise.resolve().then(
            () =>
              policy.admit?.({ failure, nextAttempt: number + 1, signal: admissionAbort.signal }) ??
              'reject'
          ),
          signal,
          remaining()
        );
      } catch (cause) {
        if (signal.aborted) return cancelled();
        if (cause instanceof RecoveryDeadline) return finish('deadline', failure);
        const original = evidence.get(failure);
        if (original) evidence.set(failure, { ...original, admissionCause: cause });
        emit('admission_rejected', failure);
        return Err(new RecoveryError('admission_rejected', failure, [...history]));
      } finally {
        signal.removeEventListener('abort', abortAdmission);
        admissionAbort.abort();
      }
      if (signal.aborted) return cancelled();
      if (decision !== 'allow') {
        emit('admission_rejected', failure);
        return Err(new RecoveryError('admission_rejected', failure, [...history]));
      }
      emit('admission_allowed', failure);
    } else if (provider !== 'openai' && failure.acceptance !== 'no') {
      emit('admission_required', failure);
      return Err(new RecoveryError('admission_required', failure, [...history]));
    }
    const ceiling = policy.delayCeilingMs ?? 30000;
    const base = policy.baseDelayMs ?? 100;
    const exponential =
      base === 0
        ? 0
        : base >= ceiling || number - 1 >= Math.log2(ceiling / base)
          ? ceiling
          : base * 2 ** (number - 1);
    const random = (policy.jitter ?? Math.random)();
    if (!Number.isFinite(random) || random < 0 || random > 1)
      throw new RangeError('jitter must be between zero and one');
    const providerDelay = 'delayMs' in failure.retryAfter ? failure.retryAfter.delayMs : 0;
    const delay = Math.max(providerDelay, random * exponential);
    if (delay > ceiling) return finish('delay_ceiling', failure);
    if (delay >= (remaining() ?? Infinity)) return finish('deadline', failure);
    emit('delay_scheduled', failure, delay);
    try {
      await wait((policy.sleep ?? sleep)(delay, signal), signal, remaining());
    } catch (cause) {
      if (signal.aborted) return cancelled();
      if (cause instanceof RecoveryDeadline) return finish('deadline', failure);
      const original = evidence.get(failure);
      if (original) evidence.set(failure, { ...original, delayCause: cause });
      return finish('interrupted', failure);
    }
    if (signal.aborted) return cancelled();
    if ((remaining() ?? Infinity) <= 0) return finish('deadline', failure);
    emit('retry_started', failure);
  }
  throw new Error('Unreachable recovery state');
}
