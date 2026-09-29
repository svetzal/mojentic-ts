/**
 * oMLX additions to the OpenAI-compatible SSE stream: keep-alive frames and extended usage.
 *
 * oMLX opens every chat stream with a real `data:` frame whose `model` is `keepalive`, and sends
 * more during long prefill. Those frames are dropped here, before the shared OpenAI parsers see
 * them, so `keepalive` never becomes the reported model.
 */

import { CompletionEvidence } from '../stream-events';
import { parseOpenAIStreamLine } from './openai-stream-protocol';
import { LineOutcome, nothing, parseJson } from './stream-event-transport';

const KEEP_ALIVE_MODEL = 'keepalive';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The JSON object an SSE `data:` line carries, or undefined for any other line. */
function frameOf(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return undefined;
  const json = parseJson(trimmed.slice('data:'.length).trim());
  return isRecord(json?.value) ? json.value : undefined;
}

/** True when the line is an oMLX keep-alive `data:` frame. */
export function isKeepAliveLine(line: string): boolean {
  return frameOf(line)?.model === KEEP_ALIVE_MODEL;
}

/** Yield the lines of an oMLX stream without its keep-alive frames. */
export async function* withoutKeepAlives(lines: AsyncIterable<string>): AsyncGenerator<string> {
  for await (const line of lines) {
    if (!isKeepAliveLine(line)) yield line;
  }
}

/**
 * The `usage` object oMLX reported, exactly as sent, or undefined when there is none.
 *
 * oMLX adds fields such as `time_to_first_token` and `generation_tokens_per_second` that the
 * three-count usage shape cannot hold, so the whole object is also kept in metadata.
 */
export function reportedUsage(payload: unknown): Record<string, unknown> | undefined {
  return isRecord(payload) && isRecord(payload.usage) ? payload.usage : undefined;
}

/**
 * Parse one oMLX SSE line for single-turn stream events.
 *
 * Keep-alive frames carry nothing. Every other line goes to the shared OpenAI-compatible parser,
 * after the frame's reported usage is recorded in the evidence metadata under `usage`.
 */
export function parseOMLXStreamLine(line: string, evidence: CompletionEvidence): LineOutcome {
  const frame = frameOf(line);
  if (frame?.model === KEEP_ALIVE_MODEL) return nothing(evidence);

  const usage = reportedUsage(frame);
  const withUsage =
    usage === undefined ? evidence : { ...evidence, metadata: { ...evidence.metadata, usage } };
  return parseOpenAIStreamLine(line, withUsage);
}
