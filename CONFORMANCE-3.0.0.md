# 3.0.0 bounded readiness assessment — 2026-10-17

**Not ready for coordinated release.** Recovery, context-window metadata,
first-token timing, output-limit corrections and explicit session temperature
zero have executable coverage. Native reasoning and request fidelity still have
substantive gaps below. This assessment preserves existing behavior; it does not
implement the missing features. Package, lockfile and runtime versions stay at
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

Tested TypeScript source: `54171796a2b02c0f0170d0758d2e3c693ad027c9`, plus
this uncommitted assessment, package verification and gate changes. Production
TypeScript is unchanged. Foundry owns finalization.
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
| temperature/numCtx/maxTokens optional without invented defaults | `output-limit-http.test.ts`: `preserves sampling defaults and reasoning controls without an output limit` characterizes current behavior | **Partial**: maxTokens corrected; OpenAI and oMLX invent temperature 1; ChatSession and deprecated broker entrypoint also default temperature. OpenAI internal args invent numCtx 32768, although it is not serialized; Ollama only sends configured num_ctx |
| One output limit; remove numPredict; serialize configured maxTokens exactly once per provider, including streams/retries/tools | `output-limit-http.test.ts`: `removes numPredict from the exported TypeScript CompletionConfig contract`; `ignores a stale JavaScript numPredict alias in favor of maxTokens`; configured limit matrix; `omits the output limit on recovered event requests and resends`; installed exact wire bodies | Covered; legacy behavior outside this correction preserved |
| Required Anthropic max_tokens fallback | No maintained Anthropic adapter/public export in TypeScript | Not applicable to current adapter set; implementing Anthropic would require its documented registry/4096 fallback |
| OpenAI fixed temperature rewrites caller-set value to only supported value; non-reasoning effort warns and drops | `gateways/openai.test.ts`: `should adapt parameters for reasoning models`; `should warn and ignore reasoning_effort for non-reasoning models` | **Partial**: warning/drop covered; fallback hardcodes 1 rather than deriving sole registry value. Omission remains incorrectly defaulted. Exact real-HTTP shape coverage for this complete rule is missing |
| Other configured sampling/shape fields, client-only settings never serialized | `output-limit-http.test.ts`: `characterizes unrelated request controls before output-limit correction`; installed full-body assertions | **Gap**: OpenAI drops topP, frequencyPenalty and presencePenalty; six-value Ollama think mapping missing. Current tests characterize defaults, not full fidelity |
| Default bodies omit temperature and limits; each configured control sent once; docs/CHANGELOG/PARITY aligned | Output-limit and context/timing guides exist, CHANGELOG has corrections. Installed probe records oMLX default temperature 1 as characterization | **Partial**: default-temperature contract fails; parent PARITY outside write scope. Do not claim full request fidelity |

## Parts 4–5, records, gates and CI

Part 4 is Kotlin's target removal, not a TypeScript mutation. It is not verified
here. Part 5 audit #4 is covered by `session-temperature-fixtures.json`,
the fixture matrices in `recovery-conformance.test.ts` and `streaming-recovery-conformance.test.ts` and the output-limit session tests:
explicit zero survives send/sendStream through maintained gateways. The omitted
session temperature of 1.0 is preserved behavior and remains a part-3 gap.
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

## Installed-artifact executable set

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
