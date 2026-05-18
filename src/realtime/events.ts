/**
 * Vendor-neutral event union for the realtime subsystem.
 *
 * Consumers subscribe to this union rather than raw OpenAI events so the
 * same observer code ports cleanly to other realtime providers and other
 * Mojentic implementations (Python, Elixir, Rust).
 */

import { ToolArgs, ToolResult } from '../llm/tools';
import { RealtimeVoiceConfig } from './config';

/**
 * Token usage reported when a response turn completes.
 */
export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Provider-specific breakdown (e.g. audio vs text tokens). */
  extras?: Record<string, unknown>;
}

/**
 * Conversation item in a realtime session.
 *
 * Realtime sessions don't map cleanly to chat-completion `LlmMessage`s
 * because they carry audio, multi-modal content, and tool-call lifecycle
 * separate from any single message. We carry a small dedicated shape so
 * `LlmMessage` doesn't get bent out of shape.
 */
export interface RealtimeItem {
  id: string;
  /** Item kind — message, function-call, or function-call output. */
  type: 'message' | 'function_call' | 'function_call_output';
  /** Role for message items. */
  role?: 'system' | 'user' | 'assistant';
  /** Text content (assembled from streamed deltas). */
  text?: string;
  /** Transcript content (assembled from streamed audio deltas). */
  transcript?: string;
  /** Function name for function_call / function_call_output items. */
  name?: string;
  /** Parsed JSON arguments for function_call items. */
  args?: ToolArgs;
  /** Tool execution result for function_call_output items. */
  output?: ToolResult;
  /** Pair function_call → function_call_output. */
  callId?: string;
}

/**
 * Vendor-neutral event types emitted by {@link RealtimeSession}.
 */
export type RealtimeEvent =
  // Session lifecycle
  | { kind: 'session_opened'; sessionId: string }
  | { kind: 'session_updated'; config: Partial<RealtimeVoiceConfig> }
  | { kind: 'session_closed'; reason: 'client' | 'server' | 'error' }

  // User turn (what the human said / is saying)
  | { kind: 'user_speech_started'; atMs: number }
  | { kind: 'user_speech_stopped'; atMs: number }
  | { kind: 'user_transcript_delta'; itemId: string; delta: string }
  | { kind: 'user_transcript'; itemId: string; text: string }

  // Assistant turn (what the model is producing)
  | { kind: 'assistant_turn_started'; turnId: string }
  | { kind: 'assistant_text_delta'; turnId: string; delta: string }
  | { kind: 'assistant_text'; turnId: string; text: string }
  | { kind: 'assistant_transcript_delta'; turnId: string; delta: string }
  | { kind: 'assistant_transcript'; turnId: string; text: string }
  | { kind: 'assistant_audio_delta'; turnId: string; pcm: Int16Array }
  | { kind: 'assistant_turn_completed'; turnId: string; usage?: TokenUsage }

  // Tool calls (parallel-aware)
  | { kind: 'tool_call_started'; turnId: string; callId: string; name: string }
  | { kind: 'tool_call_args_delta'; callId: string; delta: string }
  | {
      kind: 'tool_call_dispatched';
      callId: string;
      name: string;
      args: ToolArgs;
    }
  | {
      kind: 'tool_call_completed';
      callId: string;
      name: string;
      result: ToolResult;
    }
  | {
      kind: 'tool_call_failed';
      callId: string;
      name: string;
      error: Error;
    }
  | { kind: 'tool_batch_submitted'; turnId: string; callIds: string[] }

  // Control
  | {
      kind: 'interrupted';
      turnId: string;
      reason: 'barge_in' | 'manual' | 'error';
    }
  | {
      kind: 'rate_limited';
      resetMs: number;
      details: Record<string, unknown>;
    }
  | { kind: 'error'; error: Error; recoverable: boolean };

/**
 * Narrow helper for discriminating events by `kind` in switch statements
 * without losing exhaustiveness checking.
 */
export type RealtimeEventKind = RealtimeEvent['kind'];
