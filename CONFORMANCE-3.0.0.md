# 3.0.0 bounded readiness assessment — 2026-10-17

**Not ready for coordinated release.** Recovery, context-window metadata,
first-token timing, output-limit corrections and explicit session temperature
zero have executable coverage. Native reasoning and request fidelity still have
substantive gaps below. The bounded corrections below remove gateway-invented temperature/context
defaults and close OpenAI configured topP/frequencyPenalty/presencePenalty
forwarding. Other request-shape and reasoning gaps remain open. Package, lockfile and runtime versions stay at
2.1.0. No publication, consumer migration, ref mutation or sibling edits occurred.

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
the assessment, package verification and gate changes. Current correction source:
`716e6122f03c618a28f440bd18bfbe0ab63c2d1f` plus this uncommitted worktree diff. Production changes are limited to
OpenAI/oMLX request builders and configuration JSDoc. Foundry owns finalization.
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
| Reasoning: native assistant thinking separate from content/tool results; serialize Ollama thinking and oMLX reasoning_content in history | `gateways/omlx.test.ts`: `should map reasoning_content to thinking`; gateway response/stream fields exist | **Partial**: response separation exists; `LlmMessage` and broker lack native history serialization/retention |
| Disabled, Enabled, Low, Medium, High, XHigh remain distinct; boolean enable/disable versus exact named levels | `models.ts` exports only `'low' \| 'medium' \| 'high'`; Ollama `buildRequestBody` sends `think: true` for any effort | **Implementation gap**: Disabled/Enabled/XHigh absent; named levels conflated in Ollama; no six-value conformance matrix |
| Explicit caller-selected profiles validate efforts/history capability, never model-name guessing | No profile field/type/validator on `CompletionConfig` or broker. OpenAI registry still infers legacy capabilities by model name | **Implementation gap** |
| Qwen3.8 supports disabled/low/medium/xhigh and native history; omitted effort stays unknown | No caller-selectable Qwen3.8 profile or profile tests; current omission merely omits effort | **Implementation/evidence gap**; omission alone proves no profile semantics |
| Broker retention opt-in; completed ordinary/streamed tool responses retained, never fabricate native history from errors/cancellation | Existing recovery tool-history tests concern content/tool results, not native reasoning. No retention option | **Implementation gap** |
| oMLX preserve_thinking in chat_template_kwargs when retention enabled; recorded wire request | No retention flag or corresponding encoding/tests | **Implementation gap** |
| Structured output shares all native reasoning controls | Existing low/medium/high request paths share builders; no profile/new effort/retention controls | **Partial**; full ordinary/structured/streaming six-value matrix missing |
| OpenAI rejects unsupported new controls and does not accept oMLX history extension; legacy behavior preserved | New controls are absent from public types, but there is no runtime validator proving explicit rejection | **Implementation/evidence gap**; compile-time absence is insufficient |
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
| Other configured sampling/shape fields, client-only settings never serialized | `ts-openai-sampling-v1`: shared JSON cases in `output-limit-http.test.ts` and installed full-body assertions; `openai-sampling-http.test.ts`: tool continuation with retries | OpenAI topP/frequencyPenalty/presencePenalty covered; unrelated six-value Ollama think mapping remains missing |
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
unimplemented reasoning or request fidelity. README and gateway/streaming/recovery
examples were reviewed against the unchanged APIs; the gateway guide now states
the remaining reasoning/default limitations.

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


## Current temperature/context correction — 2026-10-17

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


## OpenAI configured sampling correction — 2026-10-17

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
