/**
 * Events for single-turn streaming with terminal completion evidence.
 *
 * A stream of {@link LlmStreamEvent} values yields visible content in order and ends with exactly
 * one terminal event: `completed` or `error`. Content received before an `error` is evidence of
 * what the provider sent, not a usable result.
 */

import { MojenticError } from '../error';
import { CompletionUsage, FinishReason } from './models';

/**
 * Provider completion evidence plus client-measured streaming latency.
 *
 * A null provider field means it was not reported. Client timing uses a monotonic clock.
 */
export interface CompletionEvidence {
  readonly finishReason: FinishReason | null;
  readonly usage: CompletionUsage | null;
  /** Model name the provider reported, which can differ from the requested model. */
  readonly providerModel: string | null;
  /**
   * Provider fields (response id, Ollama timings, oMLX usage) and client timing in milliseconds:
   * `request_duration_ms` on dispatched terminal success/failure; `time_to_first_token_ms` and
   * `first_token_kind` (`content`, `thinking`, `tool_call`) only after a nonempty token fragment.
   * Timing starts at dispatch, ignores keepalives/empty deltas, and retains the first observation.
   * Tool arguments count before a completed call; thinking counts even when not publicly yielded.
   */
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

/**
 * Why a single-turn stream failed.
 *
 * - `interrupted_stream`: opt-in recovery blocked replay after output or protocol failure.
 * - `incomplete_completion`: the provider finished for a reason other than `stop`.
 * - `incomplete_stream`: the stream ended without a terminal marker.
 * - `provider_error`: the provider sent an error frame or a non-success HTTP status.
 * - `unexpected_tool_calls`: the provider asked for a tool call, which this API never executes.
 * - `invalid_stream_event`: a frame could not be understood.
 * - `stream_events_unsupported`: the gateway does not implement the API; no request was sent.
 * - `request_failed`: the connection or the body read failed.
 * - `cancelled`: the caller's `AbortSignal` fired.
 */
export type StreamEventErrorReason =
  | 'interrupted_stream'
  | 'incomplete_completion'
  | 'incomplete_stream'
  | 'provider_error'
  | 'unexpected_tool_calls'
  | 'invalid_stream_event'
  | 'stream_events_unsupported'
  | 'request_failed'
  | 'cancelled';

/**
 * Terminal failure of a single-turn stream.
 *
 * `evidence` holds whatever the provider reported before the failure. `detail` holds the
 * provider's error payload or the underlying cause, when there is one.
 */
export class StreamEventError extends MojenticError {
  readonly reason: StreamEventErrorReason;
  readonly evidence?: CompletionEvidence;
  readonly detail?: unknown;
  /** Structured opt-in recovery outcome and exact attempt history. */
  readonly recovery?: import('./recovery').RecoveryError;

  constructor(
    reason: StreamEventErrorReason,
    message: string,
    options: {
      evidence?: CompletionEvidence;
      detail?: unknown;
      recovery?: import('./recovery').RecoveryError;
    } = {}
  ) {
    super(message, 'STREAM_EVENT_ERROR');
    this.name = 'StreamEventError';
    this.reason = reason;
    this.evidence = options.evidence;
    this.detail = options.detail;
    this.recovery = options.recovery;
    Object.setPrototypeOf(this, StreamEventError.prototype);
  }
}

/**
 * One event from a single-turn stream.
 */
export type LlmStreamEvent =
  | { readonly type: 'content'; readonly text: string }
  | { readonly type: 'completed'; readonly metadata: CompletionEvidence }
  | { readonly type: 'error'; readonly error: StreamEventError };

/**
 * Options for {@link LlmBroker.generateStreamEvents}.
 */
export interface StreamEventsOptions {
  /** UUID that ties the tracer events of this call together. Generated when absent. */
  correlationId?: string;
  /** Aborts the HTTP request. The stream then ends with a `cancelled` error. */
  signal?: AbortSignal;
}
