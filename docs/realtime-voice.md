# Realtime Voice

`RealtimeVoiceBroker` is the sibling of `LlmBroker` for **duplex voice + tool
sessions**. It targets OpenAI's Realtime API today and is designed to port
cleanly to Mojentic's Python, Elixir, and Rust implementations.

## Mental Model

Where `LlmBroker.generate()` is one-shot request/response, a realtime session
is a long-lived, bidirectional channel carrying audio, text, and tool calls
in parallel:

- One **session** = one open WebSocket. Configured once with voice,
  instructions, tools, turn detection, and audio formats.
- The model produces **turns**. A single turn can contain text, audio, and
  multiple `function_call` items emitted simultaneously.
- The client and server exchange typed events. Mojentic normalises these
  into a vendor-neutral `RealtimeEvent` union; OpenAI-specific event names
  stay inside the gateway.

## 30-Second Example

```typescript
import {
  OpenAIRealtimeGateway,
  RealtimeVoiceBroker,
  CurrentDatetimeTool,
} from 'mojentic';

const gateway = new OpenAIRealtimeGateway({ apiKey: process.env.OPENAI_API_KEY! });

const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
  instructions: 'You are a helpful, concise assistant.',
  voice: 'verse',
  modalities: ['text'],
  turnDetection: 'none',
  tools: [new CurrentDatetimeTool()],
});

const result = await broker.connect();
if (!result.ok) throw result.error;
const session = result.value;

await session.sendText('What is the time? Reply briefly.');

for await (const event of session.events()) {
  if (event.kind === 'assistant_text_delta') process.stdout.write(event.delta);
  if (event.kind === 'assistant_turn_completed') break;
}

await session.close();
```

## Configuration

`RealtimeVoiceConfig` exposes the subset of OpenAI's session config that
ports cleanly:

| Field | Type | Default | Notes |
|---|---|---|---|
| `instructions` | `string` | — | System prompt. |
| `voice` | `'alloy' \| 'verse' \| …` | — | Voice id. |
| `modalities` | `('audio' \| 'text')[]` | `['audio','text']` | |
| `inputAudioFormat` | `'pcm16' \| 'g711_ulaw' \| 'g711_alaw'` | `pcm16` | |
| `outputAudioFormat` | same | `pcm16` | |
| `turnDetection` | `'server_vad' \| 'none' \| ServerVadConfig` | `server_vad` | |
| `inputAudioTranscription` | `{ model:'whisper-1' } \| false` | — | |
| `tools` | `LlmTool[]` | `[]` | Same `LlmTool`s you already use. |
| `toolChoice` | `'auto' \| 'none' \| 'required' \| { name }` | `auto` | |
| `temperature` | `number` | — | |
| `maxResponseOutputTokens` | `number` | — | |
| `onInterrupt` | `'drop' \| 'submit' \| 'submit-completed-only'` | `'drop'` | See [Interruption](#interruption). |
| `providerExtras` | `Record<string, unknown>` | — | Escape hatch for provider-specific knobs. |

## Parallel Tool Calls

`RealtimeVoiceBroker` defaults to `ParallelToolRunner`. When a turn produces
multiple `function_call` items, they dispatch concurrently and the outputs
are submitted in a single batch before the model's follow-up response is
requested.

The same `LlmTool` interface used with `LlmBroker` works here unchanged.
Tools that opt in to `AbortSignal` (`run(args, ctx)`) get hard-cancelled
on interruption.

```typescript
const broker = new RealtimeVoiceBroker(
  'gpt-realtime-2',
  gateway,
  { tools: [new DateResolverTool(), new WebSearchTool()] },
);
```

## Audio I/O

Mojentic's runtime stays hardware-free: you pipe in PCM frames as an
`AsyncIterable<Int16Array>` and consume the assistant's PCM frames as an
async generator. Wire your own microphone / speaker via your platform's
device libraries.

The shipped examples come in two flavours:

- File-based (zero native deps):
  [`realtime_simple_voice.ts`](https://github.com/svetzal/mojentic-ts/blob/main/examples/realtime/realtime_simple_voice.ts)
  reads / writes WAV files, runs anywhere.
- Live mic + speaker:
  [`realtime_live_voice.ts`](https://github.com/svetzal/mojentic-ts/blob/main/examples/realtime/realtime_live_voice.ts)
  uses [`audify`](https://www.npmjs.com/package/audify) (a **devDependency**
  with prebuilt PortAudio binaries for macOS/Linux/Windows). The
  `examples/realtime/_audio.ts` helper wraps it as `micStream()` /
  `speakerSink()`.

```typescript
// In: stream mic PCM frames into the session.
await session.sendAudio(micFrames());

// Out: stream assistant audio frames to a speaker.
for await (const frame of session.audioOutput()) {
  speaker.write(frame);   // Int16Array PCM, 24kHz mono
}
```

## Events

The vendor-neutral `RealtimeEvent` union covers the full session lifecycle.
Delta events stay separate from final events so consumers can choose:
subscribe to deltas for a streaming UI, subscribe to the final
`assistant_text` / `assistant_transcript` for logging.

```typescript
for await (const event of session.events()) {
  switch (event.kind) {
    case 'user_transcript':       console.log('🧑', event.text); break;
    case 'assistant_transcript':  process.stdout.write(event.delta); break;
    case 'tool_call_started':     console.log('🔧', event.name); break;
    case 'tool_call_completed':   console.log('✅', event.name); break;
    case 'assistant_turn_completed': break;
    case 'interrupted':           console.log('⛔', event.reason); break;
    case 'error':                 console.error(event.error); break;
  }
}
```

For power users, `session.rawEvents()` exposes the unmodified OpenAI server
event stream.

## Interruption

`session.interrupt()` cancels the in-flight response, aborts in-flight tool
execution, and fires an `interrupted` event with `reason: 'manual'`. Barge-in
(server VAD detecting the user mid-assistant) fires the same flow with
`reason: 'barge_in'`.

What happens to in-flight tool outputs is controlled by
`RealtimeVoiceConfig.onInterrupt`:

- `'drop'` (default) — drop everything from the cancelled batch.
- `'submit-completed-only'` — submit outputs for tools that finished before
  the abort signal landed; drop the in-flight ones.
- `'submit'` — submit every output that eventually arrives.

Tools that observe `ToolRunCtx.signal` get hard-cancelled; tools that
ignore it run to completion and their outputs are still discarded under
`'drop'`.

## Lifecycle

`RealtimeSession` implements `Symbol.asyncDispose`, so the ergonomic form
on Node 22+ is:

```typescript
await using session = (await broker.connect()).value;
// ...use session...
// socket and event channels close automatically on scope exit.
```

Or call `await session.close()` explicitly.

## See Also

- [`examples/realtime/`](https://github.com/svetzal/mojentic-ts/tree/main/examples/realtime) — six runnable demos.
- [Tool System](/tool-usage) — the same `LlmTool` interface used everywhere.
