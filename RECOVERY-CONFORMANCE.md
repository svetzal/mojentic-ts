# TypeScript completion recovery replacement verification

This correction reviews the existing delivered implementation at
`6473f7c2e6b649cc99db8e1bc03ac06a6351d4ac`. Changes are public HTTP fixtures,
retained replacement evidence, and documentation. Runtime behavior, dependencies,
coverage floors and exclusions are unchanged. Foundry owns finalization; no worker
commit, push, merge, rebase, tag, release, ref mutation, sibling/harness write,
live inference or benchmark restart was performed.

## Binding inputs and synchronization

Both `TRANSIENT-RECOVERY-2026-10.md` and `RECOVERY-REQUEST-2026-10.txt` remain
normative. The October 10 supplement is now retained in
`.foundry/october-10-supplement.txt`, extracted from the TypeScript campaign output
in the verified controller receipt, with that complete output retained in
`.foundry/controller-ts-decision.txt`. The previous claim that the supplement
was unavailable is superseded.

The controller performed clean canonical-clone fetch and pull with rebase.
The authoritative receipt is
`/home/svetzal/.foundry/operations/mojentic-port-alignment-20261010/status-recovery/receipt.json`,
observed `2026-10-10T23:39:13.438723+00:00`. Its TypeScript HEAD is exactly
`6473f7c2e6b649cc99db8e1bc03ac06a6351d4ac`, matching this worker's read-only HEAD
inspection. `.foundry/controller-synchronization.json` records the receipt hash,
commands, actual zero exits, and individual log hashes. Every hash was verified;
the receipt and logs were copied into the durable `controller/` directory.
The controller's empty status/fetch logs are retained without inventing output.
Worker fetch/rebase is not a pending prerequisite or a claimed worker action.

The independent reviewer inspected Rust exactly at
`4ca1ed279c02eab37827a1ed07c30e961155ecf3`: recovery modules, public HTTP tests,
migration guide and conformance report. Exact reference files and SHA-256 hashes
are retained in `.foundry/reference-hashes.json` and the durable `reference/`
directory. `.foundry/independent-review.md` maps the normative requirements to
implementation and substantive public assertions, including initial findings
and subsequent fixture corrections. Whole-port alignment is **withheld** for
the session streaming limitation described below.

## Fresh proof before expanded verification

`.foundry/proof.json` has the required behavioral shape, with actual rejecting
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
`.foundry/probe-receipts.json` records final exact commands, timestamps, revisions,
exits, source hash and complete capture hashes. Both proof logs exist and their
contents and receipts are validated. An initial environment-only exit 127
(missing local Jest installation) is retained separately and is not the
behavioral rejecting result.

These are **fresh replacement captures**, dated by actual command timestamps
(October 11 UTC), not recovered historical chronology. Prior reports claiming
complete recovered historical evidence were too broad. Existing c1/c3 artifacts
are preserved byte-for-byte in durable `preserved-c1/` and `preserved-c3/`, with
sizes and hashes in `.foundry/preserved-receipts.json`, including 26 zero-byte
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
and lifecycle histories. `.foundry/public-http-traces.jsonl` extracts those
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
**`ChatSession.sendStream(query)` has no recovery parameter.** This existing
public session streaming path cannot exercise opt-in recovery. The supplement's
session-path requirement is therefore unmet for streaming, despite broker/gateway
streaming coverage. Adding the API is outside this replacement-evidence scope.

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

## Final measured checks and retained artifact index

Final commands, actual exits, timestamps and full stdout/stderr hashes are in
`.foundry/gate-receipts.json`. `.foundry/evidence-manifest.json` indexes final
source hashes, reference hashes, proof, traces, preserved receipts and durable
capture locations. The archive is
`/home/svetzal/.foundry/tool-logs/mojentic-ts-replacement-c4-20261010`.

Final amended-tree results: **51 suites / 1,515 tests pass**. Coverage is
**86.54% statements, 81.1% branches, 89.64% functions, 87.04% lines**, above each
unchanged global 70% floor. Lint (zero warnings), format check, full tests,
coverage tests, library build and docs build exit 0. Production moderate and
unfiltered audits exit 0 with zero vulnerabilities. Outdated inspection exits 1,
reporting only Prettier 3.9.9 → 3.9.10; dependencies were not changed. An earlier
outdated run failed on read-only npm cache access; its receipt remains separate.
The final inspection uses a writable temporary cache and actually completes.
Existing docs-build bundle/deprecation diagnostics remain in its full capture.
