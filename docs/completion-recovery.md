# Completion recovery

Recovery is opt-in for Ollama, oMLX, and OpenAI chat completions. Existing calls
without `CompletionConfig.recovery` retain their original success, error, timeout,
and request-building behavior. An enabled policy defaults to **one wire attempt**.
Use `maxAttempts` to permit more; this includes the initial request.

```typescript
import {
  LlmBroker, OllamaGateway, Message, RecoveryError, RecoveryOptions,
} from 'mojentic';

const broker = new LlmBroker('your-model', new OllamaGateway());
const controller = new AbortController();
// The harness implements this check for the failed request's exact attempt ID.
// Its promise may stay pending; cancellation ends Mojentic's wait promptly.
const recovery: RecoveryOptions = {
  maxAttempts: 3,
  baseDelayMs: 200,
  delayCeilingMs: 5000,
  budgetMs: 20000,
  signal: controller.signal,
  admit: async ({ failure, signal }) => {
    return await harness.checkRecoveryAdmission(failure, signal);
  },
  onEvent: (event) => harness.recordSafeLifecycle(event),
};
const result = await broker.generate([Message.user('Summarize this')], undefined, { recovery });
if (!result.ok && result.error instanceof RecoveryError) {
  console.error(result.error.outcome, result.error.failure.httpStatus);
}
```

`harness` above is application-owned policy and persistence, not a Mojentic API.
The admission promise must resolve to `'allow'` or `'reject'`. A pending promise
never permits a resend. Its signal aborts when the wait ends or is cancelled.
An admission exception rejects recovery and remains available through explicit
inspection. Eligibility does not prove remote inference ended.

The same policy works at these entrypoints:

```typescript
await gateway.generate(model, messages, { recovery }, toolDescriptors);
await broker.generateResponse(messages, tools, { recovery });
await broker.generate(messages, tools, { recovery });
await broker.generateObject(messages, schema, { recovery });
await session.send('Next question', recovery);
```

For `generate` with recovery enabled, completed assistant/tool messages are
appended to the supplied message array, including on a later failure. `ChatSession`
preserves and sizes that history before throwing the original `RecoveryError`.
This lets the next caller retain evidence of completed tool actions. Recovery
never retries a tool, restarts a broker loop, or repeats earlier successful model
interactions. Each completion in a tool loop receives its own logical identity;
only its HTTP attempts share that identity. `generateObject` retains its existing
schema argument and does not gain tools or schema-validation capabilities.

## Transport migration

Recovery-enabled ordinary, structured, and streaming completions use Node's HTTP/HTTPS
request boundary, with one POST per engine attempt. Node `fetch` can silently
resend a POST after HTTP 421 even with `redirect: 'manual'`; it is therefore no
longer used for these recovery calls. A 421 is returned as a structured HTTP
failure under the default policy. All redirects are recorded as failures without
contacting the destination. Only the recovery engine can authorize another send.

Applications that intercept global `fetch` should use the sensitive `onWire` hook
for recovery request/response capture instead. The existing disabled
paths retain their transports. There are no new dependencies or policy defaults.
Admitted 503 recovery still reuses the exact encoded payload with distinct attempt
IDs under one logical request ID; completed tools are never resent by recovery.

## Policy and timing

Default eligibility is transport failure, HTTP 429, 500, 502, 503, or 504.
`retryableCategories` and `retryableStatuses` select eligible failures; HTTP needs
both category and status permission. Known 400/401/403 stay permanent even if
body transport fails or a caller selects them. Protocol errors and any observed
semantic output are never replayed. Partial ordinary/structured successful HTTP bodies fail closed; streaming
keepalive-only failures remain eligible for admission.
Provider error codes are retained only from a fixed known set; arbitrary codes
and request IDs are available only through inspection. Validated UUID request IDs
and known codes that echo encoded request contents or credentials are omitted.

For failed attempt `n`, full jitter is `jitter() * min(delayCeilingMs,
baseDelayMs * 2 ** (n - 1))`. The default base is 100 ms and ceiling is 30000 ms.
Zero base delay is supported. A supplied jitter value must be finite and in
`[0, 1]`. Durations must be finite nonnegative milliseconds within Node's timer
range, and `maxAttempts` must be a positive safe integer.

`Retry-After` accepts integer seconds or an RFC 1123 HTTP date. Past dates have
zero remaining delay. Invalid/absent values are explicit and do not replace the
jittered delay. Valid provider delays are minima. A minimum over the ceiling or
remaining recovery budget refuses the retry; it is never shortened.

`budgetMs` starts at the first completed failure using a monotonic clock.
`deadlineMs` is an absolute wall-clock timestamp. Both bound admission/backoff
and are rechecked before resending. Neither times out active generation, including
an admitted request that finishes after its recovery deadline. Enabled oMLX calls
therefore do not use the legacy ordinary-request timeout. Omitted recovery keeps
that timeout and oMLX's response-format warning behavior. Clock, sleep, and jitter
hooks allow deterministic tests. `AbortSignal` remains authoritative in requests,
admission, and backoff; cancelling HTTP does not prove remote termination.

Enabled requests use native fetch, with manual redirects and no SDK retry layer.
Payload and credential headers are encoded/copied once. Sensitive hook mutation
cannot change a later wire request. No invented identity/idempotency headers are
sent. A client UUID correlates attempts; it does not make inference idempotent.

## Failure, lifecycle, and sensitive inspection

`RecoveryError` carries `outcome`, final `failure`, and bounded `history` for all
completed HTTP attempts. Cancellation records a failed wire attempt before one
terminal cancellation event. Admission waits consume no wire attempts. Request
capture failure before sending has wire count zero and an empty history.
Failures contain numeric status, category, phase when known, explicit acceptance,
raw/observed/delivered progress, and eligibility separately from admission.
Safe formatting, JSON, and lifecycle events exclude body text, credentials, tool
arguments, headers, and original exception messages.

`onEvent` emits typed attempt, failure, admission, delay, retry, and terminal
transitions with complete local identities. Store these safe values separately
from model interaction/tool depth counters. Treat observers as synchronous
application callbacks; observer exceptions propagate and are not retries.

`onWire` is an explicitly sensitive hook. It receives independent request and
response byte/header snapshots, response status, and completeness, including
HTTP failures and partial bodies. Semantic evidence is accounted for before a
response capture callback. Capture failure is terminal and cannot create another
inference request. A body transport cause and a later capture cause are retained
separately. The callback must arrange its own access controls and persistence.
Successful response content/metadata retains its existing application-facing
meaning and should also be treated as sensitive.

```typescript
import { inspectRecoveryFailure } from 'mojentic';
// Explicit sensitive inspection, never default logging:
const evidence = inspectRecoveryFailure(error.failure);
// evidence?.cause retains the original object, not a reconstructed message.
// evidence?.bytes and headers are defensive copies.
// admissionCause, delayCause, and captureCause expose failing callback causes.
```

## Adapter capabilities and preserved semantics

These describe this implementation, not every server deployment. The completion
endpoints reviewed are [Ollama chat](https://docs.ollama.com/api/chat),
[oMLX's OpenAI-compatible API](https://github.com/jundot/omlx), and
[OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat/create).
No per-request remote cancellation/status/idempotency facility is used or claimed.

| Adapter | Client HTTP abort | Remote cancellation/status | Idempotency | Ambiguous resend without admission |
| --- | --- | --- | --- | --- |
| Ollama | Supported | Unsupported by adapter | Unknown | Refused |
| oMLX | Supported | Unsupported by adapter | Unknown | Refused |
| OpenAI | Supported | Unsupported by adapter | Unknown | Policy eligible failures allowed |

No adapter confirms termination for an exact request. Model unload/list/activity
is aggregate information, not termination evidence. Recovery preserves the
existing supported request encoders: Ollama sampling/context/predict/stop,
images, tools and `format`; oMLX temperature/token/top-p/top-k controls, tools,
`response_format` and existing reasoning-effort option; OpenAI model-specific
parameter adaptation, supported tools, image/history encoding and response
format. Unsupported controls remain unsupported. `LlmMessage` has no native
reasoning-history field; this feature adds none. Ordinary finish handling and
disabled-reasoning parity remain separate work.

## Streaming migration

Both `generateStream` and `generateStreamEvents` accept the same opt-in policy
through `CompletionConfig.recovery`. Omitted recovery retains the existing
transport, parsing, finish handling and tool contracts.

```typescript
for await (const result of broker.generateStream(messages, { recovery }, tools)) {
  if (result.ok) process.stdout.write(result.value);
  else if (result.error instanceof RecoveryError) {
    console.error(result.error.outcome, result.error.failure.progress);
  }
}

for await (const event of broker.generateStreamEvents(messages, { recovery }, { signal: controller.signal })) {
  if (event.type === 'content') process.stdout.write(event.text);
  else if (event.type === 'error' && event.error.recovery) {
    console.error(event.error.recovery.outcome, event.error.recovery.history);
  }
}
```

A retry may replace only an attempt with no observed reasoning, content, or tool
fragments. Even undelivered semantic bytes block replay, including when a capture
hook fails. Keepalive bytes alone do not block an eligible retry, but ambiguous
local execution still needs caller admission. Failure after semantic evidence
returns `RecoveryError.outcome === 'interrupted'`; the event API also uses
`interrupted_stream` and exposes the typed outcome as `event.error.recovery`.
Exhaustion cannot become successful completion.

Direct gateway chunks expose opt-in `reasoning` and `toolCallFragments` alongside
content. Partial calls never execute. Accepted terminal chunks carry completed
calls and provider `evidence`; rejected finishes retain evidence through
`inspectRecoveryFailure`. The broker continues its existing recursive tool loop,
retains completed assistant/tool history in the supplied message array when
recovery is enabled, and stops on recovery failure. Each subsequent completion
has a fresh logical request ID. Single-turn events continue to forbid tools.
`ChatSession.sendStream` has no recovery argument; use the broker entrypoint when
streaming recovery is needed.

Cancellation closes the local HTTP request and reader while a consumer is paused,
without waiting for its next iteration. Abort wins over queued content, terminal
telemetry, and completion. A failed actual attempt precedes exactly one cancelled
lifecycle event. Returning from iteration also closes owned resources. Neither
operation proves remote inference terminated. Both an explicit event API signal
and the recovery signal remain authoritative.

Streaming `onWire` receives exact response byte chunks, plus empty transport-end
markers. Concatenate response bytes per attempt to reconstruct the observed body.
`complete` reports HTTP EOF; a semantic terminal marker can close consumption
before HTTP EOF. Capture sequence indices reset per attempt. The hook is sensitive
and opt-in, and a failure is retained privately without another send. Ollama safe
lifecycle telemetry reports validated frame `progress` and numeric `metrics` before
success or failure, including length finishes. Decoded frame indices also restart
per attempt. Malformed frames produce no invented telemetry. Available provider
identity and usage remain in accepted completion evidence; failure metadata
omits request and credential echoes, while explicit inspection retains originals.

Realtime voice, embeddings, and residency operations are outside recovery scope.
See `RECOVERY-CONFORMANCE.md` for assertion locations, measured results and review
prerequisites. Whole-mission independent approval and cross-port alignment remain
unclaimed.
