/**
 * Pure parser for OpenAI-compatible chat completion SSE lines, for single-turn stream events.
 *
 * Success needs both a `stop` finish reason and the `data: [DONE]` marker.
 */

import { z } from 'zod';
import { CompletionUsage } from '../models';
import { CompletionEvidence, LlmStreamEvent } from '../stream-events';
import { fail, finish, LineOutcome, nothing, parseJson } from './stream-event-transport';

const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

const chunkSchema = z.object({
  id: z.string().optional(),
  created: z.number().optional(),
  model: z.string().optional(),
  system_fingerprint: z.string().nullish(),
  usage: usageSchema.nullish(),
  choices: z
    .array(
      z.object({
        delta: z.object({
          content: z.string().nullish(),
          tool_calls: z.array(z.unknown()).nullish(),
          function_call: z.unknown().optional(),
        }),
        finish_reason: z.string().nullish(),
      })
    )
    .max(1),
});

const errorFrameSchema = z.object({ error: z.unknown().refine((error) => error !== undefined) });

type OpenAIChunk = z.infer<typeof chunkSchema>;

/** Convert OpenAI's reported token usage into the gateway response usage shape. */
export function toCompletionUsage(usage: z.infer<typeof usageSchema>): CompletionUsage {
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function mergeMetadata(
  known: CompletionEvidence['metadata'],
  chunk: OpenAIChunk
): CompletionEvidence['metadata'] {
  const { id, created, system_fingerprint } = chunk;
  const reported = Object.entries({ id, created, system_fingerprint }).filter(
    ([, value]) => value !== undefined && value !== null
  );
  if (reported.length === 0) return known;
  return { ...known, ...Object.fromEntries(reported) };
}

function accumulate(evidence: CompletionEvidence, chunk: OpenAIChunk): CompletionEvidence {
  return {
    finishReason: chunk.choices[0]?.finish_reason ?? evidence.finishReason,
    usage: chunk.usage ? toCompletionUsage(chunk.usage) : evidence.usage,
    providerModel: chunk.model ?? evidence.providerModel,
    metadata: mergeMetadata(evidence.metadata, chunk),
  };
}

/**
 * Parse one SSE line. Blank lines, comments and non-data fields carry nothing.
 */
export function parseOpenAIStreamLine(line: string, evidence: CompletionEvidence): LineOutcome {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return nothing(evidence);

  const payload = trimmed.slice('data:'.length).trim();
  if (payload === '[DONE]') return finish([], evidence);

  const json = parseJson(payload);
  if (json === undefined) {
    return fail('invalid_stream_event', 'Stream frame is not JSON', evidence, payload);
  }

  const errorFrame = errorFrameSchema.safeParse(json.value);
  if (errorFrame.success) {
    return fail('provider_error', 'Provider reported an error', evidence, errorFrame.data.error);
  }

  const chunk = chunkSchema.safeParse(json.value);
  if (!chunk.success) {
    return fail(
      'invalid_stream_event',
      'Stream frame has an unexpected shape',
      evidence,
      json.value
    );
  }

  const next = accumulate(evidence, chunk.data);
  const delta = chunk.data.choices[0]?.delta;
  if (delta === undefined) return nothing(next);

  if ((delta.tool_calls?.length ?? 0) > 0 || (delta.function_call ?? null) !== null) {
    return fail('unexpected_tool_calls', 'Provider requested a tool call', next);
  }

  const events: LlmStreamEvent[] = delta.content ? [{ type: 'content', text: delta.content }] : [];
  return { events, evidence: next };
}
