# TypeScript completion recovery replacement verification

Cycle 5 starts at preserved cycle-4 ref
`foundry-task/mojentic-ts-mojentic-ts-transient-recovery-v2-c4-869dbe`, exactly
`0f0505394c1b62852c03df0479061dd620c41b14`. The authorized October 11 correction
adds an optional recovery policy to `ChatSession.sendStream` through its existing
recursive broker tool path. String output, disabled behavior, successful-only
history sizing, dependencies, runtime pins, coverage floors and exclusions remain
unchanged. This report distinguishes retained cycle-4 evidence from fresh session
verification. Foundry owns finalization; no worker
commit, push, merge, rebase, tag, release, ref mutation, sibling/harness write,
live inference or benchmark restart was performed.

## Binding inputs and synchronization

Both `TRANSIENT-RECOVERY-2026-10.md` and `RECOVERY-REQUEST-2026-10.txt` remain
normative. The October 10 supplement is now retained in
`.foundry/cycle4/october-10-supplement.txt`, extracted from the TypeScript campaign output
in the verified controller receipt, with that complete output retained in
`.foundry/cycle4/controller-ts-decision.txt`. The previous claim that the supplement
was unavailable is superseded.

The controller performed clean canonical-clone fetch and pull with rebase.
The authoritative receipt is
`/home/svetzal/.foundry/operations/mojentic-port-alignment-20261010/status-recovery/receipt.json`,
observed `2026-10-10T23:39:13.438723+00:00`. Its TypeScript HEAD is exactly
`6473f7c2e6b649cc99db8e1bc03ac06a6351d4ac`, matching the current read-only `git ls-remote origin HEAD refs/heads/main`
inspection. The cycle-5 worker stays at preserved cycle-4 commit `0f05053`. `.foundry/cycle4/controller-synchronization.json` records the receipt hash,
commands, actual zero exits, and individual log hashes. Every hash was verified;
the receipt and logs were copied into the durable `controller/` directory.
The controller's empty status/fetch logs are retained without inventing output.
Worker fetch/rebase is not a pending prerequisite or a claimed worker action.

The independent reviewer inspected Rust exactly at
`4ca1ed279c02eab37827a1ed07c30e961155ecf3`: recovery modules, public HTTP tests,
migration guide and conformance report. Exact reference files and SHA-256 hashes
are retained in `.foundry/cycle4/reference-hashes.json` and the durable `reference/`
directory. `.foundry/cycle4/independent-review.md` maps the normative requirements to
implementation and substantive public assertions, including initial findings
and subsequent fixture corrections. That retained review disclosed the session streaming limitation now corrected
below; it remains historical evidence, not current approval of this amendment.

## Retained cycle-4 proof before expanded verification

`.foundry/cycle4/proof.json` has the required behavioral shape, with actual rejecting
exit **1** and corrected exit **0**. `src/llm/replacement-proof-http.test.ts` is a
new public Ollama `generateStream` loopback assertion, applied identically to
exported snapshots of preserved pre-streaming revision
`5578f4e672016f27113d0466752f010a40c22353` and delivered revision
`6473f7c2e6b649cc99db8e1bc03ac06a6351d4ac`. Git refs were never changed.

The rejecting assertion receives an error instead of recovered content after
HTTP 503. The corrected assertion verifies two identical server-received payload
buffers against request captures, exact response bytes, unmasked UUID identities,
ordered lifecycle, typed `RecoveryError` history for 503/200 attempts, and
observed/delivered progress. Abort closes the owned local HTTP socket while the
consumer is paused, before its next iteration. The failed actual attempt precedes
one cancellation event; remote termination remains explicitly unconfirmed.
This is a behavioral regression, not a marker toggle or count-only probe.

The first rejecting/passing pair completed before matrix expansion or the full
suite. Later proof repetitions strengthen the same assertion with exact history
checks and preserve identical source hashes across both revisions.
`.foundry/cycle4/probe-receipts.json` records final exact commands, timestamps, revisions,
exits, source hash and complete capture hashes. Both proof logs exist and their
contents and receipts are validated. An initial environment-only exit 127
(missing local Jest installation) is retained separately and is not the
behavioral rejecting result.

These are **fresh replacement captures**, dated by actual command timestamps
(October 11 UTC), not recovered historical chronology. Prior reports claiming
complete recovered historical evidence were too broad. Existing c1/c3 artifacts
are preserved byte-for-byte in durable `preserved-c1/` and `preserved-c3/`, with
sizes and hashes in `.foundry/cycle4/preserved-receipts.json`, including 26 zero-byte
files. Empty original receipts remain empty. No historical execution sequence
or missing original output has been reconstructed. The historical coverage
correction remains 85.46% statements / 79.26% branches; it is not a current
measurement.

## Public boundary coverage and substantive assertions

All verification uses scripted loopback HTTP and synthetic sentinel values.
There are no live model calls or mocked internal transport methods. Ordinary
and structured paths run through the public broker and real gateway adapters;
streaming paths exercise both public gateway forms and applicable broker paths.
All three maintained adapters are included: Ollama, oMLX and OpenAI.

| Requirement                                              | Implementation and executed public assertions                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable types, private original evidence, safe formatting | `recovery.ts` types and `inspectRecoveryFailure`; ordinary/structured numeric-status/history/privacy tests retain bytes, headers and causes while excluding credential/payload echoes from errors/events.                                                                                                                                                                                                       |
| Opt-in/default one attempt and legacy behavior           | Gateway recovery branches; ordinary/structured and streaming disabled failure/success cases assert actual sends and content. Existing gateway suites remain compatibility checks.                                                                                                                                                                                                                               |
| Immutable semantic request                               | `recoverCompletion` encodes once; 503 tests compare every server payload to captures and mutate caller inputs during admission. Messages, supported controls, tool descriptors/history, images and structured schemas remain fixed.                                                                                                                                                                             |
| No hidden resend or redirect                             | `CompletionTransportGateway` owns one Node HTTP/HTTPS POST; public selected 421 and redirect statuses assert actual send counts and complete lifecycle.                                                                                                                                                                                                                                                         |
| Retry limits, eligibility, Retry-After                   | Public ordinary/structured and streaming cases cover bounded 504 history, seconds/date/past/invalid/overflow values, ceilings, budgets, selected statuses/categories, and healthy generation outside recovery deadlines.                                                                                                                                                                                        |
| Cancellable ambiguous admission                          | Local-provider pending/allow/reject cases assert no resend before permission; active/admission/backoff cancellation and budget cases assert terminal outcomes and no later attempt.                                                                                                                                                                                                                             |
| Permanent status despite truncated body                  | Ordinary/structured and both streaming forms exercise 400/401/403 across providers. Streaming now asserts retained native body-read Error with `ECONNRESET`, exact partial bytes and incomplete capture, as well as ineligibility even under requested status retry.                                                                                                                                            |
| Observed evidence before failed capture                  | Streaming capture tests cover content, reasoning and tools separately across all providers/forms: exact multibyte counts, zero delivered counters, exact retained/captured bytes, identical typed `RangeError`, one send and ordered interruption. Ordinary/structured capture tests retain original exception and progress.                                                                                    |
| Typed errors through broker/session                      | New ordinary broker/session and both broker streaming forms assert exact capture-cause object identity, UTF-8 observed/undelivered progress, private bytes, actual history, one send and no credential echoes.                                                                                                                                                                                                  |
| Partial semantic output vs keepalive                     | Public content/reasoning/tool interruption cases prohibit replay; keepalive retains raw progress with zero semantic delivery and still requires ambiguous local admission.                                                                                                                                                                                                                                      |
| Cancellation precedence and paused ownership             | Active requests, pending captures, admission/backoff, terminal progress/metrics/success hooks, paused consumers and consumer return are tested. Socket closure is observed before consumer advancement; failed attempts precede one cancellation.                                                                                                                                                               |
| Successful/rejected terminal telemetry                   | Accepted cases assert full prompt/completion/total usage, provider identity, exact wire bytes and UTF-8 observed/delivered counters. Rejected Ollama length frame asserts all four durations, full usage, frame index, exact raw/semantic counts and identities, Progress → Metrics → Failed, zero delivered terminal tools and no completion. Malformed frames invent no telemetry; retry frame indices reset. |
| Tools execute once, attempts separate from completions   | Ordinary broker/session and streaming broker tests record exact tool invocations/arguments, preserved assistant/tool messages and immutable follow-up attempts. Two logical completions produce actual attempt sequence `[1,1,2]`; recovery does not replay the first tool.                                                                                                                                     |
| Capability/migration boundaries                          | Provider capability table and `recovery-capabilities.test.ts` public gateway cases map amendment item 3: unknown client abort, unsupported remote cancellation/status/idempotency and unknown exact-attempt termination. The deprecated snapshot retains unknown idempotency. See CONFORMANCE-3.0.0.md for inspection evidence and named cases. Client UUIDs prove correlation only.                                                                                                                                                                                                     |

The assertion implementation is in `src/llm/recovery-conformance.test.ts` and
`src/llm/streaming-recovery-conformance.test.ts`; the independent review gives
more specific anchors. Evidence-mode hooks now retain ordinary/structured traces
as well as streaming traces. The final complete test capture includes base64
server-received buffers, exact wire buffers/headers, unmasked logical/attempt IDs
and lifecycle histories. `.foundry/cycle4/public-http-traces.jsonl` extracts those
records without masking. Capture-hook failures intentionally occur before
semantic delivery; asserted typed causes are privately inspected, never placed
in safe telemetry.

Early expanded fixture failures are retained separately: incompatible generic
result types, Jest/native Error realm assumptions, an incorrect assumption that
event APIs deliver reasoning, and an ESLint dynamic-index warning. These were
corrected in tests without runtime changes, suppression or gate reductions.
They are not presented as historical production defects or successful gates.

## Capabilities and remaining binding limits

Recovery-enabled requests use Node HTTP/HTTPS, one POST per attempt, with no
redirect following or SDK retry layer. The stale migration statement about
native fetch/manual redirects has been corrected.

Ollama, oMLX and OpenAI support ordinary, structured and both streaming recovery
forms and local HTTP abort. Remote per-request cancellation/status are unsupported;
idempotency is unsupported for the inspected endpoints and exact-attempt termination
is unknown. See the dated evidence and named tests in [CONFORMANCE-3.0.0.md](CONFORMANCE-3.0.0.md). Exact
captures and explicit failure inspection are sensitive caller-owned facilities.
Safe errors/events omit credential and payload echoes.

`ChatSession.send` preserves typed failures and completed tool history.
`ChatSession.sendStream(query, recovery?)` now closes the disclosed session
streaming gap. It continues yielding content strings through the recursive broker
tool path. Enabled broker calls mutate supplied history; legacy calls copy it.
Completed assistant/tool messages survive follow-up failure, but incomplete final
assistant text is omitted. Streaming sizes broker-added history only after
successful consumption; failed streams do not immediately recalculate those token
counts. A later successful stream sizes retained history. This preserves legacy
context management, including its failure timing.

Delivery counters measure the gateway boundary: reasoning/tool fragments can be
consumed by the broker without appearing as session strings. Ollama emits
progress/metrics events; oMLX/OpenAI chunk paths do not emit those telemetry events.
Their absence is asserted without inventing fields.

`LlmMessage` has no supported native reasoning-history input field; no such
field was added. Immutable supported messages/images/tool history are verified,
but this does not prove Rust native reasoning-history parity. Gateway chunks
can deliver reasoning; event streams retain observed reasoning evidence but
have no reasoning delivery event, and correctly report zero delivered reasoning
bytes. Single-turn event streams continue to forbid tools. Ordinary finish
handling and disabled-reasoning parity remain deferred; realtime voice,
embeddings and residency operations remain outside completion recovery.

Independent whole-mission review was obtained, with exact Rust comparison and
substantive assertion inspection. It does not authorize unconditional alignment,
six-port parity, live-provider behavior, natural recovery efficacy, the original
504's origin or any release. Foundry retains Git finalization ownership.

## Retained cycle-4 measured checks and artifact index

Final commands, actual exits, timestamps and full stdout/stderr hashes are in
`.foundry/cycle4/gate-receipts.json`. `.foundry/cycle4/evidence-manifest.json` indexes final
source hashes, reference hashes, proof, traces, preserved receipts and durable
capture locations. The archive is
`/home/svetzal/.foundry/tool-logs/mojentic-ts-replacement-c4-20261010`.

Historical cycle-4 amended-tree results: **51 suites / 1,515 tests pass**. Coverage is
**86.54% statements, 81.1% branches, 89.64% functions, 87.04% lines**, above each
unchanged global 70% floor. Lint (zero warnings), format check, full tests,
coverage tests, library build and docs build exit 0. Production moderate and
unfiltered audits exit 0 with zero vulnerabilities. Outdated inspection exits 1,
reporting only Prettier 3.9.9 → 3.9.10; dependencies were not changed. An earlier
outdated run failed on read-only npm cache access; its receipt remains separate.
The final inspection uses a writable temporary cache and actually completes.
Existing docs-build bundle/deprecation diagnostics remain in its full capture.

## Fresh cycle-5 session proof and assertion evidence

The identical `session recovery proof preserves completed tools and exact admitted
follow-up bytes` probe first exited **1** on preserved source with a real Ollama
503 `GatewayError` after a completed tool; forwarding recovery through
`sendStream` made it exit **0**. `.foundry/proof.json` records actual commands and
existing logs. This early pair preceded session expansion and full gates. An
initial fixture type error is retained separately, not used as behavioral proof.

The probe checks public session → recursive broker → HTTP adapter behavior:
content strings, one tool execution with exact arguments, retained tool history,
temperature, identical server-received retry buffers equal to captures, distinct
logical completion IDs, unique attempt IDs and exact sequence `[1,1,2]`.
This is fresh behavioral evidence. The valid cycle-4 proof above is reused,
not rebuilt. Historical zero-byte receipts stay unchanged and do not establish
missing historical results.

`public session streaming` groups in
`src/llm/streaming-recovery-conformance.test.ts` cover all three providers through
real loopback HTTP, broker and session:

| Requirement | Substantive new assertion evidence |
| --- | --- |
| Legacy characterization | Disabled success, partial failure and consumer return assert exact content/history and tokenizer calls. Tool follow-up history remains copied. Legacy return does not promise transport cancellation. |
| Immutable supported input | Prior system/user/assistant history, tool schema and temperature match server JSON; external history snapshot mutation during admission changes neither session history nor retry bytes. Captures match server buffers. |
| Tool completion/history | Successful, exhausted and interrupted follow-ups execute `counter({value:7})` once, retain completed tool messages, omit unfinished assistant history, and assert distinct logical IDs, unique attempt IDs, one-based `[1,1,2]` or `[1,1]` sequences and fixed follow-up payloads. |
| Token/context behavior | Exact tokenizer inputs establish successful-only sizing, including later success after failure. A 35-token window asserts exact eviction order and subsequent server-received history after tool sizing. |
| Original causes/progress | Content/reasoning/tool capture failures retain identical typed `RangeError`, exact private bytes, bounded history, observed multibyte counts and zero delivery. Semantic transport interruption retains native `ECONNRESET`, gateway delivery counters and original lifecycle failure identity; incomplete tools never run. |
| Safe metadata | Error/event serialization excludes payload and credential sentinels while explicit inspection retains original private evidence. |
| Cancellation | Active requests, pending admission and backoff assert failure before exactly one cancellation, no subsequent success or send. Keepalive-only interruption uses explicit admission to recover. |
| Paused ownership | Active socket closure is awaited before advancing the consumer. Buffered terminal frames cancelled while paused produce typed failure without appending assistant history. Enabled consumer return closes resources. |
| Terminal hooks/telemetry | Ollama progress/metrics and oMLX/OpenAI response-wire hooks cancel buffered content before delivery. Exact Ollama token/duration metrics precede success; absent oMLX/OpenAI chunk telemetry is asserted. |

Fresh complete captures are retained outside the disposable worktree at
`/home/svetzal/.foundry/tool-logs/mojentic-ts-session-c5`.
`.foundry/probe-receipts.json` and `.foundry/gate-receipts.json` record timestamps,
source revisions/hashes, exits and durable complete-log hashes. All new captures
are labeled fresh; the original cycle-4 report is retained at
`.foundry/cycle4/RECOVERY-CONFORMANCE.md`.

Independent whole-mission review against normative inputs and exact Rust
`4ca1ed279c02eab37827a1ed07c30e961155ecf3` is recorded in
`.foundry/independent-review-c5.md`. Native reasoning-history input remains
unsupported; neither this correction nor review claims whole-port parity,
remote inference termination, live-provider efficacy or release authorization.
Foundry owns landing directly on main; there is no worker PR or Git finalization.

Fresh gate results and final source/evidence hashes are indexed in
`.foundry/evidence-manifest.json` after checks complete. Retained cycle-4 measured
results above remain historical, separate from this correction's measurements.

Fresh final results: **51 suites / 1,586 tests pass** (71 added public-session
assertions, including the early proof). Coverage is **86.69% statements, 81.39%
branches, 89.64% functions, 87.19% lines**, above unchanged global 70% floors.
Lint (zero warnings), format check, tests, coverage, build, docs build and both
production-moderate and unfiltered audits exit 0. Both audits report zero
vulnerabilities. `npm outdated` exits 1 with only Prettier 3.9.9 → 3.9.10;
no dependencies were changed. The docs build retains existing VitePress/Rolldown
bundle-assignment and deprecation diagnostics in its complete capture while
exiting 0; no gate was suppressed or waived.

## Current item-5 weekday correction

See [the current item-5 correction record](CONFORMANCE-3.0.0.md#item-5-correction-http-weekday-validation-current)
for preserved `ef9c713` rejecting evidence, corrected source and executable
fixture hashes, `retry-after-http-dates-v2`, public HTTP tests across all three
maintained providers and broker/session paths, and fresh gate results.
Prior measurements in this document remain historical. Local HTTP verification
does not supply the missing paired provider/consumer repository verification or
authorize publication. Package, lockfile and runtime versions remain unchanged.


## October 12 item 8 correction: typed errors

Tested base: `ba93b45340b34a5b73a44b40172a9643bb93b9e3`, plus the
uncommitted source identified below. Scope is item 8 only; reasoning, model
metadata, versions and binding contracts are unchanged. The verified initiative
brief SHA-256 is `ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e`.
The parent files are absent at this isolated worktree's `../` paths. Read-only
binding inputs were inspected in `/home/svetzal/Work/Projects/Personal/mojentic-unify`
at commit `4b08dcd1d87f520a4c70928c33a2bc84c228093d`; the recovery contract SHA-256
is `a53a3a4eb118fa4687dd703d6ce918dd40dd6cb4eda796abc6c429a6e932e7a3`.
No sibling repository was changed or executed.

The local executable regression set is `ts-recovery-typed-errors-v1`:
`src/llm/recovery-typed-errors-v1.json`, the item 8 cases in
`src/llm/recovery-conformance.test.ts`, and the broker catch characterization in
`src/llm/broker.test.ts`. It reuses the existing scripted loopback HTTP harness
and public gateway/broker/session APIs. No new binding contract is declared.

| Named test (each maintained provider) | Observable assertion |
| --- | --- |
| `item 8 exposes public policy error for $field through $route without wire effects` | Public `RecoveryPolicyError`, stable code/field; zero requests, captures and events across 11 routes |
| `item 8 rejects nonfinite policy before sending through %s` | Infinite deadline is typed and rejected before I/O |
| `item 8 retains exact capture cause through %s` | Request-hook exception identity; wire attempt zero, empty actual-attempt history |
| `item 8 retains original response capture exception through %s` | Exact response capture exception via explicit inspection; request body and safe serialization |
| `item 8 retains length cause and finish evidence without replay through %s` | Actual `StreamEventError`, incomplete-completion reason, retained length evidence, one exact request shape, no admission/replay, including missing SSE end marker |
| `item 8 rejects length tool responses through the session with typed finish evidence` | No tool execution, no fabricated assistant/tool history, typed cause, request body including tools |
| `item 8 preserves verified %s Error identity in broker catch paths` | Errors derived from public executable cases keep identity through response/text/object catches |
| `item 8 leaves recovery-disabled length handling unchanged` | Legacy successful response and finish evidence are preserved |
| `legacy thrown gateway errors / characterizes Error identity through %s` | `generateResponse` preserves Error identity; text/object catches retain unrelated legacy replacement behavior |

Before the source correction, the session length/tool regression failed for all
three providers: the expected typed length cause was absent after accepting the
tool response. The same probe passed after the correction (3 regressions and
3 catch characterizations). Reproduce it with:

```bash
npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/broker.test.ts -t 'item 8 rejects length|legacy thrown gateway'
npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/broker.test.ts -t 'item 8|legacy thrown gateway'
```

The first attempted probe could not start because Jest was absent (exit 127).
`npm ci --cache /tmp/mojentic-ts-npm-cache` installed locked dependencies before
the executable rejecting probe (exit 1) and corrected probe (exit 0). Neither
package nor lockfile changed. Subsequent matrix tests additionally exposed the
SSE length-without-end-marker replay path and now require terminal typed evidence.
Static policy errors are Result errors rather than thrown generic RangeErrors;
event streams retain them in `error.detail`, sessions throw them. Custom jitter
samples are validated at delay calculation, after the failed request/admission.

### Item 8 coordination gap

This is local conformance evidence. The scripted HTTP responder is not an
independently verified OpenAI, Ollama or oMLX implementation. No shared executable
typed-error contract mechanism or counterpart verification was found in this
checkout; the JSON/test hashes identify local cases only. No external consumer
or live provider was run. Counterpart tested commits, verification commands and
results are **missing**. Paired verification of the same identifiable contract
set, supported old/new versions, optional fields and error semantics remains
unfinished initiative work before consumer migrations or compatibility claims.
Parent PARITY.md synchronization is also assigned to initiative coordination;
this worktree is authorized for mojentic-ts changes only. Publication remains held.


### Item 8 tested source hashes and verification results

These SHA-256 values identify the tested uncommitted source on the base above;
Foundry will supply the final commit identity. The fixture and two test modules
together identify the executable local set, including supported recovery-disabled
behavior. They do not identify any verified counterpart implementation.

```text
358b2ca23b2c69cb592644fb8337d59b6f96d252228731d7a3d9295fe503e6d6  src/llm/recovery-typed-errors-v1.json
d57bf1c76b4281dcd4e7db58c0fc79433510d280908526bb58018fb032654850  src/llm/recovery-conformance.test.ts
fcb0452180310f60efc8e51bf9968d57befa12bec62bde35057eaa7f85c55288  src/llm/broker.test.ts
e273a0f59e961f7a2da0f28bb40939442e82abce896cc9713ef40468184b30b7  src/llm/recovery.ts
7bdf2f1201777280befb05e0f4e11e574f1d179f95fb486639879fe3a6b83270  src/llm/streaming-recovery.ts
4ce07613e2734ca823eee424f58ebc09d0477344f1eb0a64371c05838e4a4601  src/llm/broker.ts
ecc69fe22f9a33116c599781ee75fc1bde77d46333bcd27a6c6b7bf76922911f  src/llm/chat-session.ts
b15fa902bc7db9845db64c1a4f2be40a3c60c0d8799789e3d24f6ed540fa0add  src/llm/index.ts
1ab36aeabbb86c19f96e55cf47e4cbdfde8b50c7aac4c768a6711ade2cd5b422  .hone-gates.json
f8f0d5fad084bbc866735b3afe8a464f32532746bc222203ce90ab5c416108b3  package.json
0c19a83dda7352b8aa97700e438104425658cce9f53d0567dd97d17eb6d94a1c  package-lock.json
```

All verbose commands were run through `foundry capture`, preserving exit codes.

| Command | Result |
| --- | --- |
| `npm run format` | exit 0 |
| `npm run lint` | exit 0; zero warnings |
| `npm run format:check` | exit 0 |
| `npm test` | exit 0; 52 suites / 2,670 tests pass (312 additional tests) |
| `npm run build` | exit 0 |
| `npm test -- --coverage` | exit 0; 2,670 tests pass; statements 87.03%, branches 82.16%, functions 89.75%, lines 87.50%; every configured 70% threshold exceeded |
| `npm audit --omit=dev --audit-level=moderate --cache /tmp/mojentic-ts-npm-cache` | exit 0; zero vulnerabilities |
| `npm audit --cache /tmp/mojentic-ts-npm-cache` | exit 0; zero vulnerabilities, including development dependencies |
| `npm outdated --cache /tmp/mojentic-ts-npm-cache` | exit 1; ESLint 10.12.0 installed, 10.13.0 wanted/latest; versions preserved |
| `npm run docs:build` | exit 0; VitePress/Rolldown bundle-assignment diagnostics and transform deprecation emitted |

No security advisories were suppressed or allowlisted. The documentation tooling
diagnostics and available ESLint update remain unresolved, outside this typed-error
correction. No package, lockfile or runtime version changed. No commit, push,
merge, rebase, ref change, tag or publication was performed.
Suggested Foundry finalization message: `Preserve typed recovery errors across public completion APIs`.
