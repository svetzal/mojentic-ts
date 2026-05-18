/**
 * Tests for RealtimeSession driving a scripted gateway session.
 */

import { Err, Ok, Result, isOk } from '../error';
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult, ToolRunCtx } from '../llm/tools';
import { TracerSystem } from '../tracer';
import { ToolBatchTracerEvent } from '../tracer/tracerEvents';
import { RealtimeVoiceBroker } from './broker';
import { RealtimeVoiceConfig } from './config';
import { RealtimeEvent } from './events';
import {
  ClientRealtimeEvent,
  RealtimeGatewaySession,
  RealtimeVoiceGateway,
  ServerRealtimeEvent,
} from './gateway';
import { buildSessionUpdate, encodeBase64Pcm16 } from './session';

/**
 * Scripted gateway session for tests.
 */
class ScriptedSession implements RealtimeGatewaySession {
  readonly sessionId = 'sess_test';
  closed = false;
  sent: ClientRealtimeEvent[] = [];
  private readonly queue: ServerRealtimeEvent[] = [];
  private waiter?: (v: IteratorResult<ServerRealtimeEvent>) => void;

  async sendEvent(event: ClientRealtimeEvent): Promise<Result<void, Error>> {
    if (this.closed) return Err(new Error('closed'));
    this.sent.push(event);
    return Ok(undefined);
  }

  async *events(): AsyncGenerator<ServerRealtimeEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift() as ServerRealtimeEvent;
        continue;
      }
      if (this.closed) return;
      const next = await new Promise<IteratorResult<ServerRealtimeEvent>>((resolve) => {
        this.waiter = resolve;
      });
      if (next.done) return;
      yield next.value;
    }
  }

  emit(ev: ServerRealtimeEvent): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = undefined;
      w({ value: ev, done: false });
    } else {
      this.queue.push(ev);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = undefined;
      w({ value: undefined as unknown as ServerRealtimeEvent, done: true });
    }
  }

  isClosed(): boolean {
    return this.closed;
  }
}

class StubGateway implements RealtimeVoiceGateway {
  session = new ScriptedSession();
  openCalls: Array<{ model: string; config: RealtimeVoiceConfig }> = [];

  async open(
    model: string,
    config: RealtimeVoiceConfig
  ): Promise<Result<RealtimeGatewaySession, Error>> {
    this.openCalls.push({ model, config });
    return Ok(this.session);
  }
}

class EchoTool extends BaseTool {
  constructor(private readonly tname: string) {
    super();
  }
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    return Ok({ tool: this.tname, args });
  }
  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: this.tname,
        description: 'echo',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }
}

class SlowAbortableTool extends BaseTool {
  aborted = false;
  constructor(
    private readonly tname: string,
    private readonly delayMs = 100
  ) {
    super();
  }
  async run(_args: ToolArgs, ctx?: ToolRunCtx): Promise<Result<ToolResult, Error>> {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(Ok({ tool: this.tname })), this.delayMs);
      ctx?.signal?.addEventListener('abort', () => {
        this.aborted = true;
        clearTimeout(t);
        resolve(Err(new Error('aborted')));
      });
    });
  }
  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: this.tname,
        description: 'slow',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }
}

async function collectUntil(
  iter: AsyncGenerator<RealtimeEvent>,
  predicate: (e: RealtimeEvent) => boolean,
  cap = 50
): Promise<RealtimeEvent[]> {
  const out: RealtimeEvent[] = [];
  for (let i = 0; i < cap; i++) {
    const next = await iter.next();
    if (next.done) break;
    out.push(next.value);
    if (predicate(next.value)) break;
  }
  return out;
}

describe('buildSessionUpdate', () => {
  test('translates vendor-neutral config to OpenAI GA shape', () => {
    const payload = buildSessionUpdate({
      instructions: 'be helpful',
      voice: 'verse',
      modalities: ['text'],
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
      turnDetection: 'none',
      tools: [new EchoTool('echo')],
    });

    expect(payload.type).toBe('session.update');
    expect(payload.session.type).toBe('realtime');
    expect(payload.session.instructions).toBe('be helpful');
    expect(payload.session.output_modalities).toEqual(['text']);

    const audio = payload.session.audio as {
      input: { format: unknown; turn_detection: unknown };
      output: { format: unknown; voice?: string };
    };
    expect(audio.output.voice).toBe('verse');
    expect(audio.output.format).toEqual({ type: 'audio/pcm', rate: 24000 });
    expect(audio.input.format).toEqual({ type: 'audio/pcm', rate: 24000 });
    expect(audio.input.turn_detection).toBe(null);

    expect(Array.isArray(payload.session.tools)).toBe(true);
    const tools = payload.session.tools as Array<{ name: string }>;
    expect(tools[0].name).toBe('echo');
  });

  test('audio modality maps to output_modalities=["audio"]', () => {
    const payload = buildSessionUpdate({ modalities: ['audio', 'text'] });
    expect(payload.session.output_modalities).toEqual(['audio']);
  });

  test('encodes server_vad object form under audio.input.turn_detection', () => {
    const payload = buildSessionUpdate({
      turnDetection: { threshold: 0.6, silenceDurationMs: 200 },
    });
    const audio = payload.session.audio as { input: { turn_detection: unknown } };
    expect(audio.input.turn_detection).toEqual({
      type: 'server_vad',
      threshold: 0.6,
      silence_duration_ms: 200,
    });
  });

  test('encodes semantic_vad with eagerness and interruptResponse', () => {
    const payload = buildSessionUpdate({
      turnDetection: {
        type: 'semantic_vad',
        eagerness: 'low',
        interruptResponse: false,
      },
    });
    const audio = payload.session.audio as { input: { turn_detection: unknown } };
    expect(audio.input.turn_detection).toEqual({
      type: 'semantic_vad',
      eagerness: 'low',
      interrupt_response: false,
    });
  });

  test('maxResponseOutputTokens maps to GA max_output_tokens and temperature is dropped', () => {
    const payload = buildSessionUpdate({
      maxResponseOutputTokens: 256,
      temperature: 0.5,
    });
    expect(payload.session.max_output_tokens).toBe(256);
    expect(payload.session).not.toHaveProperty('temperature');
  });
});

describe('encodeBase64Pcm16', () => {
  test('encodes Int16Array to base64 round-trippable bytes', () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768]);
    const b64 = encodeBase64Pcm16(samples);
    const decoded = Buffer.from(b64, 'base64');

    expect(decoded.length).toBe(samples.length * 2);
    expect(decoded.readInt16LE(0)).toBe(0);
    expect(decoded.readInt16LE(2)).toBe(1);
    expect(decoded.readInt16LE(4)).toBe(-1);
    expect(decoded.readInt16LE(6)).toBe(32767);
    expect(decoded.readInt16LE(8)).toBe(-32768);
  });
});

describe('RealtimeVoiceBroker / RealtimeSession', () => {
  test('connect sends a session.update with the merged config', async () => {
    const gateway = new StubGateway();
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway, {
      instructions: 'broker-level',
    });

    const result = await broker.connect({ voice: 'verse' });
    expect(isOk(result)).toBe(true);

    const update = gateway.session.sent[0];
    expect(update.type).toBe('session.update');
    const session = (update as unknown as { session: Record<string, unknown> }).session;
    expect(session.type).toBe('realtime');
    expect(session.instructions).toBe('broker-level');
    const audio = session.audio as { output: { voice?: string } };
    expect(audio.output.voice).toBe('verse');
  });

  test('emits session_opened on construction', async () => {
    const gateway = new StubGateway();
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway);

    const result = await broker.connect();
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    const iter = session.events();
    const next = await iter.next();
    expect(next.value?.kind).toBe('session_opened');
    await session.close();
  });

  test('sendText queues conversation.item.create + response.create', async () => {
    const gateway = new StubGateway();
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway);
    const result = await broker.connect({ modalities: ['text'] });
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    await session.sendText('hello');

    const create = gateway.session.sent[1];
    const respCreate = gateway.session.sent[2];
    expect(create.type).toBe('conversation.item.create');
    expect(respCreate.type).toBe('response.create');
    await session.close();
  });

  test('dispatches parallel tool calls within a single response turn', async () => {
    const gateway = new StubGateway();
    const tracer = new TracerSystem();
    const tool1 = new EchoTool('tool_a');
    const tool2 = new EchoTool('tool_b');
    const broker = new RealtimeVoiceBroker(
      'gpt-realtime',
      gateway,
      { modalities: ['text'], tools: [tool1, tool2] },
      tracer
    );

    const result = await broker.connect();
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    // Drain session_opened first.
    const iter = session.events();
    await iter.next();

    // Script a response containing two parallel function calls.
    gateway.session.emit({ type: 'response.created', response: { id: 'resp_1' } });
    gateway.session.emit({
      type: 'response.output_item.added',
      response_id: 'resp_1',
      item: { type: 'function_call', call_id: 'c1', name: 'tool_a', id: 'item_a' },
    });
    gateway.session.emit({
      type: 'response.output_item.added',
      response_id: 'resp_1',
      item: { type: 'function_call', call_id: 'c2', name: 'tool_b', id: 'item_b' },
    });
    gateway.session.emit({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_1',
      call_id: 'c1',
      name: 'tool_a',
      arguments: '{"x":1}',
    });
    gateway.session.emit({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_1',
      call_id: 'c2',
      name: 'tool_b',
      arguments: '{"y":2}',
    });
    gateway.session.emit({
      type: 'response.done',
      response: { id: 'resp_1', usage: { total_tokens: 10 } },
    });

    const events = await collectUntil(iter, (e) => e.kind === 'tool_batch_submitted');

    const dispatched = events.filter((e) => e.kind === 'tool_call_dispatched');
    const completed = events.filter((e) => e.kind === 'tool_call_completed');
    const submitted = events.find((e) => e.kind === 'tool_batch_submitted');

    expect(dispatched.length).toBe(2);
    expect(completed.length).toBe(2);
    expect(submitted).toBeDefined();
    if (submitted && submitted.kind === 'tool_batch_submitted') {
      expect(submitted.callIds.sort()).toEqual(['c1', 'c2']);
    }

    // Tool outputs should have been sent before response.create.
    const sent = gateway.session.sent;
    const outputs = sent.filter(
      (e) =>
        e.type === 'conversation.item.create' &&
        (e as { item?: { type?: string } }).item?.type === 'function_call_output'
    );
    expect(outputs.length).toBe(2);
    const trailingCreate = sent[sent.length - 1];
    expect(trailingCreate.type).toBe('response.create');

    const batches = tracer.getEvents({
      eventType: ToolBatchTracerEvent,
    }) as ToolBatchTracerEvent[];
    expect(batches.length).toBe(1);
    expect(batches[0].callCount).toBe(2);

    await session.close();
  });

  test('barge-in cancels in-flight response and aborts tool execution', async () => {
    const gateway = new StubGateway();
    const slow = new SlowAbortableTool('slow', 100);
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway, {
      modalities: ['audio'],
      tools: [slow],
      onInterrupt: 'drop',
    });

    const result = await broker.connect();
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    const iter = session.events();
    await iter.next(); // session_opened

    gateway.session.emit({ type: 'response.created', response: { id: 'resp_1' } });
    gateway.session.emit({
      type: 'response.output_item.added',
      response_id: 'resp_1',
      item: { type: 'function_call', call_id: 'c1', name: 'slow' },
    });
    gateway.session.emit({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_1',
      call_id: 'c1',
      name: 'slow',
      arguments: '{}',
    });
    gateway.session.emit({
      type: 'response.done',
      response: { id: 'resp_1' },
    });

    // Wait until tool is dispatched.
    let dispatched = false;
    while (!dispatched) {
      const next = await iter.next();
      if (next.done) break;
      if (next.value.kind === 'tool_call_dispatched') dispatched = true;
    }

    // User starts speaking — should cancel response + abort tool.
    gateway.session.emit({
      type: 'input_audio_buffer.speech_started',
      audio_start_ms: 0,
    });

    // Wait for the interrupted event.
    let interrupted = false;
    while (!interrupted) {
      const next = await iter.next();
      if (next.done) break;
      if (next.value.kind === 'interrupted') {
        expect(next.value.reason).toBe('barge_in');
        interrupted = true;
      }
    }

    expect(slow.aborted).toBe(true);
    const cancelEvent = gateway.session.sent.find((e) => e.type === 'response.cancel');
    expect(cancelEvent).toBeDefined();

    await session.close();
  });

  test('interrupt() with onInterrupt=drop does not submit tool outputs', async () => {
    const gateway = new StubGateway();
    const slow = new SlowAbortableTool('slow', 50);
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway, {
      modalities: ['text'],
      tools: [slow],
      onInterrupt: 'drop',
    });

    const result = await broker.connect();
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    const iter = session.events();
    await iter.next(); // session_opened

    gateway.session.emit({ type: 'response.created', response: { id: 'resp_x' } });
    gateway.session.emit({
      type: 'response.output_item.added',
      response_id: 'resp_x',
      item: { type: 'function_call', call_id: 'c9', name: 'slow' },
    });
    gateway.session.emit({
      type: 'response.function_call_arguments.done',
      response_id: 'resp_x',
      call_id: 'c9',
      name: 'slow',
      arguments: '{}',
    });
    gateway.session.emit({
      type: 'response.done',
      response: { id: 'resp_x' },
    });

    // Wait for dispatch then interrupt manually.
    while (true) {
      const next = await iter.next();
      if (next.done || next.value.kind === 'tool_call_dispatched') break;
    }

    await session.interrupt();

    // Drain a bit so the runner unwinds.
    for (let i = 0; i < 5; i++) {
      const next = await Promise.race([
        iter.next(),
        new Promise<IteratorResult<RealtimeEvent>>((resolve) =>
          setTimeout(
            () => resolve({ value: undefined as unknown as RealtimeEvent, done: true }),
            60
          )
        ),
      ]);
      if (next.done) break;
    }

    const outputs = gateway.session.sent.filter(
      (e) =>
        e.type === 'conversation.item.create' &&
        (e as { item?: { type?: string } }).item?.type === 'function_call_output'
    );
    expect(outputs.length).toBe(0);

    await session.close();
  });

  test('audioOutput yields decoded PCM frames from response.audio.delta', async () => {
    const gateway = new StubGateway();
    const broker = new RealtimeVoiceBroker('gpt-realtime', gateway, {
      modalities: ['audio'],
    });
    const result = await broker.connect();
    if (!isOk(result)) throw new Error('connect failed');
    const session = result.value;

    const audioIter = session.audioOutput();

    gateway.session.emit({ type: 'response.created', response: { id: 'resp_a' } });
    const pcm = new Int16Array([1, 2, 3, 4]);
    gateway.session.emit({
      type: 'response.audio.delta',
      response_id: 'resp_a',
      delta: encodeBase64Pcm16(pcm),
    });

    const frame = await audioIter.next();
    expect(frame.value && Array.from(frame.value)).toEqual([1, 2, 3, 4]);

    await session.close();
  });
});
