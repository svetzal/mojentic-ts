/**
 * HTTP transport for single-turn streams of {@link LlmStreamEvent}.
 *
 * The provider wire formats differ (OpenAI sends SSE, Ollama sends NDJSON), but both are a fold
 * over the lines of one response body. Each gateway supplies a pure {@link LineParser}; this
 * module owns the request, the body reader, cancellation, and the end-of-stream rules.
 */

import {
  CompletionEvidence,
  LlmStreamEvent,
  StreamEventError,
  StreamEventErrorReason,
} from '../stream-events';

/** The result of parsing one line: events to yield and the evidence gathered so far. */
export interface LineOutcome {
  readonly events: readonly LlmStreamEvent[];
  readonly evidence: CompletionEvidence;
}

/** Parse one line of a response body. Must be pure. */
export type LineParser = (line: string, evidence: CompletionEvidence) => LineOutcome;

/** One streaming HTTP request. */
export interface StreamRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

const NO_EVIDENCE: CompletionEvidence = {
  finishReason: null,
  usage: null,
  providerModel: null,
  metadata: null,
};

/** A line that carries nothing. */
export function nothing(evidence: CompletionEvidence): LineOutcome {
  return { events: [], evidence };
}

/** A terminal error event, carrying the evidence gathered so far. */
export function failure(
  reason: StreamEventErrorReason,
  message: string,
  evidence: CompletionEvidence,
  detail?: unknown
): LlmStreamEvent {
  return { type: 'error', error: new StreamEventError(reason, message, { evidence, detail }) };
}

/** Outcome for a line that ends the stream with an error. */
export function fail(
  reason: StreamEventErrorReason,
  message: string,
  evidence: CompletionEvidence,
  detail?: unknown
): LineOutcome {
  return { events: [failure(reason, message, evidence, detail)], evidence };
}

/**
 * Outcome for a provider's terminal marker: success only when the finish reason is `stop`.
 */
export function finish(
  events: readonly LlmStreamEvent[],
  evidence: CompletionEvidence
): LineOutcome {
  const terminal: LlmStreamEvent =
    evidence.finishReason === 'stop'
      ? { type: 'completed', metadata: evidence }
      : failure(
          'incomplete_completion',
          `Completion ended with finish reason ${evidence.finishReason ?? '(none reported)'}`,
          evidence
        );
  return { events: [...events, terminal], evidence };
}

/** Parse a JSON payload, or return undefined when it is not JSON. */
export function parseJson(payload: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(payload) as unknown };
  } catch {
    return undefined;
  }
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Send one streaming request and yield its events, ending with exactly one terminal event.
 *
 * Stopping iteration (`break`, `return()`) or aborting `callerSignal` aborts the request and
 * cancels the body. An abort while iteration continues ends the stream with a `cancelled` error.
 */
export async function* streamCompletionEvents(
  request: StreamRequest,
  parseLine: LineParser,
  callerSignal?: AbortSignal
): AsyncGenerator<LlmStreamEvent> {
  if (callerSignal?.aborted) {
    yield failure('cancelled', 'The request was cancelled before it was sent', NO_EVIDENCE);
    return;
  }

  const controller = new AbortController();
  const abortRequest = (): void => controller.abort();
  callerSignal?.addEventListener('abort', abortRequest, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  controller.signal.addEventListener('abort', () => void reader?.cancel().catch(() => undefined), {
    once: true,
  });
  const interrupted = (evidence: CompletionEvidence, cause: unknown): LlmStreamEvent =>
    callerSignal?.aborted
      ? failure('cancelled', 'The request was cancelled', evidence)
      : failure('request_failed', `Request failed: ${describe(cause)}`, evidence, cause);

  try {
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
    } catch (cause) {
      yield interrupted(NO_EVIDENCE, cause);
      return;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      yield failure('provider_error', `Provider returned HTTP ${response.status}`, NO_EVIDENCE, {
        status: response.status,
        body,
      });
      return;
    }

    if (!response.body) {
      yield failure('request_failed', 'The response has no body', NO_EVIDENCE);
      return;
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let evidence = NO_EVIDENCE;
    let buffer = '';

    for (;;) {
      let chunk: Awaited<ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>>;
      try {
        chunk = await reader.read();
      } catch (cause) {
        yield interrupted(evidence, cause);
        return;
      }

      const text = buffer + decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = text.split('\n');
      buffer = chunk.done ? '' : (lines.pop() ?? '');

      for (const line of lines) {
        if (callerSignal?.aborted) {
          yield failure('cancelled', 'The request was cancelled', evidence);
          return;
        }
        const outcome = parseLine(line, evidence);
        evidence = outcome.evidence;
        for (const event of outcome.events) {
          yield event;
          if (event.type !== 'content') return;
        }
      }

      if (chunk.done) break;
    }

    yield callerSignal?.aborted
      ? failure('cancelled', 'The request was cancelled', evidence)
      : failure('incomplete_stream', 'The stream ended without a terminal marker', evidence);
  } finally {
    callerSignal?.removeEventListener('abort', abortRequest);
    controller.abort();
  }
}
