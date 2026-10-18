# 3.0.0 bounded readiness assessment — 2026-10-17

**Coordinated release remains pending.** Native reasoning history continuity is
implemented and locally verified through public APIs, production HTTP gateways
and a fresh installed packed artifact. Retention is opt-in; native reasoning
stays separate from content and tool results. The existing six-effort mappings,
profile selection, recovery admission/progress and timing behavior are preserved.
Other evidence gaps in the decision matrix remain outside this correction.
Package, lockfile and runtime versions are unchanged. No publication, consumer
migration, ref mutation or sibling edits occurred.

## Authority and source identity

The initiative brief SHA-256 was verified against the supplied value:
`ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e`.
The isolated worktree's `../RELEASE-3.0.0.md` link does not resolve. The binding
files were read, without mutation, in
`/home/svetzal/Work/Projects/Personal/mojentic-unify` at
`ef9339c6a9682ed5f060bd690b738f6b8eea1d2d`:

| Contract | SHA-256 |
| --- | --- |
| RELEASE-3.0.0.md | `ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e` |
| TRANSIENT-RECOVERY-2026-10.md, October 12 amendment included | `a53a3a4eb118fa4687dd703d6ce918dd40dd6cb4eda796abc6c429a6e932e7a3` |
| REASONING-PROTOTYPE-2026-10.md | `0a40f3ad45c593bc779411021e45db569e73d3ecce86c99b201e7f8ebb656809` |
| MODEL-METADATA-2026-10.md, October 17 timing decisions included | `d9945dca45ce09e2163843263a75b5e93028b00ee1baf191fc3ff13396830e9c` |

Previous assessment source: `54171796a2b02c0f0170d0758d2e3c693ad027c9`, plus
the assessment, package verification and gate changes. Cycle 18 correction source:
`4be3588c94dbf9956e2a25e23a1f943b90e8a975` (preserved cycle 17) plus the
then-uncommitted worktree diff identified in the reasoning section below. Production
changes in cycle 18 were limited to OpenAI pre-dispatch configuration
validation and public JSDoc. Six-value public types and Ollama/oMLX mappings
from the preserved work are retained. Foundry owns finalization.
The preceding documentation-only correction started at
`5194643cb8842a26a150765f04f9ba35105eddec`; its scope and fresh results are
recorded in its own section. Production code, fixtures, versions and dependencies
were unchanged in that run. The current profile correction starts at
`deb0bdd13d10fe578e5f72a0fe70432c447d6ff5`; fresh evidence is recorded below.
[Earlier evidence](audit/CONFORMANCE-3.0.0-history.md) retains its original source
revisions, commands, hashes and counts; none of those counts are substituted for
this run. Historical counterpart prerequisites are superseded by the policy below.

## Binding library validation policy

The library self-validates through its public API and built tarball, installed
into a fresh consumer directory, against its own binding documents and executable
cases. No dependent must build against this unreleased library, and no other
port must run this port's executable snapshot before library readiness can be
assessed. Scripted responses prove declared local protocol behavior, not live
provider efficacy. Consumer adoption after publication is separately authorized
work in each consumer repository. Changed boundaries between running services
still need paired verification of the same versioned contracts. This task changes
no such boundary. There is no prepublication counterpart-verification blocker.
The parent PARITY update and six-port release coordination remain owner work.

## Current parts 1–3 decision matrix

Paths below are relative to `src/llm/` unless stated otherwise. Parameterized
names identify the executable family, including its provider/route cases.
“Covered” means current local tests exercise that decision, not complete release
readiness. The packaged probe samples representative behavior; the full Jest
suite supplies the broader decision coverage. A gap is explicit where complete
implementation or evidence was not established.

| Binding decision | Named executable evidence or explicit gap | Assessment |
| --- | --- | --- |
| Recovery: typed category, provider, ordinary/structured/streaming operation, status, phase, acceptance, classification, progress, IDs and bounded history | `recovery-conformance.test.ts`: `recovers a 503 with exact bytes, supported controls, history, identities, and ordered lifecycle`; `exhausts persistent 504 with full inspectable history and exactly three actual sends` | Covered for maintained OpenAI/Ollama/oMLX completion adapters; no Anthropic adapter in this port |
| Stable optional metadata, original private causes; safe formatting/serialization/events | `recovery-conformance.test.ts`: `keeps recognized metadata private when echoed from credentials or payload`; `omits echoed credential/payload metadata and exposes original headers only on inspection`; `retains transport causes and accounts for failed sends without hidden retries` | Covered; UUID allowlist is intentionally stricter than arbitrary provider IDs |
| Opt-in only, default one wire attempt, legacy success/error and tool behavior preserved | `recovery-conformance.test.ts`: `keeps the opt-in default to one wire attempt`; `keeps disabled recovery to one legacy attempt`; `item 8 leaves recovery-disabled length handling unchanged` | Covered |
| Policy controls and typed validation before capture/HTTP, including every jitter sample | `recovery-conformance.test.ts`: `prevalidates valid jitter endpoints even when the first attempt succeeds`; `does not sample custom jitter when no retry is possible`; item-8 parameterized routes from `recovery-typed-errors-v1.json` | Covered |
| Default transport, 429, 500/502/503/504 eligibility; permanent/auth/protocol errors excluded; caller categories/statuses affect selection | `recovery-conformance.test.ts`: `honors category selection independently from HTTP status selection`; parameterized permanent statuses and malformed/partial/shape cases. `streaming-recovery-conformance.test.ts`: `refuses unselected categories and statuses without invoking admission`; `keeps complete history when a later admission completes without returning` (503 then 502) | **Evidence gap**: no HTTP 500 case was found, and caller selection is tested by excluding a category/permanent status rather than positively selecting an otherwise excluded eligible status. Partial semantic replay remains forbidden |
| Bounded exponential full jitter; injectable clock/sleeper; ceiling and Retry-After minimum | `recovery-conformance.test.ts`: `uses bounded exponential full jitter for every retry`; `honors Retry-After $name without shortening delay` using `retry-after-fixtures.json` | Covered |
| All HTTP-date forms, malformed dates/weekday, past dates, seconds, budget/ceiling refusal | Same fixture family in ordinary, streaming and session conformance; `rejects a malformed RFC850 weekday through public HTTP recovery` | Covered; existing v2 fixtures retained |
| Budget from first failure; absolute deadline applies to admission/resend, never active generation; recheck before dispatch | `recovery-conformance.test.ts`: `does not apply recovery budgets or deadlines to active generation`; `cancels an unresolved admission at the recovery budget and aborts its signal`; `rechecks the recovery budget immediately before sending after admission and delay` | Covered |
| No hidden transport retries/redirects; exact count and IDs on actual sends only | `recovery-conformance.test.ts`: `accounts for a terminal 421 without a hidden transport resend`; redirect/status matrices. `recovery-http.test.ts`: `holds ambiguous admission pending, freezes request bytes, and reports exact wire identities` | Covered |
| Invoke async admission before resend; allow/reject/wait; rejection preserves original failure | `recovery-http.test.ts` same pending-admission case; `recovery-conformance.test.ts` allow/reject matrix; packaged probe explicit reject versus allow | Covered |
| Absent admission hook: remote eligible retry allowed; ambiguous local retry requires admission unless acceptance is no | `recovery-conformance.test.ts`: `requires ambiguous local admission while OpenAI may use policy admission`; `streaming-recovery-conformance.test.ts`: `requires explicit admission for ambiguous local sends` | Covered |
| Admission without decision/exception has distinct reason; no resend | `recovery-conformance.test.ts`: `keeps complete history when a later admission completes without returning`; `retains an admission exception without calling it deadline exhaustion`; `propagates an omitted admission return through the public session` | Covered |
| Five capability statuses with endpoint citations/dates; termination unknown; no invented idempotency/remote termination or model unload | `recovery-capabilities.test.ts` provider/value matrix and `should retain the generic snapshot for existing imports`; `recovery-http.test.ts` headers/identity assertions | Covered for three maintained adapters; clientAbort/remote facilities retain documented unknown/unsupported values, not a support claim |
| Keep raw progress distinct from observed/delivered semantics; keepalive is nonsemantic | `recovery-conformance.test.ts`: `keeps raw keepalive progress separate from observed and delivered semantics`; streaming keepalive matrices | Covered |
| Ordinary/structured/streaming use immutable encoded payload, tools, history and controls across admitted attempts | `recovery-conformance.test.ts`: `preserves image and completed tool history plus descriptors with an immutable encoded schema`; `streaming-recovery-conformance.test.ts`: `recovers with immutable supported prior history, tools and temperature` | Covered |
| Partial reasoning/content/tool fragments stop replay, including observed but undelivered bytes; no partial structured parse/tool dispatch/history | `recovery-conformance.test.ts` semantic/capture matrices; `streaming-recovery-conformance.test.ts` public session content/reasoning/tools interruption families and `observes escaped semantic keys before a capture failure` | Covered |
| Completed tool calls execute once; tool depth distinct from retry budget; tool-follow-up is separate completion | `streaming-recovery-conformance.test.ts`: `broker executes completed tool once when the subsequent completion fails`; `session recovery proof preserves completed tools and exact admitted follow-up bytes`; `first-token-http.test.ts`: `executes a completed streamed tool once and sends exactly one follow-up request` | Covered |
| Exhaustion/interruption cannot become complete success; length stays typed through broker/session | `recovery-conformance.test.ts` item-8 route matrix; `item 8 rejects length tool responses through the session with typed finish evidence` | Covered |
| Lifecycle transitions include safe phase/category/eligibility/reason/acceptance/delay/operation/progress/identities | `recovery-conformance.test.ts` exact ordered 503 lifecycle assertions; `streaming-recovery-conformance.test.ts`: `interrupts observed %s without replay or incomplete tool execution`; `retains original capture cause and observed/undelivered %s through session` | Covered |
| Explicit exact wire capture of failed/successful/partial responses; capture failure terminal with private typed cause | `recovery-conformance.test.ts`: `makes request capture failure terminal without sending HTTP`; `preserves both body transport and capture causes on a partial failure`; packaged `ts-packaged-library-v1` exact request comparison | Covered; capture evidence is opt-in |
| Cancellation authoritative in request/admission/backoff; pending hooks abort; paused-consumer resources close without claiming remote termination | `streaming-recovery-conformance.test.ts`: `closes an active socket while consumer is paused before delivering cancellation`; `cancels buffered terminal frames while paused without storing final assistant text`; active/admission/backoff matrix | Covered |
| oMLX recovery keepalive model frames change neither frame index nor metadata | `streaming-recovery-conformance.test.ts`: `recovers keepalive-only interruption with explicit admission and fixed request bytes`; streaming oMLX frame-index assertions | Covered |
| Migration example/capability table; completion scope excludes realtime and embeddings | `docs/completion-recovery.md`; public-export probe; capability tests | Documented; no realtime/embedding recovery claim |
| Reasoning: native assistant thinking separate from content/tool results; serialize Ollama thinking and oMLX reasoning_content in history | `gateways/omlx.test.ts`: `should map reasoning_content to thinking`; gateway response/stream fields exist | Covered by `ts-native-reasoning-history-v1`: exact ordinary/stream continuation messages on both native providers, retention/recovery off/on |
| Disabled, Enabled, Low, Medium, High, XHigh remain distinct; boolean enable/disable versus exact named levels | `models.ts` six-value public type; `reasoning-effort-http.test.ts`: `preserves the complete $name request body`; installed `ts-reasoning-effort-v1` matrix | Covered: exact Ollama think boolean/string and oMLX top-level boolean/named fields; omission sends no control |
| Explicit caller-selected profiles validate efforts/history capability, never model-name guessing | `reasoningProfile` plus public validator; `ts-reasoning-profiles-v1` explicit arbitrary alias and unselected Qwen-looking name HTTP cases; broker propagation tests | Covered: unchanged effort selection plus native-history capability rejection before HTTP in source/installed ts-native-reasoning-history-v1 |
| Qwen3.8 supports disabled/low/medium/xhigh and native history; omitted effort stays unknown | `QWEN3_8_REASONING_PROFILE`, `reasoning-profile.test.ts` and source/installed `ts-reasoning-profiles-v1` matrix | Covered for validation, metadata and native history via `ts-native-reasoning-history-v1` |
| Broker retention opt-in; completed ordinary/streamed tool responses retained, never fabricate native history from errors/cancellation | `reasoning-history-contract.test.ts`: `preserves exact completed turns through later %s`, `does not fabricate native history from interrupted streams cancel=%s`, malformed-frame and successful-finish cases | Covered; completed turns survive later failures, incomplete/cancelled turns do not create native history |
| oMLX preserve_thinking in chat_template_kwargs when retention enabled; recorded wire request | `reasoning-history-http.test.ts`: `retains exact completed native reasoning in the streaming continuation wire`; shared source/installed fixture assertions | Covered; exact preservation request asserted on both continuation requests |
| Structured output shares all native reasoning controls | `ts-reasoning-effort-v1`: ordinary, structured, legacy stream and event stream × recovery off/on × omission and all six controls | Covered; `ts-native-reasoning-history-v1` adds structured history and unsupported-history pre-dispatch assertions |
| OpenAI rejects unsupported new controls and preserves legacy behavior | `reasoning-effort-http.test.ts`: `rejects $name with no HTTP requests`, o3 and gpt-4o, recovery off/on; installed `ts-reasoning-effort-v1` | Covered for Disabled/Enabled/XHigh: explicit ValidationError before HTTP; event API wraps it in request_failed/detail. Omission and Low/Medium/High registry adaptation preserved. `ts-native-reasoning-history-v1` verifies enabled-retention rejection on every route and exact exclusion from OpenAI bodies with retention off |
| Metadata: single-purpose public capability; unknown/custom gateway returns not-advertised; errors remain Result errors | `model-context.test.ts`: `keeps existing custom gateway implementations source compatible`; `preserves implemented metadata and method binding`; `preserves the implemented Result error`; installed export/metadata probe | Covered |
| oMLX exact model max_model_len, missing model/field, invalid numeric field; configured endpoint/auth | `gateways/model-context-http.test.ts`: `queries the configured authenticated oMLX endpoint for exact model provenance`; missing/nonnumeric matrices; installed probe success/null/404 | Covered |
| Ollama /api/show architecture-prefix context_length, absent model_info, parameter num_ctx, malformed/nonpositive values and 404 | `gateways/model-context-http.test.ts` prefix/missing/invalid/status matrices; `ignores num_ctx substrings in other Ollama parameter names` | Covered |
| OpenAI explicit registry context only, unknown model never guesses window | `model-context.test.ts` explicit/unknown registry cases; `gateways/model-context-http.test.ts`: `keeps inferred reasoning completion parameters after an unknown registry lookup` | Covered; no broader profile claim |
| Metadata query has no request mutation or hidden cache | `gateways/model-context-http.test.ts`: `leaves %s completion request bytes unchanged after metadata`; `does not cache context metadata after the provider changes it`; installed byte equality | Covered |
| Effective window explicit config then model num_ctx then advertised upper bound; min cap; unknown returns nothing | `model-context.test.ts` above/equal/below matrix; `uses the model parameter when configuration omits numCtx`; `returns the advertised upper bound when no context setting is visible` | Covered |
| Timing: monotonic first dispatch, lazy streams, thinking/content/tool arguments, priority thinking > content > tool, empty/keepalive excluded | `first-token-http.test.ts`: `measures $name legacy chunks after keepalives and empty deltas`; `measures $name through broker terminal events`; `does not count tool names or empty arguments as a token before event rejection`; split-frame/legacy-fragment matrices | Covered with controlled clock; installed probe samples thinking-first and real clock |
| Timing success/failure/empty/cancel; provider metrics preserved separately | `first-token-http.test.ts`: `leaves first-token fields absent on empty event streams and preserves provider timing`; `retains timing through session failure and excludes partial assistant history`; `retains first-token evidence when a broker event request is cancelled` | Covered |
| Timing observed before capture/delivery, retries share clock, tool continuations start fresh clock | `first-token-http.test.ts`: `retains split-frame token timing when response capture rejects`; retry/capture matrices; `executes a completed streamed tool once and sends exactly one follow-up request` | **Partial evidence**: retry/observation timing is covered and implementation starts a fresh timer per continuation; the tool test asserts content/count, not an independently advanced second-completion clock. A direct fresh-clock assertion remains an evidence gap |
| temperature/numCtx/maxTokens optional without invented defaults | `output-limit-http.test.ts`: temperature/context matrix `sends the complete $name body and preserves resend bytes`; `temperature-context-http.test.ts`: `omits sampling defaults on an admitted event-stream resend with identical encoded bodies`; installed `ts-temperature-context-v1` matrix | Covered for maintained gateways: unset temperature omitted, no internal OpenAI context fallback, Ollama emits num_ctx only when configured. Session configuration and deprecated broker entrypoint are outside this bounded correction |
| One output limit; remove numPredict; serialize configured maxTokens exactly once per provider, including streams/retries/tools | `output-limit-http.test.ts`: `removes numPredict from the exported TypeScript CompletionConfig contract`; `ignores a stale JavaScript numPredict alias in favor of maxTokens`; configured limit matrix; `omits the output limit on recovered event requests and resends`; installed exact wire bodies | Covered; legacy behavior outside this correction preserved |
| Required Anthropic max_tokens fallback | No maintained Anthropic adapter/public export in TypeScript | Not applicable to current adapter set; implementing Anthropic would require its documented registry/4096 fallback |
| OpenAI fixed temperature rewrites caller-set value to only supported value; non-reasoning effort warns and drops | `gateways/openai.test.ts`: `should adapt parameters for reasoning models`; `should warn and ignore reasoning_effort for non-reasoning models` | **Partial**: warning/drop covered; fallback hardcodes 1 rather than deriving sole registry value. Omission and existing o3 caller-set adaptation now have complete real-HTTP body assertions; the broader registry rule remains open |
| Other configured sampling/shape fields, client-only settings never serialized | `ts-openai-sampling-v1`: shared JSON cases in `output-limit-http.test.ts` and installed full-body assertions; `openai-sampling-http.test.ts`: tool continuation with retries | OpenAI topP/frequencyPenalty/presencePenalty covered; six-value Ollama/oMLX controls now covered by ts-reasoning-effort-v1; unrelated request-shape gaps remain |
| Default bodies omit temperature and limits; each configured control sent once; docs/CHANGELOG/PARITY aligned | `output-limit-http.test.ts` complete sampling bodies, retained output-limit matrix, installed `ts-temperature-context-v1`; CHANGELOG and gateway/core guides include migration | Covered for this bounded omission correction; parent PARITY remains outside write scope. Other configured fields and reasoning gaps above remain open |

## Parts 4–5, records, gates and CI

Part 4 is Kotlin's target removal, not a TypeScript mutation. It is not verified
here. Part 5 audit #4 is covered by `session-temperature-fixtures.json`,
the fixture matrices in `recovery-conformance.test.ts` and `streaming-recovery-conformance.test.ts` and the output-limit session tests:
explicit zero survives send/sendStream through maintained gateways. The omitted
session temperature of 1.0 is separately configured behavior preserved outside this gateway correction.
Python #2 and Rust #3 are outside this repository and were not verified.

AGENTS.md already had coordinated 3.0 authorization; its outdated consumer
verification requirement is corrected. CHANGELOG Unreleased already records
recovery changes, metadata, timing, output-limit breaking changes and migration,
and the session-zero fix. It now records this assessment without announcing
native history behavior and migration. README and gateway/core/reasoning guides
describe the opt-in API and its provider constraints.

The only discovered `.hone-gates.json` is the root file. Its original lint,
format, test and build gates are retained; a required `package-conformance` gate
now runs `npm run verify:package`. CI's Build and Publish jobs run the same package check.
CI already runs lint/format, build, tests, 70% coverage thresholds and production
security audit on Node 24. Docs are built only for release/manual deployment;
full development-dependency audit and npm outdated are local checks. No threshold,
audit scope, runtime/dependency version or suppression was changed.

## Previous assessment evidence (historical)

The following measurements and command results predate the current correction.
Current executable identities and results are recorded at the end of this document.

### Installed-artifact executable set

`ts-packaged-library-v1` is `scripts/verify-package.cjs`, run by
`npm run verify:package`. It builds with the existing compiler, packs unchanged
version 2.1.0, installs the actual tarball and dependencies into a new
`/tmp/mojentic-package-*` directory, then resolves only the public `mojentic`
package from that consumer. No source or internal module is imported; no fetch,
HTTP, SDK or library internal is mocked. Production transports contact a real
loopback HTTP server scripted by this executable contract. This is library
self-validation, not a claim that a live provider passed verification.

Before documentation expansion or full gates, the direct installed-artifact
acceptance probe passed. During probe development, incorrect assumptions about
the UUID-only safe ID allowlist, nested provider timing (`metadata.usage`) and
`stream_options.include_usage` were corrected in the assertions. These were
probe defects, not product fixes. The identical 503 response then demonstrates
both explicit rejection (no replay, typed admission_rejected, HTTP status and
safe provider ID) and explicit admission (successful content, exact identical
body/destination, shared logical ID, distinct attempt UUIDs and one-based wire
counts). Actual UUIDs are printed in full; no masked identifiers establish proof.
The test also compiles a consumer of the installed declarations, checks package file boundaries, and asserts public exports, oMLX metadata/null/error, byte-identical
completion after metadata, thinking-first timing excluding keepalive, provider
usage, full streaming body, OpenAI bearer auth/body and Ollama options/body.
Real-clock checks in the package sample prove field presence/order, while the
Jest controlled-clock matrices prove exact timing semantics.

Artifact identity, executable hash, current command results and CI status follow
below. The script always emits fresh artifact SHA-256, npm integrity, tested base
revision, contract hash, unmasked attempt identities and actual HTTP records.

### Recorded artifact and assertions

The final executable set SHA-256 is
`efd4669cc6ad7d561a7f4b2953b62a0ca1b8241e36445958612ec10c7c6cd52e`.
The tarball installed by the final probe is
`/tmp/mojentic-package-jlTVgk/mojentic-2.1.0.tgz`:

- SHA-256: `4d953fd1c1c824028da9ab00a5f4fa28fc483cbca724b7e44e0ca71296b4fa42`.
- npm integrity: `sha512-byWmTDP7Lr1AnynUKZqaK0Ud7O4m6qjp7yiQcE4TAYQLc1JERO5PCR5WQyoJ/HJitu8rc5nRVqOSZtNHBjphkA==`.
- Consumer: `/tmp/mojentic-package-jlTVgk`, with tarball installed using
  `npm install --ignore-scripts --no-audit --no-fund <absolute-tarball-path>`.
  Both required security audits are separate checks below, not skipped findings.
- Declarations checked using the existing project compiler:
  `node <repository>/node_modules/@typescript/native/bin/tsc --noEmit --strict --skipLibCheck --module node16 --target es2022 <consumer>/public-api.ts`.
  `skipLibCheck` matches the existing build setting; the public consumer itself
  is typechecked. This is a compiler tool invocation, not an internal library import.
- Runtime probe: `node scripts/verify-package.cjs --consumer /tmp/mojentic-package-jlTVgk`.

For example, both admitted oMLX attempts send exactly
`{"model":"qwen","messages":[{"role":"user","content":"packaged contract request"}],"temperature":0,"max_tokens":19}`
to `/v1/chat/completions`. The first receives HTTP 503 with Retry-After `0`,
provider request ID `12345678-1234-1234-1234-123456789abc` and
`{"error":{"code":"server_error","message":"scripted unavailable"}}`; the
second receives HTTP 200 with the scripted `verified` content and stop finish.
The explicit wire observer asserts both response bodies exactly. Logical ID
`2b315619-e450-4f40-a3eb-8cbe44cbc56f` is shared by attempts
`88e2453b-58a2-41e1-9ab6-6961149d71cf` (wire 1) and
`d57c1d50-bdd8-455d-9e05-6dc4d8acd9d8` (wire 2). Rejection of the same
503 preserves typed `admission_rejected` and the safe metadata without replay.

The metadata success returns exactly `maxContextTokens: 65536` and provenance
`max_model_len`; missing field returns `Ok(null)` and HTTP 404 returns an error.
The following default completion is byte-identical before/after metadata and
still contains temperature 1, explicitly characterizing the remaining gap.
The event request adds `stream: true` and `stream_options: {include_usage: true}`
and omits an output limit. Its keepalive/thinking/content/stop script completes
with visible text `visible`, first kind `thinking`, preserved provider
`usage.time_to_first_token: 0.7`, and nonnegative client times with request
duration at least first-token time (observed 2.498735 ms and 4.801914 ms).
These observed numbers are not deterministic thresholds.
OpenAI's configured body contains only model/messages/temperature 0/max_tokens 19
with `Authorization: Bearer package-test-key`; Ollama's contains model/messages,
`options: {temperature: 0, num_predict: 19}` and `stream: false` at `/api/chat`.
The synthetic key is fixture data. Exact-body assertions detect extra controls;
there are no count-only conformance claims. No packaging/export defect was
observed in these declared cases.

Existing executable identities retained unchanged:

| Set | SHA-256 |
| --- | --- |
| retry-after-fixtures.json, v2 | `1b11f27fb5b0c07d635167cc9e65dcf5d176c617ce88daa5c43cedbd64874992` |
| session-temperature-fixtures.json | `45925454779ac55586adb87ce531e989cfb62bcbca3637c162a0bb2032cd5bf2` |
| recovery-typed-errors-v1.json | `90f28078781fcaff634372d568e992a3afede9257a7fbb3d8af6494559472f47` |
| recovery-conformance.test.ts | `f19a423f13fd0a59ac3a3e7030eb82b045a6b879cf369bd089c1b47bdbe4f9cd` |
| streaming-recovery-conformance.test.ts | `2c783bea25db9a97a0946df68d36b2fbca4e15b64ed99587e291135c41bfa9c9` |
| first-token-http.test.ts, ts-stream-first-token-v1 | `9b64e037af8ee375a6344b94f4f66992f867357a32b8db360042a8eff4f12eca` |
| output-limit-http.test.ts | `417781df25a692bad82685aaec1fcdd050a3d170dacd4d64f7cd62661b5b81f5` |

### Current command results

All verbose commands used Foundry capture; complete logs and the validated direct
acceptance proof are retained as execution evidence, not shipped package files.
The initial build before dependency installation failed because the isolated
worktree had no compiler installed; `npm ci` resolved that prerequisite without
changing the lockfile. The first npm pack attempt used the read-only default npm
cache; the verifier now chooses a writable temporary cache. Neither is reported
as a passing run. Probe-development assertion failures are described above.

| Command | Current result |
| --- | --- |
| `npm ci --cache /tmp/mojentic-c14-npm-cache` | Exit 0; lockfile unchanged |
| `npm run format` | Exit 0; no production TypeScript changes |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 56 suites, 3,714 tests |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; fresh install, installed declaration compile, production HTTP request/response assertions |
| `npm test -- --coverage` | Exit 0; 56 suites / 3,714 tests; statements 87.67%, branches 83.24%, functions 90.39%, lines 88.04%; all existing global 70% thresholds exceeded |
| `npm audit --omit=dev --audit-level=moderate --cache /tmp/mojentic-c14-npm-cache` | Exit 0; zero vulnerabilities |
| `npm audit --cache /tmp/mojentic-c14-npm-cache` | Exit 0; zero vulnerabilities including development dependencies |
| `npm outdated --cache /tmp/mojentic-c14-npm-cache` | Exit 0; no outdated packages reported |
| `npm run docs:build` | Exit 0; pages rendered. Existing VitePress/Rolldown bundle-assignment compatibility diagnostics and transform deprecation remain; these are recorded, not suppressed or lint warnings |

The main quality sequence was exactly
`npm run format && npm run lint && npm run format:check && npm test && npm run build && npm run verify:package && npm test -- --coverage`.
The final installed probe was rerun separately after adding declaration and
response-byte assertions. Package, lockfile and `src/index.ts` runtime versions
remain unchanged, with no advisory suppression edits.

CI query:
`gh api 'repos/svetzal/mojentic-ts/actions/runs?head_sha=54171796a2b02c0f0170d0758d2e3c693ad027c9&per_page=10' --jq '{total_count, runs: [.workflow_runs[] | {id,head_sha,status,conclusion,html_url}]}'`
returned exit 0 and one completed successful run:
[39008481403](https://github.com/svetzal/mojentic-ts/actions/runs/39008481403).
That is evidence for the base commit only. CI for this uncommitted correction,
including its new package steps, is **outstanding until Foundry finalizes it**.
No new CI run was triggered. Local green gates and that historical CI result do
not close the feature/evidence gaps in the matrix or authorize release.

All five gates discovered from `.hone-gates.json` were subsequently rerun from
their configured commands and exited 0. The package gate was rerun after making
its version assertion compare installed package metadata with the public runtime
version, avoiding a duplicated release version in the probe. The revised docs
build also exited 0. `git diff --check` and the package-script Prettier check
passed. The lockfile SHA-256 is unchanged from HEAD:
`a1fa41bfd32a2ea05fef34c7f3de7eb44c9282f6571d75452f92e3c8fdb65d2a`.


## Prior temperature/context correction

Tested source is `716e6122f03c618a28f440bd18bfbe0ab63c2d1f` plus the
uncommitted correction identified below. The binding scope is
MODEL-METADATA-2026-10.md sections 3.2(1,3), 3.3 and 3.5–3.6, SHA-256
`d9945dca45ce09e2163843263a75b5e93028b00ee1baf191fc3ff13396830e9c`.
No package, lockfile or runtime version changed. Foundry owns Git finalization.

OpenAI no longer invents temperature 1 or internal numCtx 32768; oMLX no
longer invents temperature 1. Ollama source is unchanged. Explicit values,
including zero, retain existing behavior and OpenAI model adaptation. The
maxTokens correction, reasoning controls, recovery policy, timing and separately
configured ChatSession default remain intact. Tracer/reporting fallbacks are
not outbound defaults. This correction does not close the remaining native
reasoning, registry adaptation or configured request-shape gaps above, and does
not establish whole-release readiness. Parent PARITY updates remain owner work.

### Executable identity and behavior

`ts-temperature-context-v1` is the sampling matrix in
`src/llm/output-limit-http.test.ts`, the focused
`src/llm/temperature-context-http.test.ts` probe, and the installed-consumer
matrix in `scripts/verify-package.cjs` (`ts-packaged-library-v1`). All use public
APIs with production HTTP transports and a real loopback server. Scripted replies
are local protocol fixtures, not live provider verification. No running-service
boundary changed and no unreleased dependent or other port was asked to verify.
The library and fresh consumer checks below are the required two validation
contexts under the binding library policy.

| File | SHA-256 at the temperature/context correction (historical) |
| --- | --- |
| `src/llm/gateways/openai.ts` | `221d2e6a033aeb281121ca6ed9345405c1c7bbc2503e6f4eb4cc51f3e2bceab4` |
| `src/llm/gateways/omlx.ts` | `e34484ce4cf86573bbaa98868d905cef4c86586a09083ce947e0f082e633b248` |
| `src/llm/models.ts` | `8eccb11edf15d8a93fb708a24ae01c2fc844775c95a1a0639c0d79fa8a38303c` |
| `src/llm/output-limit-http.test.ts` | `89422bbae53ab63c70095f8b120d79f4dc9cb1cf0301bb1025c00a86cd2b3c82` |
| `src/llm/temperature-context-http.test.ts` | `b695a0d55d143753417f7bb9ba486d0988e91e2c87a0a453252524a42833e7af` |
| `src/llm/gateways/model-context-http.test.ts` | `37f950c6df7b90bdcd1a7a1be420a37797219e0ecfc9ed77c29b0fab9f67ef2a` |
| `scripts/verify-package.cjs` | `9238d01fdf02091e58c8e5b89c3de0c4c21302a14ae5469966e5e5af69b4bf0e` |

Named-test mappings:

- `omits sampling defaults on an admitted event-stream resend with identical encoded bodies`:
  real HTTP 503 then admitted streaming success. Before the source correction it
  exited 1 because both complete bodies contained temperature 1; after correction
  the same command exited 0 with omitted temperature and identical resend bytes.
  Command: `npm test -- --runInBand src/llm/temperature-context-http.test.ts`.
  The behavioral proof JSON, actual exit codes and both logs were validated and
  retained as Foundry execution evidence before expanding the matrix or docs.
- `sends the complete $name body and preserves resend bytes`: 336 cases across
  OpenAI chat/o3, Ollama and oMLX; ordinary, structured, legacy chunk and event
  routes; recovery disabled, enabled without failure, and admitted 503 resends.
  Configurations cover omitted config, empty config, explicit undefined, explicit
  zero, nonzero sampling/context, temperature alone and context alone. Every
  complete body is asserted, plus exact encoded-byte equality on resends.
- `omits unset sampling controls and preserves reasoning controls without an output limit`:
  existing reasoning and other supported controls are preserved.
- `should omit unset temperature and output limit`: oMLX shared request builder.
- `keeps inferred reasoning completion parameters after an unknown registry lookup`:
  full encoded bodies now omit unset temperature while retaining the explicit
  max_completion_tokens before and after metadata lookup.

The fresh consumer runs the same declared 336 sampling cases through installed
public brokers, verifies response semantics, full bodies, exact paths and retry
bytes, and compiles installed declarations. The preexisting package probes still
cover explicit maxTokens, metadata non-mutation, first-token timing, recovery
rejection and safe attempt identities. Current artifact SHA-256:
`6b75f9e752fedf57d1a31f385c2c6e7d62a74c4dfa0e1f3fc0a4a962c6d6762f`;
fresh install: `/tmp/mojentic-package-UVebdW/mojentic-2.1.0.tgz`.
This is an unpublished local artifact, not registry adoption.

### Temperature/context correction verification results (historical)

All commands used Foundry capture. The first full suite found one stale metadata
expectation of temperature 1; it was updated to the corrected complete body,
then the whole required sequence was rerun successfully. No failure was waived.

| Command | Result |
| --- | --- |
| `npm run format` | Exit 0 |
| `npm run lint` | Exit 0, zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 57 suites, 4,051 tests |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; fresh tarball install, declarations and production HTTP consumer matrix |
| `npm test -- --coverage` | Exit 0; 4,051 tests; statements 87.66%, branches 83.24%, functions 90.39%, lines 88.04%; every global 70% threshold exceeded |
| `npm audit --omit=dev --audit-level=moderate --cache /tmp/mojentic-c15-npm-cache` | Exit 0; zero vulnerabilities |
| `npm audit --cache /tmp/mojentic-c15-npm-cache` | Exit 0; zero vulnerabilities including development dependencies |
| `npm outdated --cache /tmp/mojentic-c15-npm-cache` | Exit 0; no outdated packages |
| `npm run docs:build` | Exit 0; pages rendered; existing VitePress/Rolldown bundle-assignment diagnostics and transform deprecation remain |

The only discovered gate file is the repository root `.hone-gates.json`; all
five configured gates passed. The docs diagnostics were recorded, not
suppressed. No dependencies or advisory suppressions changed. CI for this
uncommitted correction remains pending Foundry finalization; no refs were
modified, no commit/push/tag/publication occurred, and no sibling was edited.


## Prior OpenAI configured sampling correction

This correction closes only the configured OpenAI sampling-field gap under
`MODEL-METADATA-2026-10.md` sections 3.1 (Field coverage) and 3.6. Source base:
`0cce56602415c925afbf0718b56cdf12859289b1`, tested with the uncommitted changes
identified below. The initiative brief was read and its supplied SHA-256
`ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e` verified.
The binding metadata document SHA-256 is
`d9945dca45ce09e2163843263a75b5e93028b00ee1baf191fc3ff13396830e9c`.

`buildRequestBody` forwards `topP`, `frequencyPenalty` and `presencePenalty` as
`top_p`, `frequency_penalty` and `presence_penalty`. Each is independent, zero
is retained, and unset/undefined values are omitted. The existing model
adaptation and serialization paths otherwise remain unchanged. The two prior
OpenAI characterization expectations change only for these three fields;
Ollama/oMLX expectations retain their prior behavior. Changelog migration notes
and the OpenAI gateway request table describe the new configured behavior.

### Executable contract and named mappings

`ts-openai-sampling-v1` uses the versioned declarative cases in
`src/llm/gateways/__fixtures__/openai-sampling-v1.json` in both source tests and
the fresh installed-artifact consumer. These are local protocol fixtures, not
claims of live OpenAI provider verification. The public library API and fresh
consumer self-validate distribution readiness under the binding library policy;
no changed boundary between running services or counterpart verification is
involved. This remains a bounded correction, not whole-release readiness.

| Binding behavior | Named executable evidence |
| --- | --- |
| Preserve configured controls through tool continuation and admitted retries | `openai-sampling-http.test.ts`: `preserves configured sampling through tool continuation and byte-identical admitted retries` asserts all four complete request bodies, exact tool history/result, successful final response and identical bytes on each pair |
| Preserve zero and nonzero values, send each field independently exactly once | `output-limit-http.test.ts`: `sends the complete $name body and preserves resend bytes`, with the eight shared `ts-openai-sampling-v1` cases for chat and reasoning models; complete bodies and encoded field occurrence assertions |
| Omit unset and explicit undefined controls on every route | Same matrix retains omitted config, empty config and explicit undefined cases, now including all three controls |
| Ordinary, structured, legacy chunk, event stream and recovery paths | Four public broker routes, each with recovery disabled, enabled without failure, and admitted HTTP 503 resend; full response semantics, body and retry-byte assertions |
| Preserve unrelated characterized behavior | `characterizes unrelated request controls before output-limit correction`; `omits unset sampling controls and preserves reasoning controls without an output limit`; complete bodies retain temperature adaptation, reasoning, output limits and other provider expectations |
| Packaged library consumers see the same configured and omitted behavior | `npm run verify:package`: `ts-packaged-library-v1` loads the same sampling fixture, compiles installed public declarations and executes the same 528 matrix cases through installed public brokers and real HTTP |

The source and installed matrices each retain 336 omission/temperature/context
cases and add 192 sampling cases (eight configurations × two OpenAI model
families × four routes × three recovery policies). The focused tool probe first
failed at the real HTTP boundary because the three configured fields were
absent, then passed after the six-line source correction, before matrix or
documentation expansion. The actual red exit was 1 and green exit was 0;
behavioral proof and both complete logs are retained as Foundry execution
evidence.

| File | Tested SHA-256 |
| --- | --- |
| `src/llm/gateways/openai.ts` | `6e8ecd5602fe561bd1afa6a434ea1fbc7a95d0eacc3a8ff232e09830b629f62f` |
| `src/llm/gateways/__fixtures__/openai-sampling-v1.json` | `808208d7683d9e67b75470a84b11420c1e7f95db8eb1f4e79cda780edf442836` |
| `src/llm/output-limit-http.test.ts` | `4efaeb35d7c09d14be41fbc131d9fb33cbcbed10170c4e28f77a92cbdeda0b90` |
| `src/llm/openai-sampling-http.test.ts` | `491dcdf11b743ddd71ac59b1dc3b4ce1abea452a1eef630ca83bdffff9deb949` |
| `scripts/verify-package.cjs` | `365059ba0168d8f7c6ae47d48a5957246c22982719d231039307bd5fad73ce0b` |

### Correction verification results

All five `.hone-gates.json` gates passed on the source identity above. Commands
used Foundry capture; no test or lint warnings were suppressed.

| Command | Actual result |
| --- | --- |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format` | Exit 0; formatted source, tests and examples |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 58 suites, 4,244 tests |
| `npm test -- --coverage` | Exit 0; 4,244 tests; statements 87.68%, branches 83.33%, functions 90.39%, lines 88.06%; all global 70% thresholds exceeded |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; packed artifact, fresh install, public declaration compilation and 528 complete-body consumer matrix cases |
| `npm audit` | Exit 0; zero vulnerabilities, including development dependencies |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `env npm_config_cache=/tmp/mojentic-outdated-cache npm outdated` | Exit 0; no outdated dependencies; initial default-cache attempt could not write to the sandbox's read-only home cache |
| `npm run docs:build` | Exit 0; existing VitePress/Rolldown bundle-assignment diagnostics and transform deprecation remain |

The tested unpublished artifact is
`/tmp/mojentic-package-JCbZTo/mojentic-2.1.0.tgz`, SHA-256
`8b68bf2d14e3750f8c5e43152d867efc7f36b5023526f4e7f213e7f5c81e4125`.
The fresh consumer lives at `/tmp/mojentic-package-JCbZTo`; the harness reported
`PASS ts-packaged-library-v1` and the shared sampling contract hash above.
No dependency, advisory suppression, package/lockfile/runtime version or other
provider implementation changed. Git finalization and subsequent CI remain with
Foundry; no commit, push, ref mutation, publication or sibling edits occurred.
Suggested commit message: `Fix OpenAI configured sampling field forwarding`.

## Reasoning effort correction

Tested source: preserved cycle-17 commit
`4be3588c94dbf9956e2a25e23a1f943b90e8a975` plus this uncommitted worktree.
The initiative brief hash was verified. The binding reasoning contract remains
`0a40f3ad45c593bc779411021e45db569e73d3ecce86c99b201e7f8ebb656809`.
Stacey's October 17 decision is in PARITY.md, “Reasoning controls by provider,”
read at mojentic-unify commit `7bbd530d4622ea8ba530b78c8b116c3390da13d5`,
PARITY.md SHA-256 `c0c231ab35a559ba3bd90ed640d70d9c02c89797b1ab5a809a78daac786cd5ce`.
Its 3.0 table explicitly requires TypeScript errors for OpenAI Disabled,
Enabled and XHigh. The 3.1 “native or nothing” rule is not implemented here.
The six-value public type and Ollama/oMLX mappings are retained from cycle 17.

OpenAI validates unsupported controls before model-registry adaptation,
recovery initialization, timing or HTTP dispatch. Ordinary/structured calls
return Err(ValidationError), legacy streams yield one error result, and event
streams yield one request_failed error with the ValidationError in detail.
The configuration error identifies reasoningEffort. No HTTP attempt or recovery
history is invented. Omitted effort and existing Low/Medium/High behavior remain:
reasoning models send the exact name; ordinary models warn and omit it.
Unrelated request, recovery and timing implementations are unchanged.

### Shared executable contract and named evidence

`ts-reasoning-effort-v1` is the declarative executable set in
`src/llm/gateways/__fixtures__/reasoning-effort-v1.json`. Both source public-API
HTTP tests and the fresh installed consumer load these same cases. Scripted
responses provide valid completed content/structured JSON and terminal streams;
production transports send to real loopback HTTP endpoints. This verifies local
library protocol semantics, not live provider/model capability or efficacy.
No running-service boundary changed; no dependent or sibling verification is
required for this unpublished package under the binding library policy.

| Behavior | Named verification |
| --- | --- |
| Omit effort; preserve all six controls without boolean/named conflation | `reasoning-effort-http.test.ts`: `preserves the complete $name request body`, including exact full Ollama/oMLX bodies, endpoints, usable response content and terminal stream completion |
| Preserve OpenAI omitted and Low/Medium/High registry behavior | Same matrix on o3 and gpt-4o: full bodies and exact ordinary-model warning calls |
| Reject Disabled/Enabled/XHigh with no actual HTTP | `rejects $name with no HTTP requests`, on reasoning and ordinary models; validates error name/code/field/message, event reason/detail, one terminal error, no warning/drop or request |
| Ordinary, structured, legacy streaming and event streaming, recovery off/on | 224 source cases: four provider/model cases × four routes × two recovery modes × seven effort cases; 48 explicitly rejected cases |
| Fresh installed artifact exposes identical semantics | `npm run verify:package`: ts-packaged-library-v1 compiles all six installed ReasoningEffort declarations and runs the same 224 effort cases, in addition to the retained 528 sampling/omission cases and earlier package probes |

The proof-first probe `rejects unsupported OpenAI effort before recovery dispatch`
failed with exit 1 because an actual recovery-enabled o3 HTTP request sent
Disabled and returned success. After the source guard, the same probe exited 0
with an explicit configuration error and no HTTP request. Both actual probe logs
and validated behavioral proof are retained as Foundry execution evidence. The
expanded matrix supersedes that focused test in the final source.

At that assessment, caller-selected profiles, Qwen3.8 profile validation, native reasoning history
serialization and opt-in retention (including oMLX preserve_thinking) remain
implementation gaps. This bounded correction does not establish coordinated
release readiness. Versions remain 2.1.0; publication, consumer migrations,
parent PARITY edits and Git finalization remain outside this worktree task.
CI for the uncommitted correction remains pending Foundry finalization.

### Cycle 18 tested identities and actual results

The initial full suite exposed two stale cycle-17 expectations that still
asserted think=true for High. They now expect the exact string high in
`gateways/ollama.test.ts` (`should preserve the named think level when reasoningEffort is set`)
and `output-limit-http.test.ts` (`omits unset sampling controls and preserves reasoning controls without an output limit`).
No production mapping was reverted. The complete gate sequence was rerun after
these corrections; all commands below exited 0.

| File | Tested SHA-256 |
| --- | --- |
| `src/llm/gateways/openai.ts` | `56901cbc1b6c8efa3f2f625e5a7426aaf5b39e44e514184377cf9b65885b56c3` |
| `src/llm/models.ts` | `226fa5b1c9365be585324498fdfd43fe5b0e5a6c9529aed39cc6d00e6f5e5765` |
| `src/llm/reasoning-effort-http.test.ts` | `da917dca14ccb284fadbe2bf7cb8fc59eb02a01e68abd7751196ab0df9148d4a` |
| `src/llm/gateways/__fixtures__/reasoning-effort-v1.json` | `88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a` |
| `src/llm/gateways/ollama.test.ts` | `93ee03284cd51b3d268b8b8ca9d66505c84fa87848a89936a68f1d10ddd488e2` |
| `src/llm/output-limit-http.test.ts` | `241f85a509d238bde41d747af4c3044cee9cdca2e6b636e4334057484bd26db4` |
| `scripts/verify-package.cjs` | `9682b48204c188be4e7b71332927fe5a12f2c7eddd5e6754ff1991d31254d44a` |

| Command | Actual result |
| --- | --- |
| `npm run format` | Exit 0 |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 59 suites, 4,468 tests, including all 224 ts-reasoning-effort-v1 source cases |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; fresh tarball install, public declaration compilation, same 224 effort cases plus retained 528 sampling/omission cases and package probes |
| `npm test -- --coverage` | Exit 0; 59 suites, 4,468 tests; statements 87.74%, branches 83.50%, functions 90.40%, lines 88.11%; all global 70% thresholds exceeded |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `npm audit` | Exit 0; zero vulnerabilities including development dependencies |
| `npm outdated --cache /tmp/mojentic-c18-npm-cache` | Exit 0; no outdated dependencies. Initial default-cache attempt hit the read-only home cache; rerun used a writable cache |
| `npm run docs:build` | Exit 0; existing VitePress/Rolldown bundle-assignment diagnostics and transform deprecation remain |

Every gate in `.hone-gates.json` passed using its configured command. Verbose
commands ran through Foundry capture. The final full sequence was
`npm run lint && npm run format:check && npm test && npm run build && npm run verify:package && npm test -- --coverage && npm audit --omit=dev --audit-level=moderate && npm audit && npm outdated --cache /tmp/mojentic-c18-npm-cache`.
Documentation was rebuilt after its final edit. No advisory suppression was
added or changed; package and lockfile versions and runtime VERSION are unchanged.
The unchanged lockfile SHA-256 is
`a1fa41bfd32a2ea05fef34c7f3de7eb44c9282f6571d75452f92e3c8fdb65d2a`.

Final packed artifact: `/tmp/mojentic-package-yhX78a/mojentic-2.1.0.tgz`, installed
into the fresh consumer `/tmp/mojentic-package-yhX78a`.
Artifact SHA-256: `2fec0daff89cf0dac87c3488a903defb48a9e3b16c62ef1118bed48ed08946d5`.
Both source and installed-consumer verification passed contract
`ts-reasoning-effort-v1`, SHA-256
`88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a`,
on the tested base commit plus source hashes above. The installed harness
reported PASS ts-packaged-library-v1 and PASS ts-reasoning-effort-v1. No live
provider, other port or dependent repository verification is claimed.

Suggested commit message for Foundry: `Fix OpenAI 3.0 reasoning control rejection and verify effort mappings`.
Changes remain uncommitted in this task worktree for Foundry; no refs changed.


## Cycle 19 documentation consistency correction

Tested source: `5194643cb8842a26a150765f04f9ba35105eddec` plus the
uncommitted documentation diff in `docs/api/core.md`, `docs/broker.md` and this
assessment. The initiative brief was reread and its SHA-256 matched
`ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e`.
No production code, executable fixtures, package/lockfile/runtime versions or
dependencies changed. Foundry owns Git finalization.

Corrected passages:

- `docs/api/core.md:406–408`: Ollama disabled/enabled send `think: false/true`;
  named levels send exact strings. oMLX disabled/enabled send top-level
  `enable_thinking: false/true`; named levels send exact `reasoning_effort`
  strings. oMLX fields are mutually exclusive; omission preserves defaults.
  OpenAI still rejects disabled/enabled/xhigh before HTTP, including recovery.
- `docs/broker.md:262–264`: replaced the blanket `think: true` summary with the
  same boolean/named distinctions, oMLX exclusivity, omitted controls and
  OpenAI pre-dispatch rejection. Ordinary, structured and streaming paths agree.

The targeted consistency review covered all reasoning-control references in
`docs/` and `README.md`, especially `docs/reasoning-effort.md` provider sections
and `docs/api/gateways.md` mapping tables/current limitations. These already
agree with the corrected summaries; no further contradictory summary was found.
Production builders were checked directly: `ollama.ts` sets `think` to a boolean
only for disabled/enabled, and otherwise preserves the named string; `omlx.ts`
omits the alternative control; `openai.ts` rejects unsupported controls before
HTTP. Their unchanged SHA-256 identities are:

| Builder | SHA-256 |
| --- | --- |
| `src/llm/gateways/ollama.ts` | `22ec973b8862db75d52f1dafa1bb626fb4484757549da173d23e57d7e961f559` |
| `src/llm/gateways/omlx.ts` | `fc63da6ec2fb362773250320a7abb882d6daab3beb11f9b2af34ce93be5d303f` |
| `src/llm/gateways/openai.ts` | `56901cbc1b6c8efa3f2f625e5a7426aaf5b39e44e514184377cf9b65885b56c3` |

The unchanged shared contract is `ts-reasoning-effort-v1`, fixture SHA-256
`88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a`.
Both verification paths consume this exact fixture on the source revision above:
`reasoning-effort-http.test.ts` compares full HTTP bodies and paths and asserts
usable responses, completed streams and zero HTTP on OpenAI rejection;
`scripts/verify-package.cjs` applies the same full-body and rejection assertions
through the freshly installed public package. Full-body equality proves omitted
controls and mutually exclusive oMLX fields, beyond schema matching. Each path
passed all 224 cases (including 48 rejections), across omitted/six explicit
controls, four routes, recovery off/on and reasoning/ordinary OpenAI models.
No live provider, sibling port or dependent verification is claimed or required
for this documentation-only library correction.

The non-behavioral acceptance probe ran before documentation edits:
`npm test -- --runInBand src/llm/reasoning-effort-http.test.ts` exited 0,
224 tests passed. Its first attempt exited 127 because Jest was absent;
`npm ci` exited 0 using the unchanged lockfile, then the probe passed.

Fresh required gate and quality results:

| Command | Actual result |
| --- | --- |
| `npm run format` | Exit 0; no source changes |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 59 suites, 4,468 tests |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; PASS ts-packaged-library-v1 and 224 installed ts-reasoning-effort-v1 cases, with retained sampling/omission probes |
| `npm test -- --coverage` | Exit 0; 87.74% statements, 83.50% branches, 90.40% functions, 88.11% lines; all exceed the configured 70% thresholds |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `npm audit` | Exit 0; zero vulnerabilities |
| `npm outdated --cache /tmp/mojentic-docs-npm-cache` | Exit 0; no outdated packages reported |
| `npm run docs:build` | Exit 0; pages rendered successfully; existing Rolldown bundle diagnostics and transform deprecation remain |

All five root `.hone-gates.json` gates passed with their configured commands.
Verbose commands ran through Foundry capture. The initial `npm outdated` attempt
failed with EROFS because npm's default cache is read-only; it was retried with
a writable temporary cache, without changing dependencies.

Fresh artifact: `/tmp/mojentic-package-jYuUiW/mojentic-2.1.0.tgz`, installed in
`/tmp/mojentic-package-jYuUiW`; SHA-256
`2fec0daff89cf0dac87c3488a903defb48a9e3b16c62ef1118bed48ed08946d5`.
Harness SHA-256 remains
`9682b48204c188be4e7b71332927fe5a12f2c7eddd5e6754ff1991d31254d44a`.
The lockfile SHA-256 remains
`a1fa41bfd32a2ea05fef34c7f3de7eb44c9282f6571d75452f92e3c8fdb65d2a`.

At that assessment, caller-selected profiles, Qwen3.8 profile validation, native reasoning history
serialization and opt-in retention (including oMLX preserve_thinking) remain
explicit implementation gaps. This documentation correction does not establish
coordinated release readiness; CI remains pending Foundry finalization.
No sibling edits, publication, tags or ref mutations occurred.

Suggested commit message for Foundry: `Correct reasoning control documentation to match verified wire mappings`.


## Prior explicit reasoning profiles correction

Tested source is `deb0bdd13d10fe578e5f72a0fe70432c447d6ff5` plus this uncommitted
worktree correction. Foundry owns finalization. The brief hash and the two binding
contract hashes above were verified again. Rust was read only as the semantic
reference at `2d17022ea6024f1090a967a62c20daface24b3e2`:
`src/llm/reasoning.rs` SHA-256
`d2bd8de6dbe33fd4eacd2f905da634a17ce5b47552fccf9ba5c1be63c58a7117`.
No sibling-port executable or dependent verification is claimed or needed for
this library's local distribution readiness.

The new public API is `CompletionConfig.reasoningProfile`, `ReasoningProfile`,
`QWEN3_8_REASONING_PROFILE`, and `validateReasoningProfile`. Validation runs before
HTTP and before recovery can dispatch. Profiles never select an effort default,
never depend on model names, and never enter request bodies. OpenAI's existing
registry is unchanged; provider rejection of disabled/enabled/xhigh runs before
profile validation, even for a profile supporting all six efforts.

The proof-first run characterized all 224 existing no-profile HTTP cases as
passing while the added test `rejects an unsupported selected profile effort
before recovery event HTTP` failed: high reached oMLX on an arbitrary alias with
an explicitly selected Qwen3.8 profile (exit 1). After the production guard was
added, the identical command `npm test -- --runInBand
src/llm/reasoning-effort-http.test.ts` passed all 225 tests (exit 0), with the
probe observing one typed request_failed event and zero HTTP requests. These
observed rejecting/corrected results and logs are retained in Foundry's validated
behavioral proof. Fixture and documentation expansion followed that proof.

### Executable contract identities and results

Both source verification and the fresh installed consumer consume the same
versioned profile selection fixture and existing full-wire fixture:

| Contract | SHA-256 |
| --- | --- |
| `ts-reasoning-profiles-v1` (`src/llm/gateways/__fixtures__/reasoning-profiles-v1.json`) | `9219cfb8d8f4f787513a2c5984d1db3fc78301118979016bddd27af6faaf21be` |
| `ts-reasoning-effort-v1` (existing, unchanged) | `88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a` |
| Packaged verification harness (`scripts/verify-package.cjs`) | `f3d0699e6e72170e9442f0b5392e0c6adf4d0fed8e488e791d4642092eaff2ea` |

`reasoning-effort-http.test.ts` uses public APIs and production HTTP gateways.
Its named `ts-reasoning-profiles-v1 $name` selections exercise an unselected
Qwen-looking model, explicit Qwen3.8 on an arbitrary alias, and a caller-defined
profile permitting all controls. Each selection runs seven effort cases (omitted
plus all six values), four provider modes (Ollama, oMLX, OpenAI reasoning and
ordinary registry modes), four routes (ordinary, structured, legacy stream,
event stream), recovery off/on: **672 cases**, including **192 pre-HTTP
rejections** and **480 exact full-body successes**. Responses/stream completion,
paths, typed errors and OpenAI legacy warnings are checked. Full-body equality
proves exact existing mappings, omitted effort without a default, mutually
exclusive oMLX controls and absence of profile/capability metadata on the wire.

`reasoning-profile.test.ts` names `advertises Qwen3.8 native history capability
without selecting a default effort`, `accepts Qwen3.8 %s exactly`, `rejects
unsupported Qwen3.8 %s`, and `validates caller-defined boolean-only capabilities`:
eight passing tests. The profile module has 100% coverage in every category.

The additional `broker profile propagation recovery=%s` cases use a real oMLX
HTTP gateway and a call-through gateway spy: `keeps the profile when constructing
structured configuration`, `keeps the profile through ordinary tool continuation`,
and `keeps the profile through streaming tool continuation`, each with recovery
off/on. All six pass with usable results and actual continuation requests; no
broker rewrite was needed. Shared `CompletionConfig` stays intact.

Source command `npm test -- --runInBand src/llm/reasoning-effort-http.test.ts
src/llm/reasoning-profile.test.ts` passed 687 tests before the full gates (672
matrix, eight validator, six broker, one proof regression). Final `npm test`
and coverage reran all these cases successfully. Installed command
`npm run verify:package` packed this working tree, installed it into a new
temporary consumer, compiled public declarations (including profiles), and passed
all **672 identical HTTP contract cases**, plus the retained package, recovery,
sampling and omission checks. No live provider/model benchmark or service-to-service
compatibility outside these declared cases is claimed.

Fresh artifact SHA-256: `67f4fc9e9cd48d06feb93c1535f0bb1c347b23547fed36f9cbccc8fcaa35230b`.
Artifact: `/tmp/mojentic-package-8RFJ5O/mojentic-2.1.0.tgz`; fresh consumer: `/tmp/mojentic-package-8RFJ5O`.

### Fresh quality results

| Command | Actual result |
| --- | --- |
| `npm run format` | Exit 0 |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 60 suites, 4,931 tests |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; fresh consumer plus 672 profile/wire contract cases |
| `npm test -- --coverage` | Exit 0; statements 87.87%, branches 83.65%, functions 90.43%, lines 88.23%; all exceed configured 70% thresholds |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `npm audit` | Exit 0; zero vulnerabilities including development dependencies |
| `npm outdated --cache /tmp/mojentic-npm-cache` | Exit 1; reports gpt-tokenizer current 4.0.3, wanted/latest 4.0.4; inventory only, no vulnerability reported by either audit |
| `npm run docs:build` | Exit 0; pages rendered; existing VitePress/Rolldown bundle diagnostics and transform deprecation remain |

All five `.hone-gates.json` gates passed after the source changes. Package
verification and docs build passed again after README synchronization. Verbose
commands used Foundry capture. Dependency versions were deliberately preserved:
package, lockfile and runtime remain at 2.1.0; the lockfile SHA-256 stays
`a1fa41bfd32a2ea05fef34c7f3de7eb44c9282f6571d75452f92e3c8fdb65d2a`.
No advisory was suppressed or allowlisted. The outdated patch is reported for
coordination under this task's version-preservation scope.

The following tested file identities distinguish the uncommitted source from
the base revision (including implementation, public exports and executable checks):

| File | SHA-256 |
| --- | --- |
| `src/llm/reasoning-profile.ts` | `33c972acaa2a2fe89a1761689b89110e492929f8a8135f87b8f8580a54b29ace` |
| `src/llm/models.ts` | `5b9af01379165157bb5cffc585004be8b4a19a04f685a682a6210a307744e91d` |
| `src/llm/index.ts` | `3ab82d1cee82340c15b73843c05b4c993656cb914f181c37229bd05c388aff03` |
| `src/llm/gateways/ollama.ts` | `258ba062ef7207b7497dd864ec8f35768cbf1d4a86c3afc5fdef1d537cd34acf` |
| `src/llm/gateways/omlx.ts` | `2cb046421c519dd60f1f224ef0c5ad4a399732da82faafcca895db4d49beaa52` |
| `src/llm/gateways/openai.ts` | `3ffda4120afaec7b4c878e63e275943b3eb3694eadec64e6764a4375704d3c8a` |
| `src/llm/reasoning-profile.test.ts` | `e3be4e3260eab96625bb7e14a8993bc72efde8387174238902252ed0e95f96ef` |
| `src/llm/reasoning-effort-http.test.ts` | `049020d72f2df102983c9fa84e66cb0df8a7be33f8269d18988cfca4732d4eff` |
| `scripts/verify-package.cjs` | `f3d0699e6e72170e9442f0b5392e0c6adf4d0fed8e488e791d4642092eaff2ea` |

At the end of the profile correction, native history remained unfinished.
The native history correction below supersedes that implementation gap.


## Native reasoning history: current correction

Base source: `ef35750e6d4316ff2d57af6865ae7fe18aceeda8`, plus the uncommitted
files identified below. Binding release and reasoning contract hashes were
rechecked against the authority table above; the initiative brief matched the
supplied SHA-256. Foundry owns Git finalization.

### Behavior and executable contracts

`ts-native-reasoning-history-v1` is
`src/llm/gateways/__fixtures__/reasoning-history-v1.json`, exercised by
`scripts/reasoning-history-contract.cjs` in both source tests and the installed
package consumer. The responses are versioned protocol fixtures, consumed by
production HTTP gateways; there are no independently authored gateway mocks.
This proves the declared library behavior, not live provider/model efficacy.

The initial real-HTTP streaming probe rejected the baseline because the actual
continuation omitted `reasoning_content`. After the source changes the same
probe passed with exact native reasoning, visible content, call ID, JSON
arguments and result order, plus `chat_template_kwargs.preserve_thinking`.
No count-only assertion substitutes for the wire comparison.

Named source evidence in `reasoning-history-contract.test.ts`:

- `preserves exact completed turns through later %s`: ordinary/streamed,
  retention off/on, recovery off/on, Ollama/oMLX, later success/HTTP failure;
  two exact calls, arguments and ordered results, separate native thinking.
- `does not fabricate native history from interrupted streams cancel=%s`:
  EOF and consumer cancellation after visible content leave caller history
  untouched and dispatch no tools. Malformed-frame and missing-successful-finish
  cases also exclude native history.
- `resends exact native history after admission stream=%s`: recovery retries
  compare full recorded destination/body objects, retaining completed native
  turns and executing tools once.
- `keeps absent native reasoning absent stream=%s`: optional native fields
  stay absent while visible content and completed tools continue normally.
- `applies history controls to structured requests`: exact caller-provided
  native history and preserve_thinking on actual structured HTTP requests.
- `rejects unsupported history before %s HTTP`: selected profiles without
  native history support and OpenAI reject before ordinary, structured, legacy
  stream and event-stream HTTP with recovery off/on.
- `excludes native history from OpenAI with recovery=%s`: exact OpenAI body
  excludes reasoning_content and chat_template_kwargs even with supplied thinking.

`reasoning-history-http.test.ts` preserves the small acceptance probe.
`reasoning-profile.test.ts` covers capability validation with omitted effort,
retention omitted/false/true. Existing `ts-reasoning-effort-v1` and
`ts-reasoning-profiles-v1` matrices remain unchanged and rerun in source and
installed gates. Existing recovery and timing suites protect admission,
semantic progress, cancellation and first-token behavior.

Migration is documented in `docs/reasoning-effort.md`, core/gateway API docs,
README and CHANGELOG Unreleased. `LlmMessage.thinking` and the optional third
`Message.assistant` argument hold supplied native history. `retainReasoning`
defaults off; enabling it preserves completed tool turns in the caller's array,
including after a later failure. Final visible answers are still returned
separately. Structured requests share the controls. OpenAI rejects true;
false/omission retains its previous behavior. No model profile is inferred.

### Current verification results

| Command | Actual result |
| --- | --- |
| `npm run format` | Exit 0 |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test` | Exit 0; 62 suites, 5,028 tests |
| `npm test -- --coverage` | Exit 0; statements 88.03%, branches 84.17%, functions 90.59%, lines 88.40%; each exceeds the configured 70% threshold |
| `npm run build` | Exit 0 |
| `npm run verify:package` | Exit 0; fresh install, public declaration compilation, identical native-history executable contract plus existing profile/effort/sampling/recovery contracts |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `npm audit` | Exit 0; zero vulnerabilities including development dependencies |
| `npm outdated` (writable `/tmp/mojentic-npm-cache`) | Exit 1; gpt-tokenizer current 4.0.3, wanted/latest 4.0.4; informational inventory, versions preserved as required |
| `npm run docs:build` | Exit 0; pages rendered; existing VitePress/Rolldown bundle diagnostics and transform deprecation remain |

All root `.hone-gates.json` gates and discovered CI quality commands were run.
After formatting the shared executable verifier, 105 targeted source tests and
the fresh package consumer passed again. Documentation and packaging were
rechecked after synchronizing the public message signatures. Versions and
security policies were unchanged; no advisory was suppressed or allowlisted.

Final packed artifact: `/tmp/mojentic-package-YTJFf8/mojentic-2.1.0.tgz`.
SHA-256: `34461e0e8ce14df946e7437c357de7729fbd590fcd49045f2dfa55840b0db2b3`.
Fresh consumer: `/tmp/mojentic-package-YTJFf8`.
The consumer installed only the tarball and runtime dependencies, compiled the
public declarations (including `thinking` and retention controls), and passed
`ts-native-reasoning-history-v1` plus the retained 672 effort/profile HTTP cases
and other package contracts.

### Tested source and contract identities

| File | SHA-256 |
| --- | --- |
| `package-lock.json` | `a1fa41bfd32a2ea05fef34c7f3de7eb44c9282f6571d75452f92e3c8fdb65d2a` |
| `package.json` | `4141e2345cdb6df2eccf6c93afb2948047174b5632aa0a4bb8fcd9f89024e964` |
| `scripts/reasoning-history-contract.cjs` | `493747da68c35ab0d9acb8fa3ad07831f4048418c14acb80ced580233c662ddb` |
| `scripts/reasoning-history-contract.d.cts` | `a86918cf14ce758102dce00605921fa950eb50a858c095e43b438db50229b604` |
| `scripts/verify-package.cjs` | `db10b2cc0a04d48ef3c0732030a1f069ae3b905aeb2ba1e6b55868f4fc36bf8d` |
| `src/index.ts` | `89942cedba1aa056a14cb574330b2faf78dd6d146d56440b366c8135516dab39` |
| `src/llm/broker.ts` | `42885083d0182eae9f94158d1118d0d5be1e8483b592b9d3c708299cd9f334a4` |
| `src/llm/gateways/__fixtures__/reasoning-effort-v1.json` | `88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a` |
| `src/llm/gateways/__fixtures__/reasoning-history-v1.json` | `bc4157be6010770537c998626fe11a10e300435c869afaa9a47b57cbc388f2d8` |
| `src/llm/gateways/__fixtures__/reasoning-profiles-v1.json` | `9219cfb8d8f4f787513a2c5984d1db3fc78301118979016bddd27af6faaf21be` |
| `src/llm/gateways/ollama.ts` | `37401fee0457333d5e2c4b29875ce488581e944fa63521003edfbce66dae8de1` |
| `src/llm/gateways/omlx.ts` | `c5c75c446c8f4b40ecd00e1d51af70407fa2c4e37520f7cd96058d81271bf4e1` |
| `src/llm/gateways/openai-chat-protocol.ts` | `afcfca75f1dac0cfe952e802f8acd1483a1e6a80748e7883f11a8a95269dd927` |
| `src/llm/gateways/openai-messages-adapter.ts` | `d0ffcc699216e54db9006102691e3b02b0aeb4224bac9f59f9f3f9cc6bf9aba7` |
| `src/llm/gateways/openai.ts` | `76c3075864bd76a2446a4a5ca910b29f2f1c3b1f100f7b5e33f9caea652e69ad` |
| `src/llm/models.ts` | `ad262109d7a60ff196167a187a264a900b53cbec0f1b04041dc244532a1746fd` |
| `src/llm/reasoning-history-contract.test.ts` | `e1e0736408399c92f3667d96e677ea89d2269c5f5ffdc5103809d27b002482dc` |
| `src/llm/reasoning-history-http.test.ts` | `f56f7c7c6f0bc19b88ac98141018808af274e91773f94f19527304dc133256cf` |
| `src/llm/reasoning-profile.test.ts` | `2f165004c317b8cebc8c2efee54ec93c68e6a4d4e06036126ec2f43100b975f4` |
| `src/llm/reasoning-profile.ts` | `11dd905b4d1bfcb557985b2ccc5384ad73cf6f8ee53aa80708219f1364a7edab` |

Coordinated publication and hosted CI remain pending. The parent PARITY update
is coordination work outside this authorized repository. No external counterpart
verification is required for this unreleased library, and none is claimed.
No genuine contract ambiguity was encountered within this correction's scope.

Suggested commit message for Foundry: `Add opt-in native reasoning history continuity`.
