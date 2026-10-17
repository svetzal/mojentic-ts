# Streaming Responses

Streaming allows you to receive LLM responses chunk-by-chunk as they are generated, improving perceived latency for users.

## Client first-token timing

OpenAI, Ollama and oMLX measure streaming latency with a monotonic client clock,
starting immediately before HTTP dispatch. Constructing a lazy generator starts
no timer and sends no request. Timing works with recovery disabled or enabled.

Terminal `completed.metadata.metadata` and `error.evidence.metadata` contain:

| Field | Meaning |
| --- | --- |
| `request_duration_ms` | Milliseconds from dispatch to terminal success or failure. |
| `time_to_first_token_ms` | Milliseconds to the first nonempty content, thinking or tool-argument fragment. Absent if none arrives. |
| `first_token_kind` | `content`, `thinking` or `tool_call`, paired with first-token time. Absent if none arrives. |

Keepalives, empty deltas, and tool names without argument fragments do not count.
The first observation is retained when later content arrives. Thinking counts
for timing even on paths that discard thinking from public output; this adds
no reasoning controls or reasoning delivery API. Tool arguments count before
the completed call. Event streams still reject tool requests and never execute
them; a name-only tool request can therefore fail before any token is observed.
OpenAI and oMLX legacy `function_call.arguments` fragments count too; empty
arguments do not count. With recovery enabled, timing observes received frames
before awaiting the response `onWire` callback. A delayed, rejected or cancelled
capture retains the original token time, while public delivery still waits for
capture to succeed. Split frames count when their complete wire line arrives.

```typescript
for await (const event of broker.generateStreamEvents(messages)) {
  if (event.type === 'completed') {
    console.log(event.metadata.metadata?.time_to_first_token_ms);
    console.log(event.metadata.metadata?.first_token_kind);
    console.log(event.metadata.metadata?.request_duration_ms);
  } else if (event.type === 'error') {
    console.log(event.error.evidence?.metadata);
  }
}
```

Direct gateway `generateStream` calls put the same fields in terminal
`StreamChunk.evidence.metadata` and terminal errors' `evidence.metadata`.
The broker's legacy stream and `ChatSession.sendStream` continue yielding text;
use the gateway chunks or broker event API to read successful terminal metrics.
Session failures retain the gateway error and timing evidence.

Provider metrics stay separate: Ollama durations keep their original names
and units; oMLX's reported `usage.time_to_first_token` stays in seconds in
`metadata.usage`. The new client fields use milliseconds and include queueing
and network time. Recovery keeps its existing evidence redaction rules.
For an enabled logical completion, the timer spans its first dispatch through
terminal delivery, including any authorized retry. Each tool-loop completion
starts a new timer. A request rejected before dispatch has no elapsed request
measurement. Stopping iteration still cancels the stream without manufacturing
an additional terminal event.

## Basic Streaming

Use `broker.generateStream` to get an async generator of chunks:

```typescript
import { LlmBroker, OllamaGateway, Message, isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const messages = [Message.user("Tell me a story.")];

for await (const result of broker.generateStream(messages)) {
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

## Streaming with Tools

Mojentic supports streaming even when tools are involved. The broker will pause streaming to execute tools and then resume streaming the final response.

```typescript
import { DateResolverTool } from 'mojentic';

const tools = [new DateResolverTool()];

for await (const result of broker.generateStream(messages, {}, tools)) {
  // The stream will contain text chunks.
  // Tool execution happens transparently in the background.
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

## Structured output in streaming requests

Set `responseFormat` on the `CompletionConfig` to request a response format in a
streaming request. The gateways send the same field that they send for a
non-streaming request.

| `responseFormat` | OpenAI `response_format` | Ollama `format` |
| ---------------- | ------------------------ | --------------- |
| not set | not sent | not sent |
| `{ type: 'text' }` | `{ type: 'text' }` | not sent |
| `{ type: 'json_object' }` | `{ type: 'json_object' }` | `"json"` |
| `{ type: 'json_object', schema }` | `{ type: 'json_schema', json_schema: { name: 'response', schema } }` | the schema |

```typescript
const schema = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

for await (const result of broker.generateStream(messages, {
  responseFormat: { type: 'json_object', schema },
})) {
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

The request field records what you asked for. It does not prove that the
provider enforced it. Parse and validate the complete content before you use it.

## Single-turn streaming with terminal completion evidence

Use `broker.generateStreamEvents(messages, config, options)` when an
incomplete response must never be used as a result. The method yields events of
the type `LlmStreamEvent`:

| Event | Meaning |
| ----- | ------- |
| `{ type: 'content', text }` | Visible assistant content, in order |
| `{ type: 'completed', metadata }` | Terminal success |
| `{ type: 'error', error }` | Terminal failure. `error` is a `StreamEventError` |

Exactly one terminal event ends every stream. No event follows it.

`metadata` is a `CompletionEvidence`: `finishReason`, `usage`, `providerModel`,
and `metadata` (the provider metadata map, for example Ollama timings). A field
that the provider did not report is `null`.

```typescript
import { LlmBroker, Message, OpenAIGateway } from 'mojentic';

const broker = new LlmBroker('gpt-4o', new OpenAIGateway());
let text = '';

for await (const event of broker.generateStreamEvents([Message.user('Summarize the report.')])) {
  switch (event.type) {
    case 'content':
      text += event.text;
      break;
    case 'completed':
      console.log(text, event.metadata.usage);
      break;
    case 'error':
      console.error(event.error.reason, event.error.evidence);
      break;
  }
}
```

### Completion rules

- OpenAI-compatible providers: success needs a `finish_reason` of `stop` and
  the `data: [DONE]` marker. `[DONE]` with a different finish reason gives an
  `incomplete_completion` error.
- Ollama: success needs a final frame with `done: true` and a `done_reason` of
  `stop`. A different or missing `done_reason` gives an
  `incomplete_completion` error.
  Ollama servers that are too old to send `done_reason` cannot use this API:
  every stream from them ends with `incomplete_completion`.
- The `incomplete_completion` error keeps the evidence in `error.evidence`:
  finish reason, usage, provider model, and provider metadata.

Other values of `error.reason`:

| Reason | Cause |
| ------ | ----- |
| `incomplete_stream` | The stream ended without a terminal marker. `error.evidence` keeps what arrived before the end (for example model and usage), with `null` fields when nothing arrived |
| `provider_error` | The provider sent an error frame, or a non-success HTTP status. `error.detail` holds the payload, or `{ status, body }` for an HTTP status |
| `unexpected_tool_calls` | The provider asked for a tool call |
| `invalid_stream_event` | A frame could not be understood |
| `stream_events_unsupported` | The gateway does not implement this API. No request was sent |
| `request_failed` | The connection or the body read failed |
| `cancelled` | The `AbortSignal` in `options.signal` fired |

Content that you received before an `error` event is evidence of what the
provider sent. It is not a result. Do not act on it, even when it parses as
valid JSON.

### Behaviour

- The method supplies no tools, forces `maxToolIterations` to 0, and does not
  retry.
- It sends one HTTP request. To cancel that request, stop the iteration
  (`break`, `return`, or an exception in the loop body), or abort
  `options.signal`. An abort while you continue to iterate ends the stream with
  a `cancelled` error.
- A `break` takes effect when the loop gets control, which is after the next
  event arrives. Use `options.signal` to cancel a request that is waiting for
  the provider.
- The OpenAI and Ollama gateways support this API. A custom gateway supports it
  when it implements the optional `LlmGateway.generateStreamEvents` method.
  Other gateways give a `stream_events_unsupported` error before any request.
- With a tracer, the broker records the LLM call when the request starts. At the
  terminal event, it records the response with the content so far and the
  evidence fields. If you stop the iteration before the terminal event,
  the tracer has the call and no response. This is not an error. See [Tracer System](./tracer.md#provider-evidence-in-response-traces).

The existing `generateStream` API keeps its behaviour. It does not give this
terminal proof.
