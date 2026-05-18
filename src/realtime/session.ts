/**
 * Realtime session — the stateful surface exposed by {@link RealtimeVoiceBroker}.
 *
 * Owns the socket lifetime, demultiplexes raw server events into a
 * vendor-neutral {@link RealtimeEvent} stream, and drives parallel tool
 * execution per response turn.
 */

import { randomUUID } from 'crypto';
import { Err, Ok, Result, isOk } from '../error';
import { TracerSystem } from '../tracer';
import {
  LlmTool,
  ParallelToolRunner,
  ToolArgs,
  ToolCallExecution,
  ToolCallOutcome,
  ToolResult,
  ToolRunner,
} from '../llm/tools';
import {
  REALTIME_DEFAULTS,
  RealtimeVoiceConfig,
  SemanticVadConfig,
  ServerVadConfig,
  TurnDetectionMode,
} from './config';
import { RealtimeEvent } from './events';
import { RealtimeGatewaySession, ServerRealtimeEvent } from './gateway';

const TOOL_BATCH_SOURCE = 'RealtimeVoiceBroker';

/**
 * Per-call state tracked across the function-call event lifecycle.
 */
interface PendingCall {
  callId: string;
  itemId?: string;
  name: string;
  argsBuffer: string;
  parsedArgs?: ToolArgs;
  done: boolean;
}

/**
 * Per-turn state — reset on `response.created`, finalised on `response.done`.
 */
interface TurnState {
  turnId: string;
  /** Tool calls observed during this turn, keyed by call_id. */
  calls: Map<string, PendingCall>;
  /** Text deltas accumulated for the final assistant_text event. */
  textBuffer: string;
  /** Transcript deltas accumulated for the final assistant_transcript event. */
  transcriptBuffer: string;
  /** Set to true if interrupted while in-flight. */
  cancelled: boolean;
  /** AbortController used to cancel tool execution on interruption. */
  toolAbort: AbortController;
}

/**
 * Options accepted by {@link RealtimeSession}.
 */
export interface RealtimeSessionOptions {
  config: RealtimeVoiceConfig;
  toolRunner?: ToolRunner;
  tracer?: TracerSystem;
  correlationId?: string;
}

type EmitFn = (event: RealtimeEvent) => void;

interface EventChannel<T> {
  push: (value: T) => void;
  end: () => void;
  iter: () => AsyncGenerator<T>;
}

function makeChannel<T>(): EventChannel<T> {
  const queue: T[] = [];
  const waiters: Array<(v: IteratorResult<T>) => void> = [];
  let done = false;

  return {
    push: (value: T): void => {
      if (done) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value, done: false });
      } else {
        queue.push(value);
      }
    },
    end: (): void => {
      if (done) return;
      done = true;
      while (waiters.length > 0) {
        const waiter = waiters.shift();
        waiter?.({ value: undefined as unknown as T, done: true });
      }
    },
    iter: async function* (): AsyncGenerator<T> {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift() as T;
          continue;
        }
        if (done) return;
        const next = await new Promise<IteratorResult<T>>((resolve) => {
          waiters.push(resolve);
        });
        if (next.done) return;
        yield next.value;
      }
    },
  };
}

/**
 * Decode a base64 string into an `Int16Array` of PCM samples (little-endian).
 */
function decodeBase64Pcm16(b64: string): Int16Array {
  const buf = Buffer.from(b64, 'base64');
  // Buffer is a Node Uint8Array view; copy into an Int16Array of the right length.
  const samples = new Int16Array(buf.length / 2);
  for (let i = 0; i < samples.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- bounded index
    samples[i] = buf.readInt16LE(i * 2);
  }
  return samples;
}

/**
 * Encode an `Int16Array` or `Uint8Array` of PCM samples as base64.
 */
export function encodeBase64Pcm16(frame: Int16Array | Uint8Array): string {
  if (frame instanceof Int16Array) {
    const buf = Buffer.alloc(frame.length * 2);
    for (let i = 0; i < frame.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- bounded index
      buf.writeInt16LE(frame[i], i * 2);
    }
    return buf.toString('base64');
  }
  return Buffer.from(frame).toString('base64');
}

/**
 * Build a vendor-specific `session.update` payload from a vendor-neutral
 * config, matching the OpenAI Realtime GA shape:
 *
 * - `session.type: "realtime"` is required.
 * - Vendor-neutral `modalities` maps to GA `output_modalities`.
 * - Voice + output audio format live under `session.audio.output`.
 * - Turn detection, transcription, and input audio format live under
 *   `session.audio.input`.
 * - `temperature` is no longer accepted on GA — silently dropped.
 * - `maxResponseOutputTokens` maps to GA `max_output_tokens`.
 */
export function buildSessionUpdate(config: RealtimeVoiceConfig): {
  type: 'session.update';
  session: Record<string, unknown>;
} {
  const modalities = config.modalities ?? REALTIME_DEFAULTS.modalities;
  const turnDetection = config.turnDetection ?? REALTIME_DEFAULTS.turnDetection;

  // GA splits modalities into output-only.
  const outputModalities = modalities.includes('audio') ? ['audio'] : ['text'];

  const audioInput: Record<string, unknown> = {
    format: encodeAudioFormat(config.inputAudioFormat ?? REALTIME_DEFAULTS.inputAudioFormat),
    turn_detection: encodeTurnDetection(turnDetection),
  };
  if (config.inputAudioTranscription === false) {
    audioInput.transcription = null;
  } else if (config.inputAudioTranscription !== undefined) {
    audioInput.transcription = config.inputAudioTranscription;
  }

  const audioOutput: Record<string, unknown> = {
    format: encodeAudioFormat(config.outputAudioFormat ?? REALTIME_DEFAULTS.outputAudioFormat),
  };
  if (config.voice !== undefined) audioOutput.voice = config.voice;

  const session: Record<string, unknown> = {
    type: 'realtime',
    output_modalities: outputModalities,
    audio: { input: audioInput, output: audioOutput },
    tool_choice: encodeToolChoice(config.toolChoice ?? REALTIME_DEFAULTS.toolChoice),
  };

  if (config.instructions !== undefined) session.instructions = config.instructions;
  if (config.maxResponseOutputTokens !== undefined) {
    session.max_output_tokens = config.maxResponseOutputTokens;
  }
  if (config.tools && config.tools.length > 0) {
    session.tools = config.tools.map((tool) => {
      const d = tool.descriptor();
      return {
        type: 'function',
        name: d.function.name,
        description: d.function.description,
        parameters: d.function.parameters,
      };
    });
  }
  if (config.providerExtras) {
    Object.assign(session, config.providerExtras);
  }

  return { type: 'session.update' as const, session };
}

function encodeAudioFormat(fmt: 'pcm16' | 'g711_ulaw' | 'g711_alaw'): {
  type: string;
  rate?: number;
} {
  switch (fmt) {
    case 'pcm16':
      return { type: 'audio/pcm', rate: 24000 };
    case 'g711_ulaw':
      return { type: 'audio/pcmu' };
    case 'g711_alaw':
      return { type: 'audio/pcma' };
  }
}

function encodeTurnDetection(td: TurnDetectionMode): unknown {
  if (td === 'none') return null;
  if (td === 'server_vad') return { type: 'server_vad' };
  if (td === 'semantic_vad') return { type: 'semantic_vad' };
  if (typeof td === 'object' && td.type === 'semantic_vad') {
    const cfg = td as SemanticVadConfig;
    return stripUndefined({
      type: 'semantic_vad',
      eagerness: cfg.eagerness,
      create_response: cfg.createResponse,
      interrupt_response: cfg.interruptResponse,
    });
  }
  const cfg = td as ServerVadConfig;
  return stripUndefined({
    type: 'server_vad',
    threshold: cfg.threshold,
    prefix_padding_ms: cfg.prefixPaddingMs,
    silence_duration_ms: cfg.silenceDurationMs,
    create_response: cfg.createResponse,
    interrupt_response: cfg.interruptResponse,
    idle_timeout_ms: cfg.idleTimeoutMs,
  });
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    // eslint-disable-next-line security/detect-object-injection -- k comes from Object.entries on a controlled literal
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

function encodeToolChoice(choice: RealtimeVoiceConfig['toolChoice']): unknown {
  if (choice === undefined) return 'auto';
  if (typeof choice === 'string') return choice;
  return { type: 'function', name: choice.name };
}

/**
 * Stateful realtime session handle.
 *
 * Constructed by {@link RealtimeVoiceBroker}; users don't instantiate this
 * directly.
 */
export class RealtimeSession {
  private readonly gatewaySession: RealtimeGatewaySession;
  private readonly config: RealtimeVoiceConfig;
  private readonly tools: LlmTool[];
  private readonly toolRunner: ToolRunner;
  private readonly tracer?: TracerSystem;
  private readonly correlationId: string;
  private readonly normalizedChannel = makeChannel<RealtimeEvent>();
  private readonly rawChannel = makeChannel<ServerRealtimeEvent>();
  private readonly audioChannel = makeChannel<Int16Array>();
  private readonly pumpPromise: Promise<void>;
  private readonly pendingBatches = new Set<Promise<void>>();
  private currentTurn?: TurnState;
  private currentResponseId?: string;
  private closed = false;
  private currentInstructions?: string;

  constructor(gatewaySession: RealtimeGatewaySession, options: RealtimeSessionOptions) {
    this.gatewaySession = gatewaySession;
    this.config = options.config;
    this.tools = options.config.tools ?? [];
    this.toolRunner = options.toolRunner ?? new ParallelToolRunner();
    this.tracer = options.tracer;
    this.correlationId = options.correlationId ?? randomUUID();
    this.currentInstructions = options.config.instructions;

    this.normalizedChannel.push({
      kind: 'session_opened',
      sessionId: gatewaySession.sessionId,
    });

    this.pumpPromise = this.pump();
  }

  /**
   * Initialise the session by sending the `session.update`. Called once by
   * the broker before returning the session to the caller.
   */
  async initialise(): Promise<Result<void, Error>> {
    const payload = buildSessionUpdate(this.config);
    return this.gatewaySession.sendEvent(payload);
  }

  /** Vendor-neutral event stream. Terminates when the session closes. */
  events(): AsyncGenerator<RealtimeEvent> {
    return this.normalizedChannel.iter();
  }

  /** Raw server events for power users / debugging. */
  rawEvents(): AsyncGenerator<ServerRealtimeEvent> {
    return this.rawChannel.iter();
  }

  /** Async generator yielding PCM frames from the assistant. */
  audioOutput(): AsyncGenerator<Int16Array> {
    return this.audioChannel.iter();
  }

  /**
   * Send a text-mode user message. Use this in text-only sessions and tests.
   */
  async sendText(text: string): Promise<Result<void, Error>> {
    const create = await this.gatewaySession.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    if (!isOk(create)) return create;
    return this.gatewaySession.sendEvent({ type: 'response.create' });
  }

  /**
   * Pipe an async iterable of PCM frames into the input audio buffer.
   *
   * Frames are encoded as base64 pcm16 and appended to the server VAD buffer.
   * Returns once the iterable completes or the session closes.
   */
  async sendAudio(stream: AsyncIterable<Int16Array | Uint8Array>): Promise<Result<void, Error>> {
    try {
      for await (const frame of stream) {
        if (this.closed) return Ok(undefined);
        const append = await this.gatewaySession.sendEvent({
          type: 'input_audio_buffer.append',
          audio: encodeBase64Pcm16(frame),
        });
        if (!isOk(append)) return append;
      }
      return Ok(undefined);
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Manually commit the input audio buffer (only meaningful with
   * `turnDetection: 'none'`) and request a response.
   */
  async commitAudio(): Promise<Result<void, Error>> {
    const commit = await this.gatewaySession.sendEvent({
      type: 'input_audio_buffer.commit',
    });
    if (!isOk(commit)) return commit;
    return this.gatewaySession.sendEvent({ type: 'response.create' });
  }

  /**
   * Cancel the in-flight response, abort any in-flight tool execution, and
   * fire an `interrupted` event with `reason: 'manual'`.
   */
  async interrupt(): Promise<Result<void, Error>> {
    return this.cancelCurrentTurn('manual');
  }

  /**
   * Update the instructions used by future assistant turns. The change is
   * sent immediately via a `session.update`.
   */
  async updateInstructions(instructions: string): Promise<Result<void, Error>> {
    this.currentInstructions = instructions;
    return this.gatewaySession.sendEvent({
      type: 'session.update',
      session: { instructions },
    });
  }

  /** Close the session, dispose the socket, and end all event streams. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.currentTurn && !this.currentTurn.cancelled) {
      this.currentTurn.cancelled = true;
      this.currentTurn.toolAbort.abort();
    }
    await Promise.allSettled(Array.from(this.pendingBatches));
    await this.gatewaySession.close();
    this.normalizedChannel.push({ kind: 'session_closed', reason: 'client' });
    this.normalizedChannel.end();
    this.rawChannel.end();
    this.audioChannel.end();
    await this.pumpPromise.catch(() => {
      /* swallow — close should never throw */
    });
  }

  /** Symbol.asyncDispose support for `await using` syntax. */
  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }

  /** Effective instructions used in the most recent `session.update`. */
  getInstructions(): string | undefined {
    return this.currentInstructions;
  }

  // ---------------------------------------------------------------------------
  // Event pump
  // ---------------------------------------------------------------------------

  private async pump(): Promise<void> {
    const emit: EmitFn = (event) => this.normalizedChannel.push(event);
    try {
      for await (const raw of this.gatewaySession.events()) {
        this.rawChannel.push(raw);
        await this.handleServerEvent(raw, emit);
        if (this.closed) break;
      }
    } finally {
      if (!this.closed) {
        this.normalizedChannel.push({ kind: 'session_closed', reason: 'server' });
        this.normalizedChannel.end();
        this.rawChannel.end();
        this.audioChannel.end();
        this.closed = true;
      }
    }
  }

  private async handleServerEvent(raw: ServerRealtimeEvent, emit: EmitFn): Promise<void> {
    switch (raw.type) {
      case 'session.created':
        // session_opened already emitted on construction; ignore.
        return;

      case 'session.updated':
        emit({ kind: 'session_updated', config: { instructions: this.currentInstructions } });
        return;

      case 'input_audio_buffer.speech_started': {
        const ev = raw as unknown as { audio_start_ms?: number };
        emit({ kind: 'user_speech_started', atMs: ev.audio_start_ms ?? Date.now() });
        // Barge-in: cancel any in-flight assistant response.
        if (this.currentTurn && !this.currentTurn.cancelled) {
          await this.cancelCurrentTurn('barge_in');
        }
        return;
      }

      case 'input_audio_buffer.speech_stopped': {
        const ev = raw as unknown as { audio_end_ms?: number };
        emit({ kind: 'user_speech_stopped', atMs: ev.audio_end_ms ?? Date.now() });
        return;
      }

      case 'conversation.item.input_audio_transcription.delta': {
        const ev = raw as unknown as { item_id: string; delta: string };
        emit({ kind: 'user_transcript_delta', itemId: ev.item_id, delta: ev.delta });
        return;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const ev = raw as unknown as { item_id: string; transcript: string };
        emit({ kind: 'user_transcript', itemId: ev.item_id, text: ev.transcript });
        return;
      }

      case 'response.created': {
        const ev = raw as unknown as { response: { id: string } };
        const turnId = ev.response.id;
        this.currentResponseId = turnId;
        this.currentTurn = {
          turnId,
          calls: new Map(),
          textBuffer: '',
          transcriptBuffer: '',
          cancelled: false,
          toolAbort: new AbortController(),
        };
        emit({ kind: 'assistant_turn_started', turnId });
        return;
      }

      case 'response.output_item.added': {
        const ev = raw as unknown as {
          item: { type: string; call_id?: string; name?: string; id?: string };
        };
        if (ev.item.type === 'function_call' && ev.item.call_id && ev.item.name) {
          const turn = this.currentTurn;
          if (!turn) return;
          turn.calls.set(ev.item.call_id, {
            callId: ev.item.call_id,
            itemId: ev.item.id,
            name: ev.item.name,
            argsBuffer: '',
            done: false,
          });
          emit({
            kind: 'tool_call_started',
            turnId: turn.turnId,
            callId: ev.item.call_id,
            name: ev.item.name,
          });
        }
        return;
      }

      case 'response.function_call_arguments.delta': {
        const ev = raw as unknown as { call_id: string; delta: string };
        const turn = this.currentTurn;
        const call = turn?.calls.get(ev.call_id);
        if (call) {
          call.argsBuffer += ev.delta;
        }
        emit({ kind: 'tool_call_args_delta', callId: ev.call_id, delta: ev.delta });
        return;
      }

      case 'response.function_call_arguments.done': {
        const ev = raw as unknown as { call_id: string; arguments: string };
        const turn = this.currentTurn;
        const call = turn?.calls.get(ev.call_id);
        if (call) {
          call.argsBuffer = ev.arguments || call.argsBuffer;
          call.done = true;
        }
        return;
      }

      case 'response.text.delta':
      case 'response.output_text.delta': {
        const ev = raw as unknown as { delta: string };
        const turn = this.currentTurn;
        if (!turn) return;
        turn.textBuffer += ev.delta;
        emit({ kind: 'assistant_text_delta', turnId: turn.turnId, delta: ev.delta });
        return;
      }

      case 'response.text.done':
      case 'response.output_text.done': {
        const ev = raw as unknown as { text: string };
        const turn = this.currentTurn;
        if (!turn) return;
        emit({ kind: 'assistant_text', turnId: turn.turnId, text: ev.text });
        return;
      }

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta': {
        const ev = raw as unknown as { delta: string };
        const turn = this.currentTurn;
        if (!turn) return;
        turn.transcriptBuffer += ev.delta;
        emit({ kind: 'assistant_transcript_delta', turnId: turn.turnId, delta: ev.delta });
        return;
      }

      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done': {
        const ev = raw as unknown as { transcript: string };
        const turn = this.currentTurn;
        if (!turn) return;
        emit({ kind: 'assistant_transcript', turnId: turn.turnId, text: ev.transcript });
        return;
      }

      case 'response.audio.delta':
      case 'response.output_audio.delta': {
        const ev = raw as unknown as { delta: string };
        const turn = this.currentTurn;
        if (!turn) return;
        const pcm = decodeBase64Pcm16(ev.delta);
        this.audioChannel.push(pcm);
        emit({ kind: 'assistant_audio_delta', turnId: turn.turnId, pcm });
        return;
      }

      case 'response.done': {
        const ev = raw as unknown as {
          response: {
            id: string;
            usage?: {
              total_tokens?: number;
              input_tokens?: number;
              output_tokens?: number;
              input_token_details?: Record<string, unknown>;
              output_token_details?: Record<string, unknown>;
            };
          };
        };
        const turn = this.currentTurn;
        if (!turn || turn.turnId !== ev.response.id) {
          this.currentTurn = undefined;
          return;
        }

        const usage = ev.response.usage;
        const usageOut = usage
          ? {
              promptTokens: usage.input_tokens,
              completionTokens: usage.output_tokens,
              totalTokens: usage.total_tokens,
              extras: {
                input_token_details: usage.input_token_details,
                output_token_details: usage.output_token_details,
              },
            }
          : undefined;
        emit({ kind: 'assistant_turn_completed', turnId: turn.turnId, usage: usageOut });

        if (turn.calls.size > 0) {
          // Fire-and-track: the pump must stay responsive to barge-in /
          // server events while tools are running. We keep `currentTurn`
          // set during execution so a late `speech_started` or manual
          // `interrupt()` can still abort the batch.
          const batchPromise = this.runToolBatchForTurn(turn, emit).catch((err) => {
            emit({
              kind: 'error',
              error: err instanceof Error ? err : new Error(String(err)),
              recoverable: true,
            });
          });
          this.pendingBatches.add(batchPromise);
          batchPromise.finally(() => {
            this.pendingBatches.delete(batchPromise);
            if (this.currentTurn === turn) {
              this.currentTurn = undefined;
              this.currentResponseId = undefined;
            }
          });
        } else {
          this.currentTurn = undefined;
          this.currentResponseId = undefined;
        }
        return;
      }

      case 'rate_limits.updated': {
        const ev = raw as unknown as { rate_limits: Record<string, unknown>[] };
        const first = ev.rate_limits[0] ?? {};
        const reset = (first.reset_seconds as number | undefined) ?? 0;
        emit({
          kind: 'rate_limited',
          resetMs: Math.round(reset * 1000),
          details: { rate_limits: ev.rate_limits },
        });
        return;
      }

      case 'error': {
        const ev = raw as unknown as { error: { message: string; type?: string } };
        // Suppress the expected race when `response.cancel` lands after the
        // response has already completed server-side — common during barge-in.
        if (/no active response/i.test(ev.error.message)) {
          return;
        }
        emit({
          kind: 'error',
          error: new Error(ev.error.message),
          recoverable: ev.error.type !== 'session_error',
        });
        return;
      }

      default:
        // Unknown event types stay in rawEvents() only.
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Tool batch execution
  // ---------------------------------------------------------------------------

  private async runToolBatchForTurn(turn: TurnState, emit: EmitFn): Promise<void> {
    const calls = Array.from(turn.calls.values()).filter((c) => c.done || c.argsBuffer.length > 0);
    const executions: ToolCallExecution[] = [];

    for (const call of calls) {
      try {
        const args = (call.argsBuffer ? JSON.parse(call.argsBuffer) : {}) as ToolArgs;
        call.parsedArgs = args;
        executions.push({ id: call.callId, name: call.name, args });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        emit({ kind: 'tool_call_failed', callId: call.callId, name: call.name, error });
      }
    }

    if (executions.length === 0) {
      return;
    }

    const batchStart = Date.now();
    const outcomes = await this.toolRunner.runBatch(executions, this.tools, {
      signal: turn.toolAbort.signal,
      correlationId: this.correlationId,
      source: TOOL_BATCH_SOURCE,
      onCallStart: (call) => {
        emit({
          kind: 'tool_call_dispatched',
          callId: call.id,
          name: call.name,
          args: call.args,
        });
      },
      onCallComplete: (outcome) => {
        if (this.tracer) {
          const args = executions.find((e) => e.id === outcome.id)?.args ?? {};
          this.tracer.recordToolCall(
            outcome.name,
            args,
            outcome.ok ? outcome.result : { error: outcome.error.message },
            TOOL_BATCH_SOURCE,
            outcome.durationMs,
            this.correlationId,
            'RealtimeSession.toolBatch'
          );
        }
        if (outcome.ok) {
          emit({
            kind: 'tool_call_completed',
            callId: outcome.id,
            name: outcome.name,
            result: outcome.result,
          });
        } else {
          emit({
            kind: 'tool_call_failed',
            callId: outcome.id,
            name: outcome.name,
            error: outcome.error,
          });
        }
      },
    });

    if (this.tracer) {
      const ok = outcomes.filter((o) => o.ok).length;
      const fail = outcomes.length - ok;
      this.tracer.recordToolBatch(
        randomUUID(),
        executions.map((e) => e.name),
        ok,
        fail,
        Date.now() - batchStart,
        this.correlationId,
        'RealtimeSession.toolBatch'
      );
    }

    const policy = this.config.onInterrupt ?? REALTIME_DEFAULTS.onInterrupt;
    const toSubmit = this.selectOutputsToSubmit(turn, outcomes, policy);

    const submittedIds: string[] = [];
    for (const outcome of toSubmit) {
      const output = serialiseOutput(outcome);
      const send = await this.gatewaySession.sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: outcome.id,
          output,
        },
      });
      if (isOk(send)) {
        submittedIds.push(outcome.id);
      }
    }

    if (submittedIds.length > 0) {
      emit({ kind: 'tool_batch_submitted', turnId: turn.turnId, callIds: submittedIds });
      // Trigger the model's follow-up response.
      await this.gatewaySession.sendEvent({ type: 'response.create' });
    }
  }

  private selectOutputsToSubmit(
    turn: TurnState,
    outcomes: ToolCallOutcome[],
    policy: 'drop' | 'submit' | 'submit-completed-only'
  ): ToolCallOutcome[] {
    if (!turn.cancelled) return outcomes;
    if (policy === 'submit') return outcomes;
    if (policy === 'drop') return [];
    // submit-completed-only: only outcomes that wrapped up before abort signal landed.
    return outcomes.filter((o) => o.ok);
  }

  private async cancelCurrentTurn(
    reason: 'manual' | 'barge_in' | 'error'
  ): Promise<Result<void, Error>> {
    const turn = this.currentTurn;
    if (!turn || turn.cancelled) {
      return Ok(undefined);
    }
    turn.cancelled = true;
    turn.toolAbort.abort();
    this.normalizedChannel.push({ kind: 'interrupted', turnId: turn.turnId, reason });
    if (!this.currentResponseId) return Ok(undefined);
    return this.gatewaySession.sendEvent({ type: 'response.cancel' });
  }
}

function serialiseOutput(outcome: ToolCallOutcome): string {
  if (outcome.ok) {
    return safeJsonStringify(outcome.result);
  }
  return JSON.stringify({ error: outcome.error.message });
}

function safeJsonStringify(value: ToolResult): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify({ error: 'serialisation_failed', detail: String(err) });
  }
}
