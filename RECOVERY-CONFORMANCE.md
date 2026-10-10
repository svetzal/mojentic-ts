# TypeScript non-streaming recovery conformance

Scope: opt-in ordinary and structured HTTP completions through Ollama, oMLX,
and OpenAI. No streaming acceptance or cross-port parity claim. Git finalization
belongs to Foundry; this worktree contains uncommitted changes, with no release,
ref changes, sibling/harness changes, dependency upgrades, or live inference.

## Authority and reference

- Repository `TRANSIENT-RECOVERY-2026-10.md` and `RECOVERY-REQUEST-2026-10.txt`.
- The supplied October 10 correction plan's acceptance requirements.
- Exact Rust revision `4ca1ed279c02eab37827a1ed07c30e961155ecf3`, inspected
  read-only in `src/llm/recovery/{engine,types,frames}.rs`. The comparison covers
  separate eligibility/admission, immutable completion encoding, bounded histories,
  monotonic recovery budgets, semantic/partial-response replay guards, validated
  metadata, private original evidence, and cancellation after failure recording.
- TypeScript starting revision `a764be2553e85bd313efe91e2b503c4195959ab7`.
  Initial tree was clean; fetch confirmed `origin/main` matched HEAD. The explicit
  Foundry prohibition on ref changes superseded the plan's pull/rebase instruction.
- A separate October 10 supplement file was not found. Its location was requested;
  the supplied plan is the available October 10 authority. Reviewing any additional
  supplement text remains a whole-mission review gap.

## Public API and compatibility

`CompletionConfig.recovery` flows through `LlmBroker.generateResponse`,
`generate`, and `generateObject` to the maintained gateways' public `generate`.
`ChatSession.send(query, recovery)` uses the same policy and throws the original
structured `RecoveryError`. Recovery-enabled `generate` retains completed tool
messages in the supplied history. Session token sizing covers final failure.
The existing disabled path still clones broker history and uses legacy adapter
error handling, including oMLX timeout and response-format warnings.

The HTTP request is encoded once using existing adapter builders; retry hooks
cannot modify encoded messages, tools, images, schema, sampling, or supported
history. No native reasoning-history field, reasoning feature, unsupported control,
idempotency header, or tool support is added. Structured recovery validates JSON
syntax; the existing `generateObject` does not become a JSON Schema validator.
Streaming builders are unchanged. Enabled oMLX preserves successful warning
metadata but avoids logging raw provider Warning text; omitted recovery preserves
its legacy warning behavior and ordinary timeout.

Recovery capabilities describe adapter support: client abort supported; remote
per-request cancellation/status unsupported; idempotency unknown; no confirmed
remote termination source; streaming recovery pending. The reviewed provider
endpoint links and migration examples are in `docs/completion-recovery.md` and
`examples/completion_recovery.ts`.

## Behavioral proof before expansion

`.foundry/proof.json` links actual rejecting and corrected logs. The initial
public `LlmBroker.generateResponse` -> `OllamaGateway.generate` -> loopback HTTP
probe rejected legacy behavior because it completed the failed call instead of
holding admission pending. The corrected probe explicitly resolves admission,
mutates caller history while waiting, asserts full byte-for-byte request equality,
checks both distinct UUID attempt identities against exact lifecycle values, and
checks secret exclusion. It was recorded before the broader matrix and full gates.
The rejecting exit was 1 and corrected exit 0. No marker toggles or private helper
probes were used.

A second RED/GREEN probe added escaped partial JSON keys: the rejecting scanner
sent a second completion after escaped semantic content; the corrected lexical
scanner prevents this resend. Both captured logs are preserved in the evidence
manifest, alongside the original proof logs.

## Acceptance mapping

`src/llm/recovery-conformance.test.ts` parameterizes each ordinary and structured
case below across all three actual adapters. Ordinary calls use public
`LlmBroker.generateResponse`; structured calls use public `generateObject`.
The image/tool/schema immutability case also uses public gateway `generate`.
Every server listens on loopback and records received body buffers, URL, and
Authorization separately from sensitive wire hooks. No fetch/SDK mocks or model
execution are used. Only tool/tokenizer boundary doubles are injected.

| Acceptance | Actual test/assertions |
| --- | --- |
| 503 recovery | `recovers a 503…`: all request buffers exactly equal; concrete supported controls, messages, schemas, path and credentials; complete ordered transitions and exact identities shared with request/response hooks |
| Bounded 504 | `exhausts persistent 504…`: exactly three received buffers; complete numeric status/attempt history, unique attempt IDs, single logical ID, final failure identity, exact retained bytes and terminal lifecycle |
| Retry-After | `handles Retry-After…`: seconds/date/past/invalid/ceiling/budget; exact injected sleeper arguments, lifecycle delay values, refusal outcome and received bytes; no shortened minimum |
| Admission | `keeps admission pending…`: server has only the first exact path while pending; allow/reject gates the next equal payload; explicit next attempt and ambiguous acceptance; local no-hook calls return admission-required |
| Admission exceptions | `retains an admission exception…`: rejection is not reported as deadline expiry, original callback object available only by inspection |
| Cancellation | `cancels during…`: request, unresolved admission, and backoff; one failed-attempt record before one terminal cancellation, no extra actual sends; pre-send cancellation has zero history/count |
| Success/cancellation race | `cancellation from successful body capture…`, `gives cancellation in a synchronous success observer…`: no success returned; actual wire attempt retained; final delivered progress zero and ordered lifecycle asserted |
| Permanent truncated HTTP | `retains permanent truncated HTTP…`: 400/401/403 remain permanent despite body transport failure and explicit caller status selection; exact bytes/progress, actual original transport cause, incomplete capture, one send |
| Malformed/partial HTTP 200 | `does not replay…`: malformed JSON, invalid shape, partial successful body remain ineligible even when callers select protocol/transport; original decoding/transport causes and bytes inspected |
| Partial semantic evidence | `recognizes partial…`: content/reasoning/tools/escaped-content/quoted-control prefixes at HTTP 503; semantic classification, raw byte equality, incomplete capture and no second send; quoted control text cannot invent tool fragments |
| Keepalive | `keeps raw keepalive…`: three raw bytes, zero observed/delivered semantics, eligible retry and exact equal sends |
| Capture failure | `accounts for semantic progress…`, `makes request capture failure…`, `preserves both body transport and capture causes…`: progress before callback, callback identity retained, terminal failure, no inference resend; pre-request failure sends nothing |
| Transport | `retains transport causes…`: real socket reset, observed request buffers, original transport object, empty incomplete response capture, one eligible retry without SDK resends |
| Backoff/limits | `uses bounded exponential full jitter…`: exact 0/100/250-ms delays for 0/.5/1 injected jitter; `rechecks the recovery budget…` proves no send at deadline; unresolved admission budget aborts its signal |
| Active generation | `does not apply recovery budgets…`: successful active response completes after expired deadline/budget; no generation timeout introduced |
| Redirects | `rejects redirects…`: HTTP 307 is terminal and the server sees one request, with one request/response hook pair |
| Eligibility vs permission | `honors category selection…` and `requires ambiguous local admission…`: HTTP category/status both needed; local ambiguity refuses resend without hook; OpenAI policy admission distinct |
| Default/disabled | `keeps the opt-in default…` proves max one; `keeps disabled recovery…` retains legacy status errors with no lifecycle; existing gateway/streaming tests exercise untouched behavior |
| Privacy | `omits echoed credential/payload metadata…`, `keeps recognized metadata private…`: valid UUID/known code echoes disappear from safe metadata/events/errors; raw bytes, headers, and causes remain available by explicit inspection |
| Immutable semantic request | `preserves image and completed tool history…`: exact server/hook byte equality after caller mutation; concrete model/images/schema/tools/arguments/history mapping, adapter-specific tool IDs and controls |
| Broker/session tools | `preserves completed tools exactly once…`: public `generate` and `ChatSession.send`, exact invocation arguments once, assistant/tool history persists, follow-up payloads equal, final structured failure preserved; logical completion identity changes across the tool boundary |

The broker/session tool assertions intentionally preserve Ollama's existing
message encoder: it does not add OpenAI `tool_call_id` to the Ollama body.
Request UUIDs are local correlation only; actual server sends are paired with
captured bytes and exact attempt identities, with no invented identity headers.

## Results and retained evidence

Actual gate commands, exit codes, complete capture paths, SHA-256 source hashes,
reference revisions, and durable artifact directory are recorded in
`.foundry/evidence-manifest.json`. `.foundry/proof.json` uses the required behavioral
shape and its referenced combined logs exist. The artifacts are copied outside
the transient worktree under `/home/svetzal/.foundry/tool-logs/`.

The final gate results are recorded after all implementation edits. Required
checks include format, zero-warning lint, format check, full tests, coverage with
the unchanged global 70% floors, production audit at moderate severity, unfiltered
audit, outdated-dependency inspection, library build, and VitePress docs build.
No audit allowlist, dependency pin, coverage exclusion, floor, or runtime pin is
modified. Security findings, if any, must be surfaced rather than suppressed.

## Final measured results

All 274 new public recovery cases passed within the full 48-suite, 1,144-test run.
The full coverage run also passed: statements 85.38%, branches 79.31%, functions
89.41%, lines 85.91%; the existing 70% floors are unchanged.

| Check | Actual exit / result |
| --- | --- |
| `npm run format`, `npm run lint`, `npm run format:check` | 0 each; zero lint warnings |
| `npm test`, `npm test -- --coverage` | 0 each; 1,144 passed |
| `npm audit --omit=dev --audit-level=moderate`, `npm audit` | 0 each; zero vulnerabilities |
| `npm outdated` with writable temporary npm cache | 1; informational Prettier 3.9.9 -> 3.9.10 update available, no upgrade made |
| `npm run build` | 0 |
| `npm run docs:build` | 0; generated recovery HTML; 27 VitePress/Rolldown bundle-assignment diagnostics |
| Baseline documentation build from untouched HEAD | 0; 26 instances of the same dependency compatibility diagnostic |

The initial outdated check failed because the default npm cache was read-only.
It was rerun with a writable task-specific cache. The docs diagnostic occurs for
the new page as well as baseline pages. The existing dependency compatibility
issue remains visible in both logs; resolving it is outside the recovery-only,
no-dependency-change scope. No warning or advisory suppression was added.

## Explicit remaining gaps

- Streaming recovery: all ordinary/structured acceptance above is non-streaming.
  Streaming admission, partial reasoning/content/tool interruption, per-frame
  evidence/capture, interrupted-stream result APIs, and streaming broker/session
  tool recovery acceptance remain pending. Existing stream tests are regression
  checks, not streaming recovery proof.
- Whole-mission independent review: Foundry/source review, any separate October 10
  supplement text, and cross-port/reference conformance assessment have not been
  signed off. This report is evidence for review, not parity approval.
- Remote request cancellation/status/idempotency and exact termination proof are
  not implemented or claimed. Model activity/unload is not sufficient evidence.
- Live inference, harness registration/integration, benchmark restart, model
  efficacy, original timeout origin, and coordinated release are outside scope.
