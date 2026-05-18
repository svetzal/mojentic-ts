/**
 * Zod schemas for OpenAI Realtime API events.
 *
 * These validate the shape at the gateway boundary. We accept unknown extra
 * fields (Zod's default) so provider drift doesn't crash parsing — only the
 * fields the broker actually consumes are validated. Use `rawEvents()` on
 * the session if you need access to fields outside this schema.
 *
 * Schema snapshot: OpenAI Realtime API beta circa 2026-05.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// Shared sub-shapes
// -----------------------------------------------------------------------------

const usageSchema = z
  .object({
    total_tokens: z.number().optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    input_token_details: z.record(z.string(), z.unknown()).optional(),
    output_token_details: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();

const responseStatusDetails = z
  .object({
    type: z.string().optional(),
    reason: z.string().optional(),
  })
  .partial()
  .optional();

// -----------------------------------------------------------------------------
// Server → Client events
// -----------------------------------------------------------------------------

export const sessionCreatedSchema = z.object({
  type: z.literal('session.created'),
  session: z.object({ id: z.string() }).passthrough(),
});

export const sessionUpdatedSchema = z.object({
  type: z.literal('session.updated'),
  session: z.record(z.string(), z.unknown()),
});

export const speechStartedSchema = z.object({
  type: z.literal('input_audio_buffer.speech_started'),
  audio_start_ms: z.number().optional(),
  item_id: z.string().optional(),
});

export const speechStoppedSchema = z.object({
  type: z.literal('input_audio_buffer.speech_stopped'),
  audio_end_ms: z.number().optional(),
  item_id: z.string().optional(),
});

export const inputTranscriptionCompletedSchema = z.object({
  type: z.literal('conversation.item.input_audio_transcription.completed'),
  item_id: z.string(),
  transcript: z.string(),
});

export const inputTranscriptionDeltaSchema = z.object({
  type: z.literal('conversation.item.input_audio_transcription.delta'),
  item_id: z.string(),
  delta: z.string(),
});

export const responseCreatedSchema = z.object({
  type: z.literal('response.created'),
  response: z.object({ id: z.string() }).passthrough(),
});

export const responseDoneSchema = z.object({
  type: z.literal('response.done'),
  response: z
    .object({
      id: z.string(),
      status: z.string().optional(),
      status_details: responseStatusDetails,
      usage: usageSchema.optional(),
    })
    .passthrough(),
});

export const outputItemAddedSchema = z.object({
  type: z.literal('response.output_item.added'),
  response_id: z.string(),
  output_index: z.number().optional(),
  item: z
    .object({
      id: z.string().optional(),
      type: z.string(),
      call_id: z.string().optional(),
      name: z.string().optional(),
    })
    .passthrough(),
});

export const outputItemDoneSchema = z.object({
  type: z.literal('response.output_item.done'),
  response_id: z.string(),
  item: z
    .object({
      id: z.string().optional(),
      type: z.string(),
      call_id: z.string().optional(),
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .passthrough(),
});

export const audioDeltaSchema = z.object({
  type: z.literal('response.audio.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(), // base64 PCM
});

export const outputAudioDeltaSchema = z.object({
  type: z.literal('response.output_audio.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(),
});

export const audioTranscriptDeltaSchema = z.object({
  type: z.literal('response.audio_transcript.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(),
});

export const outputAudioTranscriptDeltaSchema = z.object({
  type: z.literal('response.output_audio_transcript.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(),
});

export const audioTranscriptDoneSchema = z.object({
  type: z.literal('response.audio_transcript.done'),
  response_id: z.string(),
  item_id: z.string().optional(),
  transcript: z.string(),
});

export const outputAudioTranscriptDoneSchema = z.object({
  type: z.literal('response.output_audio_transcript.done'),
  response_id: z.string(),
  item_id: z.string().optional(),
  transcript: z.string(),
});

export const textDeltaSchema = z.object({
  type: z.literal('response.text.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(),
});

export const outputTextDeltaSchema = z.object({
  type: z.literal('response.output_text.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  delta: z.string(),
});

export const textDoneSchema = z.object({
  type: z.literal('response.text.done'),
  response_id: z.string(),
  item_id: z.string().optional(),
  text: z.string(),
});

export const outputTextDoneSchema = z.object({
  type: z.literal('response.output_text.done'),
  response_id: z.string(),
  item_id: z.string().optional(),
  text: z.string(),
});

export const functionCallArgsDeltaSchema = z.object({
  type: z.literal('response.function_call_arguments.delta'),
  response_id: z.string(),
  item_id: z.string().optional(),
  call_id: z.string(),
  delta: z.string(),
});

export const functionCallArgsDoneSchema = z.object({
  type: z.literal('response.function_call_arguments.done'),
  response_id: z.string(),
  item_id: z.string().optional(),
  call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

export const rateLimitsUpdatedSchema = z.object({
  type: z.literal('rate_limits.updated'),
  rate_limits: z.array(z.record(z.string(), z.unknown())),
});

export const errorSchema = z.object({
  type: z.literal('error'),
  error: z
    .object({
      type: z.string().optional(),
      code: z.string().optional(),
      message: z.string(),
    })
    .passthrough(),
});

/**
 * Discriminated union of every server event the broker consumes.
 *
 * Other server events (the OpenAI API emits ~30 in total) are accepted as
 * raw `{ type: string }` and surfaced via `rawEvents()` only.
 */
export const serverEventSchema = z.discriminatedUnion('type', [
  sessionCreatedSchema,
  sessionUpdatedSchema,
  speechStartedSchema,
  speechStoppedSchema,
  inputTranscriptionCompletedSchema,
  inputTranscriptionDeltaSchema,
  responseCreatedSchema,
  responseDoneSchema,
  outputItemAddedSchema,
  outputItemDoneSchema,
  audioDeltaSchema,
  outputAudioDeltaSchema,
  audioTranscriptDeltaSchema,
  outputAudioTranscriptDeltaSchema,
  audioTranscriptDoneSchema,
  outputAudioTranscriptDoneSchema,
  textDeltaSchema,
  outputTextDeltaSchema,
  textDoneSchema,
  outputTextDoneSchema,
  functionCallArgsDeltaSchema,
  functionCallArgsDoneSchema,
  rateLimitsUpdatedSchema,
  errorSchema,
]);

export type ServerEvent = z.infer<typeof serverEventSchema>;

/** Server event we recognise plus a fallback for unknown event types. */
export type RawServerEvent = ServerEvent | { type: string; [k: string]: unknown };

/**
 * Best-effort parse: returns the validated event when recognised, otherwise
 * returns the raw payload so callers can still surface it through
 * `rawEvents()`.
 */
export function parseServerEvent(raw: unknown): RawServerEvent {
  const result = serverEventSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  if (typeof raw === 'object' && raw !== null && 'type' in raw) {
    return raw as { type: string; [k: string]: unknown };
  }
  return { type: 'unknown' };
}
