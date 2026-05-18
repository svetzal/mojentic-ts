/**
 * Configuration for the realtime voice subsystem.
 *
 * Mirrors the slice of OpenAI's Realtime session config that ports cleanly
 * to other Mojentic implementations. Provider-specific knobs live in
 * `providerExtras`.
 */

import { LlmTool } from '../llm/tools';

/**
 * Built-in voice options OpenAI's Realtime API exposes.
 *
 * Accepts arbitrary strings to allow new voices without a library update.
 */
export type RealtimeVoice = 'alloy' | 'verse' | 'shimmer' | 'echo' | 'ballad' | 'sage' | string;

/**
 * Audio modality selector.
 */
export type RealtimeModality = 'audio' | 'text';

/**
 * Audio frame format OpenAI accepts on the wire.
 *
 * `pcm16` is the default — 16-bit signed little-endian PCM, mono, 24 kHz.
 */
export type RealtimeAudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw';

/**
 * Tunable parameters for server-side voice-activity detection.
 *
 * Bump `threshold` up (e.g. 0.7–0.9) to make the VAD less sensitive to
 * background noise. Set `interruptResponse: false` to disable barge-in
 * entirely so the assistant's reply can't be cancelled mid-sentence by a
 * cough or keyboard click.
 */
export interface ServerVadConfig {
  type?: 'server_vad';
  /** Activation threshold (0.0–1.0). Lower fires on quieter speech. Default ≈ 0.5. */
  threshold?: number;
  /** Padding (ms) added to the start of a detected utterance. */
  prefixPaddingMs?: number;
  /** Silence (ms) before declaring the user is done speaking. */
  silenceDurationMs?: number;
  /** Whether VAD should auto-fire a `response.create` after the user stops. Default true. */
  createResponse?: boolean;
  /**
   * Whether speech detected during an in-flight assistant response should
   * cancel it (barge-in). Default true. Set false to mute false-positive
   * interruptions from background noise.
   */
  interruptResponse?: boolean;
  /** Max silence (ms) before the server idles the session. */
  idleTimeoutMs?: number;
}

/**
 * Semantic VAD mode — uses an LLM-side classifier to decide whether
 * detected audio is intentional speech vs background noise. More robust
 * than energy-threshold VAD in noisy environments.
 */
export interface SemanticVadConfig {
  type: 'semantic_vad';
  /** Sensitivity of the classifier. `low` = least likely to fire. */
  eagerness?: 'low' | 'medium' | 'high' | 'auto';
  createResponse?: boolean;
  interruptResponse?: boolean;
}

/**
 * Turn-detection strategy.
 *
 * - `server_vad` — server decides when the user stopped talking and auto-fires
 *   a response. Natural phone-call mode. Energy-threshold-based.
 * - `none` — client decides when to commit the buffer and request a response.
 *   Useful for push-to-talk and tests.
 * - `semantic_vad` — LLM-classifier-driven VAD. Best for noisy environments.
 * - A {@link ServerVadConfig} or {@link SemanticVadConfig} object — tune
 *   thresholds and behaviour.
 */
export type TurnDetectionMode =
  | 'server_vad'
  | 'semantic_vad'
  | 'none'
  | ServerVadConfig
  | SemanticVadConfig;

/**
 * Policy for handling tool outputs from a cancelled response.
 *
 * - `drop` (default) — don't submit any outputs from the cancelled batch.
 *   Stale answers don't pollute context.
 * - `submit-completed-only` — submit outputs for tools that finished before
 *   the abort signal landed; drop in-flight ones.
 * - `submit` — submit all outputs that eventually arrive, even after the
 *   model started a new response.
 */
export type InterruptOutputPolicy = 'drop' | 'submit' | 'submit-completed-only';

/**
 * Choice strategy for tools in the session.
 */
export type RealtimeToolChoice = 'auto' | 'none' | 'required' | { name: string };

/**
 * Vendor-neutral configuration for a realtime voice session.
 *
 * The library forwards a curated subset to the active gateway and translates
 * vendor-specific shapes at the boundary.
 */
export interface RealtimeVoiceConfig {
  /** System-level instructions injected into every assistant turn. */
  instructions?: string;
  /** Voice id to render assistant audio with. */
  voice?: RealtimeVoice;
  /** Active modalities. Default `['audio', 'text']`. */
  modalities?: RealtimeModality[];
  /** Encoding of audio frames the client sends. Default `pcm16`. */
  inputAudioFormat?: RealtimeAudioFormat;
  /** Encoding of audio frames the server returns. Default `pcm16`. */
  outputAudioFormat?: RealtimeAudioFormat;
  /** Turn-detection strategy. Default `server_vad`. */
  turnDetection?: TurnDetectionMode;
  /** Whisper transcription config for user audio. Pass `false` to disable. */
  inputAudioTranscription?: { model: 'whisper-1' } | false;
  /** Tools available to the model in this session. */
  tools?: LlmTool[];
  /** Tool-selection strategy. Default `auto`. */
  toolChoice?: RealtimeToolChoice;
  /** Sampling temperature. */
  temperature?: number;
  /** Cap on output tokens per response. */
  maxResponseOutputTokens?: number;
  /** How to treat tool outputs from interrupted/cancelled responses. */
  onInterrupt?: InterruptOutputPolicy;
  /** Provider-specific escape hatch — passed through verbatim to the gateway. */
  providerExtras?: Record<string, unknown>;
}

/**
 * Default config used when a field is omitted. Surfaced so consumers can
 * read effective values without re-implementing the merge themselves.
 */
export const REALTIME_DEFAULTS: Required<
  Pick<
    RealtimeVoiceConfig,
    | 'modalities'
    | 'inputAudioFormat'
    | 'outputAudioFormat'
    | 'turnDetection'
    | 'toolChoice'
    | 'onInterrupt'
  >
> = {
  modalities: ['audio', 'text'],
  inputAudioFormat: 'pcm16',
  outputAudioFormat: 'pcm16',
  turnDetection: 'server_vad',
  toolChoice: 'auto',
  onInterrupt: 'drop',
};
