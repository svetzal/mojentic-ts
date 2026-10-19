# TypeScript completion recovery conformance

This is the current local verification map for the unchanged recovery contract.
The tested base is `dcec7d48906fc7f2cd61cdcc6f5df45f63b1875f` plus this worktree's
uncommitted test/tooling/documentation changes. Production recovery, streaming
recovery and the Node HTTP/HTTPS completion transport are unchanged.

The local `TRANSIENT-RECOVERY-2026-10.md` matches the revised parent contract,
including the October 12 robustness amendment and in-process testing policy.
`RECOVERY-REQUEST-2026-10.txt` is unchanged. No sibling or running-service
boundary changed; verification here covers source public APIs and a fresh
installed packed consumer. No external repository verification is claimed.

## Binding decisions and surviving assertions

Paths are relative to `src/llm/`. These tests use in-process transport streams,
injected clocks/sleepers or the deterministic Jest runner. They preserve provider
and ordinary/structured/stream/session route matrices. Exact request, destination,
authorization, response and lifecycle assertions remain, including unmasked IDs.

| Binding decision | Surviving executable evidence | Existing scope/limitation | Concrete assertions |
| --- | --- | --- | --- |
| Recovery: typed category, provider, ordinary/structured/streaming operation, status, phase, acceptance, classification, progress, IDs and bounded history | `recovery-conformance.test.ts`: `recovers a 503 with exact bytes, supported controls, history, identities, and ordered lifecycle`; `exhausts persistent 504 with full inspectable history and exactly three actual sends` | Covered for maintained OpenAI/Ollama/oMLX completion adapters; no Anthropic adapter in this port  | Assert typed provider/operation/status/acceptance/progress and full 504 history, with one-based distinct attempt IDs. |
| Stable optional metadata, original private causes; safe formatting/serialization/events | `recovery-conformance.test.ts`: `keeps recognized metadata private when echoed from credentials or payload`; `omits echoed credential/payload metadata and exposes original headers only on inspection`; `retains transport causes and accounts for failed sends without hidden retries` | Covered; UUID allowlist is intentionally stricter than arbitrary provider IDs  | Assert safe metadata omitted for outbound echoes; explicit inspection retains the original headers and cause identity. |
| Opt-in only, default one wire attempt, legacy success/error and tool behavior preserved | `recovery-conformance.test.ts`: `keeps the opt-in default to one wire attempt`; `keeps disabled recovery to one legacy attempt`; `item 8 leaves recovery-disabled length handling unchanged` | Covered  | Assert the complete legacy response/error and a single encoded request when disabled or unspecified. |
| Policy controls and typed validation before capture/HTTP, including every jitter sample | `recovery-conformance.test.ts`: `prevalidates valid jitter endpoints even when the first attempt succeeds`; `does not sample custom jitter when no retry is possible`; item-8 parameterized routes from `recovery-typed-errors-v1.json` | Covered  | Assert typed policy error before request capture/dispatch; valid endpoints accepted and later invalid samples rejected. |
| Default transport, 429, 500/502/503/504 eligibility; permanent/auth/protocol errors excluded; caller categories/statuses affect selection | `recovery-conformance.test.ts`: `honors category selection independently from HTTP status selection`; parameterized permanent statuses and malformed/partial/shape cases. `streaming-recovery-conformance.test.ts`: `refuses unselected categories and statuses without invoking admission`; `keeps complete history when a later admission completes without returning` (503 then 502) | **Evidence gap**: no HTTP 500 case was found, and caller selection is tested by excluding a category/permanent status rather than positively selecting an otherwise excluded eligible status. Partial semantic replay remains forbidden  | Assert selected category changes classification and permanent/protocol failures never invoke admission; retain the stated 500/positive-selection gap. |
| Bounded exponential full jitter; injectable clock/sleeper; ceiling and Retry-After minimum | `recovery-conformance.test.ts`: `uses bounded exponential full jitter for every retry`; `honors Retry-After $name without shortening delay` using `retry-after-fixtures.json` | Covered  | Assert exact requested sleep values from bounded exponential jitter and Retry-After, never shortened to fit a budget. |
| All HTTP-date forms, malformed dates/weekday, past dates, seconds, budget/ceiling refusal | Same fixture family in ordinary, streaming and session conformance; `rejects a malformed RFC850 weekday through public HTTP recovery` | Covered; existing v2 fixtures retained  | Assert the same v2 fixture delay/date/invalid interpretation and refusal outcomes in ordinary, streaming and session routes. |
| Budget from first failure; absolute deadline applies to admission/resend, never active generation; recheck before dispatch | `recovery-conformance.test.ts`: `does not apply recovery budgets or deadlines to active generation`; `cancels an unresolved admission at the recovery budget and aborts its signal`; `rechecks the recovery budget immediately before sending after admission and delay` | Covered  | Assert expired recovery deadlines do not cut off active generation, pending admission aborts, and expiry prevents the next send. |
| No hidden transport retries/redirects; exact count and IDs on actual sends only | `recovery-conformance.test.ts`: `accounts for a terminal 421 without a hidden transport resend`; redirect/status matrices. `recovery-http.test.ts`: `holds ambiguous admission pending, freezes request bytes, and reports exact wire identities` | Covered  | Assert 421/redirect status is terminal, destination unchanged, request bytes exact and logical/attempt IDs unmasked at the transport boundary. |
| Invoke async admission before resend; allow/reject/wait; rejection preserves original failure | `recovery-http.test.ts` same pending-admission case; `recovery-conformance.test.ts` allow/reject matrix; packaged probe explicit reject versus allow | Covered  | Assert admission remains pending before allow; reject retains the original failure and no second request; allow reuses frozen bytes. |
| Absent admission hook: remote eligible retry allowed; ambiguous local retry requires admission unless acceptance is no | `recovery-conformance.test.ts`: `requires ambiguous local admission while OpenAI may use policy admission`; `streaming-recovery-conformance.test.ts`: `requires explicit admission for ambiguous local sends` | Covered  | Assert remote/local policy outcomes, explicit admission requirement and unchanged original 504 failure. |
| Admission without decision/exception has distinct reason; no resend | `recovery-conformance.test.ts`: `keeps complete history when a later admission completes without returning`; `retains an admission exception without calling it deadline exhaustion`; `propagates an omitted admission return through the public session` | Covered  | Assert admission-without-decision and exception remain distinct from rejection/deadline and preserve full attempt history. |
| Five capability statuses with endpoint citations/dates; termination unknown; no invented idempotency/remote termination or model unload | `recovery-capabilities.test.ts` provider/value matrix and `should retain the generic snapshot for existing imports`; `recovery-http.test.ts` headers/identity assertions | Covered for three maintained adapters; clientAbort/remote facilities retain documented unknown/unsupported values, not a support claim  | Assert every advertised capability status and citation/date, with exact-attempt termination unknown. |
| Keep raw progress distinct from observed/delivered semantics; keepalive is nonsemantic | `recovery-conformance.test.ts`: `keeps raw keepalive progress separate from observed and delivered semantics`; streaming keepalive matrices | Covered  | Assert raw bytes increase for keepalives, with zero semantic progress, separately from observed and delivered content/reasoning/tools. |
| Ordinary/structured/streaming use immutable encoded payload, tools, history and controls across admitted attempts | `recovery-conformance.test.ts`: `preserves image and completed tool history plus descriptors with an immutable encoded schema`; `streaming-recovery-conformance.test.ts`: `recovers with immutable supported prior history, tools and temperature` | Covered  | Assert full image/tool/history/schema payloads and controls are immutable across admitted retries, including endpoint and authorization. |
| Partial reasoning/content/tool fragments stop replay, including observed but undelivered bytes; no partial structured parse/tool dispatch/history | `recovery-conformance.test.ts` semantic/capture matrices; `streaming-recovery-conformance.test.ts` public session content/reasoning/tools interruption families and `observes escaped semantic keys before a capture failure` | Covered  | Assert partial semantics forbid retry, preserve typed progress, omit incomplete history, and execute no partial tool. |
| Completed tool calls execute once; tool depth distinct from retry budget; tool-follow-up is separate completion | `streaming-recovery-conformance.test.ts`: `broker executes completed tool once when the subsequent completion fails`; `session recovery proof preserves completed tools and exact admitted follow-up bytes`; `first-token-http.test.ts`: `executes a completed streamed tool once and sends exactly one follow-up request` | Covered  | Assert exact tool arguments/results and execution once; retry bytes equal the follow-up request rather than the earlier completion. |
| Exhaustion/interruption cannot become complete success; length stays typed through broker/session | `recovery-conformance.test.ts` item-8 route matrix; `item 8 rejects length tool responses through the session with typed finish evidence` | Covered  | Assert typed length/capture errors survive broker and session APIs with failure evidence and no successful completion. |
| Lifecycle transitions include safe phase/category/eligibility/reason/acceptance/delay/operation/progress/identities | `recovery-conformance.test.ts` exact ordered 503 lifecycle assertions; `streaming-recovery-conformance.test.ts`: `interrupts observed %s without replay or incomplete tool execution`; `retains original capture cause and observed/undelivered %s through session` | Covered  | Assert exact ordered event arrays and safe fields, same logical ID, distinct attempt IDs, and no payload/credential leakage. |
| Explicit exact wire capture of failed/successful/partial responses; capture failure terminal with private typed cause | `recovery-conformance.test.ts`: `makes request capture failure terminal without sending HTTP`; `preserves both body transport and capture causes on a partial failure`; packaged `ts-packaged-library-v1` exact request comparison | Covered; capture evidence is opt-in  | Assert exact failed/success/partial request/response captures; capture failure retains cause identity and cannot authorize another send. |
| Cancellation authoritative in request/admission/backoff; pending hooks abort; paused-consumer resources close without claiming remote termination | `streaming-recovery-conformance.test.ts`: `closes an active response while consumer is paused before delivering cancellation`; `cancels buffered terminal frames while paused without storing final assistant text`; active/admission/backoff matrix | Covered  | Assert abort closes the owned response before next iteration, records the attempt before cancellation, and never invents remote termination. |
| oMLX recovery keepalive model frames change neither frame index nor metadata | `streaming-recovery-conformance.test.ts`: `recovers keepalive-only interruption with explicit admission and fixed request bytes`; streaming oMLX frame-index assertions | Covered  | Assert keepalive frames change neither semantic progress, frame index nor provider metadata. |
| Migration example/capability table; completion scope excludes realtime and embeddings | `docs/completion-recovery.md`; public-export probe; capability tests | Documented; no realtime/embedding recovery claim  | Assert public exports/capabilities from the installed artifact; document completion-only scope and migration examples. |

## Enforcement and package verification

`recovery-http.test.ts` exercises pending ambiguous admission through the public
broker, checks the full initial encoded request, mutates caller input while
pending, then verifies that the admitted resend uses the original bytes and the
exact ordered lifecycle with shared logical/distinct attempt identities.
`streaming-recovery-http.test.ts` and `replacement-proof-http.test.ts` preserve
partial-stream cancellation/resource cleanup and exact admitted follow-up bytes.
The transport double's response destruction represents I/O interruption; it does
not establish remote inference termination.

`scripts/test-support/no-network.cjs` rejects sockets, listeners and DNS.
`test-boundary.test.ts` and the installed consumer run the identical
`ts-in-process-boundary-v1` executable. It verifies installed guard integrity and
rejection without socket/listener construction, then verifies an exact gateway
error and empty handler records for an unknown destination, followed by the full
configured request and caller-visible reply. Transport consumers depend only on
the adapter’s `TransportRequest`/`TransportResponse` types; interruption uses
response destruction with unchanged lifecycle semantics. Jest uses fixed virtual time without a real
sleep or a wall-clock threshold. Tool concurrency asserts start/completion order;
agent and realtime tests observe completion and interruption directly.

`npm run verify:package` runs `ts-packaged-library-v1`: a fresh offline install
from local tarballs, installed public declarations and runtime exports, explicit
rejection versus admitted recovery, exact request/response captures and IDs,
metadata/timing and shared reasoning/profile/sampling/history contracts. Network
access is denied throughout package subprocess execution; real timers are denied
in the installed consumer. Local runtime dependency tarballs make registry/cache
access unnecessary. No dependency or version change was required.

See [the parts 1–3 map](CONFORMANCE-3.0.0.md#parts-1–3-decision-to-test-map)
for reasoning/history, metadata, request fidelity and all current executable
hashes shared by source and packed-consumer verification. That document records
the final gate results. Historical measured clocks, server traces and old command
counts are not evidence for this correction; git retains those previous reports.
