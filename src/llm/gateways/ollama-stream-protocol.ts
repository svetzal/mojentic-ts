/**
 * Pure parser for Ollama `/api/chat` NDJSON lines, for single-turn stream events.
 *
 * Success needs a final frame with `done: true` and a `done_reason` of `stop`.
 */

import { z } from 'zod';
import { CompletionUsage } from '../models';
import { CompletionEvidence, LlmStreamEvent } from '../stream-events';
import { fail, finish, LineOutcome, nothing, parseJson } from './stream-event-transport';

/** Completion evidence Ollama reports on its final (`done: true`) frame. */
export interface OllamaCompletionStats {
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/** Usage from Ollama's eval counts, or undefined when either count is missing. */
export function ollamaUsage(stats: OllamaCompletionStats): CompletionUsage | undefined {
  if (stats.prompt_eval_count === undefined || stats.eval_count === undefined) {
    return undefined;
  }
  return {
    promptTokens: stats.prompt_eval_count,
    completionTokens: stats.eval_count,
    totalTokens: stats.prompt_eval_count + stats.eval_count,
  };
}

/** The reported completion fields that have no dedicated slot, or undefined when none. */
export function ollamaMetadata(stats: OllamaCompletionStats): Record<string, unknown> | undefined {
  const { done_reason, total_duration, load_duration, prompt_eval_duration, eval_duration } = stats;
  const reported = Object.entries({
    done_reason,
    total_duration,
    load_duration,
    prompt_eval_duration,
    eval_duration,
  }).filter(([, value]) => value !== undefined);
  return reported.length > 0 ? Object.fromEntries(reported) : undefined;
}

const frameSchema = z.object({
  model: z.string().optional(),
  message: z
    .object({
      content: z.string().optional(),
      tool_calls: z.array(z.unknown()).nullish(),
    })
    .optional(),
  done: z.boolean(),
  done_reason: z.string().optional(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
});

const errorFrameSchema = z.object({ error: z.unknown().refine((error) => error !== undefined) });

type OllamaFrame = z.infer<typeof frameSchema>;

function finalEvidence(frame: OllamaFrame, evidence: CompletionEvidence): CompletionEvidence {
  return {
    finishReason: frame.done_reason ?? null,
    usage: ollamaUsage(frame) ?? null,
    providerModel: frame.model ?? evidence.providerModel,
    metadata: ollamaMetadata(frame) ?? null,
  };
}

/**
 * Parse one NDJSON line. Blank lines carry nothing.
 */
export function parseOllamaStreamLine(line: string, evidence: CompletionEvidence): LineOutcome {
  const trimmed = line.trim();
  if (trimmed === '') return nothing(evidence);

  const json = parseJson(trimmed);
  if (json === undefined) {
    return fail('invalid_stream_event', 'Stream frame is not JSON', evidence, trimmed);
  }

  const errorFrame = errorFrameSchema.safeParse(json.value);
  if (errorFrame.success) {
    return fail('provider_error', 'Provider reported an error', evidence, errorFrame.data.error);
  }

  const frame = frameSchema.safeParse(json.value);
  if (!frame.success) {
    return fail(
      'invalid_stream_event',
      'Stream frame has an unexpected shape',
      evidence,
      json.value
    );
  }

  const seen: CompletionEvidence = {
    ...evidence,
    providerModel: frame.data.model ?? evidence.providerModel,
  };
  if ((frame.data.message?.tool_calls?.length ?? 0) > 0) {
    return fail('unexpected_tool_calls', 'Provider requested a tool call', seen);
  }

  const content = frame.data.message?.content;
  const events: LlmStreamEvent[] = content ? [{ type: 'content', text: content }] : [];
  if (!frame.data.done) return { events, evidence: seen };

  return finish(events, finalEvidence(frame.data, seen));
}
