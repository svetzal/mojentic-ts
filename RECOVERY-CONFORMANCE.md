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
| Capability/migration boundaries                          | Provider capability table, migration guide and example describe local abort, explicit sensitive hooks, unsupported remote cancellation/status and unknown idempotency. Client UUIDs prove correlation only.                                                                                                                                                                                                     |

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
idempotency is unknown and no remote termination evidence is claimed. Exact
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
