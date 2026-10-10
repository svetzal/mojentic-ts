# TypeScript completion recovery conformance

Scope: opt-in ordinary, structured and streaming HTTP completions through Ollama,
oMLX and OpenAI, plus broker streaming tool recursion. This checkout contains
uncommitted source changes for Foundry. No release, ref changes, dependency
upgrades, sibling/harness writes, live inference or benchmark restart occurred.

## Authority and reference

The governing inputs are `TRANSIENT-RECOVERY-2026-10.md`,
`RECOVERY-REQUEST-2026-10.txt`, and the supplied October 10 correction plan. A
separate October 10 supplement file was not found; its location was requested.
The plan supplies the supplemental constraints used here.

The exact Rust revision is `4ca1ed279c02eab37827a1ed07c30e961155ecf3`.
Read-only inspection of `src/llm/recovery/{adapter,engine,frames,types}.rs` confirms
single-send transport ownership, streaming operation identity, observed/delivered
semantic progress, and Ollama validated Progress/Metrics before rejected finish
failure, with no semantic deliveries from a rejected terminal frame. An additional
public HTTP assertion first failed (exit 1) on a delivered terminal tool fragment
and then passed after withholding rejected-frame semantic delivery; those complete
logs and receipts are retained as auxiliary terminal proof. Source snapshots and SHA-256 hashes are retained with this run's evidence.
This comparison does not constitute independent whole-mission review or alignment
approval.

Successful fetch and `pull --rebase origin main` receipts are still finalization
prerequisites. This Foundry run explicitly prohibits commits, pushes, rebases,
merges, tags and ref changes, and the worktree Git metadata is read-only. No Git
synchronization was substituted with `ls-remote`, and no receipt is claimed.
Foundry must perform permitted synchronization and stop on conflict before landing.

## Proof first

`.foundry/proof.json` records the real rejecting exit 1 and corrected exit 0,
with complete existing logs. The public Ollama `generateStream` loopback probe
in `src/llm/streaming-recovery-http.test.ts` first rejects HEAD's direct streaming
path: the first 503 returns an error instead of recovering. The corrected source
admits the retry, compares server-observed payload buffers with exact captures,
correlates distinct attempt UUIDs under one logical identity, delivers content,
and closes the local socket while the consumer is paused. Its failed second
actual attempt precedes the sole cancellation event. This passing proof was
recorded before broader fixtures, docs and the full suite.

The delivered baseline lacked its referenced `.foundry/proof.json`. This run
creates a validated current proof and retains it outside the worktree. The older
ordinary/structured proof and complete evidence recovered from
`/home/svetzal/.foundry/tool-logs/mojentic-ts-transient-recovery-v2-c1-80fe3b/evidence`
are preserved separately as historical evidence, not this run's acceptance.

## Contracts and assertion locations

The shared completion engine keeps bounded eligibility, Retry-After, cancellable
admission/backoff, immutable one-time request encoding, UUID identity and private
original evidence. Streaming execution uses the existing one-POST Node HTTP
transport with no hidden retries or redirects. Ordinary/structured paths retain
their policy and tests. Omitted streaming recovery uses the original parsers,
transports and finish handling.

`src/llm/streaming-recovery-protocol.ts` contains semantic parsing and progress;
`src/llm/streaming-recovery.ts` owns HTTP readers, cancellation and delivery
backpressure. Observed bytes precede capture and delivery. Any observed semantic
output blocks replay. Capture failure cannot become success or authorize another
send. Returning or aborting closes locally owned resources, including when the
consumer is paused. Terminal acceptance waits for consumer readiness; cancellation
from terminal telemetry suppresses completion.

The public test matrix is in `src/llm/streaming-recovery-conformance.test.ts`.
Each provider/form describe block exercises both public APIs against a real
loopback HTTP server. The test names below are assertion anchors.

| Acceptance | Assertion anchor |
| --- | --- |
| Disabled compatibility | `characterizes disabled one-send HTTP failure`; `preserves disabled successful content and terminal behavior` |
| 503/immutable semantics/capture/identity/lifecycle | `recovers 503 with exact immutable requests, captures, identities and complete lifecycle`; `checkRequests` and `capturedResponse` |
| Retry-After variants and refusal | `honors Retry-After %s without shortening delay`; `refuses Retry-After beyond %s` |
| Bounded 504 and history | `bounds persistent 504 and retains every actual attempt in history` |
| Hidden resend/redirect prevention | `sends once without hidden resends or redirects on %s`, including 421 |
| Recovery-only deadline/eligibility | `keeps recovery deadlines out of admitted active generation`; `refuses unselected categories and statuses without invoking admission` |
| Ambiguous pending/allow/reject/required | `admits a pending ambiguous request only after explicit allow`; `rejects ambiguous admission without another send`; `requires explicit admission for ambiguous local sends` |
| Reasoning/content/tool interruption | `blocks replay after observed %s evidence` |
| Keepalive-only failure | `recovers keepalive-only transport failure after explicit admission` |
| Capture evidence | `retains observed but undelivered semantic bytes when capture rejects` |
| Permanent truncated bodies | `retains permanent %s despite truncated error bodies`, covering 400/401/403 |
| Cancellation phases | `cancels before sending`; `cancels a pending request before headers`; `cancels pending request capture`; `cancels pending response capture`; `does not resend while admission remains pending`; `cancels backoff` |
| Paused ownership/terminal cancellation | `closes a paused consumer before cancellation is delivered`; `closes owned resources when the consumer returns while paused`; `keeps terminal telemetry buffered behind content`; `cancellation from success telemetry suppresses buffered completion` |
| Provider telemetry and malformed frames | `retains accepted provider identity and reported usage`; `keeps rejected terminal telemetry`; `rejects malformed frames without invented telemetry` |
| Ollama ordering/frame reset | `emits length-terminated Progress/Metrics/Failed without completed tools`; `resets telemetry frame indices`; `cancellation from terminal metrics` |
| Credential/payload echo privacy | `keeps echoed provider metadata private on terminal failure`; 503 and capture-failure assertions; explicit inspection preserves originals |
| Escaped keys/legacy calls | `observes escaped semantic keys`; `observes whitespace-prefixed SSE`; `observes a legacy function call` |
| Broker event/cancellation forwarding | `broker event streaming recovers one turn`; `explicit event signal cannot override an aborted recovery signal` |
| Completed tools once | `broker executes completed tool once when the subsequent completion fails`: exact arguments/history, identical follow-up attempts, separate logical completion identity |

`src/llm/recovery-conformance.test.ts` retains ordinary/structured public tests,
including transport resends, redirects, admission, capture, permanent statuses,
privacy and broker/session tools. Existing gateway and broker suites remain
disabled-behavior regression checks. No coverage exclusions or floors changed.

## Capabilities and migration

All three adapters report streaming recovery and local HTTP abort as supported.
Remote per-request cancellation/status remain unsupported, idempotency unknown,
and remote termination evidence absent. Safe lifecycle contains no payload or
credential echoes. Explicit wire capture and failure inspection are sensitive.
Client UUIDs correlate attempts; they do not establish idempotency.

`docs/completion-recovery.md` and `examples/completion_recovery.ts` provide ordinary
and streaming migration examples. Single-turn stream events still forbid tools.
The broker chunk API retains its recursive tool loop and preserves completed
assistant/tool history on opt-in failure. `ChatSession.sendStream` retains its
existing signature; streaming recovery is available through the broker APIs.
No native reasoning-history field or unsupported generation control was added.
Ordinary finish handling and disabled-reasoning parity remain deferred.

## Measured results and retained evidence

Current measured gate results, actual command exits, complete capture paths,
source hashes, reference hashes and the durable artifact directory are recorded
in `.foundry/evidence-manifest.json`. Exact opt-in wire buffers, unmasked UUIDs,
and lifecycle histories for all 297 public matrix cases are retained in
`.foundry/streaming-http-traces.jsonl`; they contain only loopback sentinel data.
The complete archive is `/home/svetzal/.foundry/tool-logs/mojentic-ts-streaming-recovery-20261010-c3`. All 50 suites and 1,490 tests pass, including 297 public streaming matrix cases
and the proof-first streaming probe. Coverage is 86.54% statements, 81.1% branches,
89.64% functions and 87.04% lines, above the unchanged global 70% floors. Format,
zero-warning lint, format check, full tests, coverage, library build and docs build
exit 0. Production moderate and unfiltered audits exit 0 with zero vulnerabilities.
Outdated inspection exits 1 for Prettier 3.9.9 → 3.9.10; no dependency was changed.
Existing VitePress/Rolldown bundle and deprecation diagnostics are retained in the
complete successful docs-build log. Required checks include format, zero-warning lint,
format check, full tests, coverage at unchanged global 70% floors, library build,
docs build, production moderate audit, unfiltered audit and outdated inspection.

The historical coverage correction is **85.46% statements and 79.26% branches**.
These supersede the prior report's historical statement/branch percentages; they
are not presented as measurements of the new streaming implementation.

## Review and finalization prerequisites

- Foundry must complete successful fetch/rebase receipts using writable metadata,
  resolve no conflicts by assumption, and land focused changes on main.
- Independent whole-mission review and the separate October 10 supplement remain
  unverified. This report is evidence for review, not alignment approval.
- No remote termination/status/idempotency support, live provider behavior,
  original 504 origin, efficacy or benchmark conclusions are claimed.
