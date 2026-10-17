# 3.0.0 conformance: recovery corrections and session temperature

This is a partial conformance record for October 12 recovery amendment items 2, 3, 5 and 8
and release part 5, audit bug #4 (session temperature).
It is not 3.0.0 release readiness or cross-repository compatibility approval.
Package, runtime and lockfile versions remain unchanged at 2.1.0.

The binding authorization is [../RELEASE-3.0.0.md](../RELEASE-3.0.0.md).
The initiative brief was read and its SHA-256 verified as
`ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e`.
The authoritative parent `TRANSIENT-RECOVERY-2026-10.md`, including the amendment,
was inspected at parent commit `4b08dcd1d87f520a4c70928c33a2bc84c228093d`;
its SHA-256 is `a53a3a4eb118fa4687dd703d6ce918dd40dd6cb4eda796abc6c429a6e932e7a3`.
The port's older contract copy was preserved. The parent contract takes precedence.
Elixir's admission normalization was inspected at
`ddb2217c8245b041a20fd25f34f5aa6fbfaee2ce` (`lib/mojentic/llm/recovery.ex`):
only explicit allow/reject are decisions; unexpected completion and exceptions
produce `admission_no_decision`. Elixir was not executed in this task.

## Item 2: historical tested source and executable cases

TypeScript base HEAD: `7110811dcd9226e45187346f110b9e0691b2b834` plus the
uncommitted correction identified below. Foundry owns finalization; no commit,
ref update, tag, publication or sibling repository mutation was performed.
SHA-256 identifies the implementation, executable local HTTP test set and gate inputs:

```text
72c293612adffd364f3949f19156b78598690ee251d75e2de9212eace5b2d69d  src/llm/recovery.ts
185ccfeba77f178f7ae4aae0213426fe5cb64ece1894d626fb5f191d13eb9f84  src/llm/recovery-conformance.test.ts
c367218abcd0fd2b0c7902c80e8d5733423668cb25da4aafc74c73db70132174  src/llm/streaming-recovery-conformance.test.ts
f8f0d5fad084bbc866735b3afe8a464f32532746bc222203ce90ab5c416108b3  package.json
0c19a83dda7352b8aa97700e438104425658cce9f53d0567dd97d17eb6d94a1c  package-lock.json
15b756081c1cba6a581e2c9229403c13392a48828ce35720d3471b930993f948  jest.config.js
1ab36aeabbb86c19f96e55cf47e4cbdfde8b50c7aac4c768a6711ade2cd5b422  .hone-gates.json
```

The executable case set is the two existing public HTTP conformance files above,
identified by their content hashes, not a new shared protocol or mocked SDK.
They use real loopback HTTP servers with scripted provider responses. Requests
are decoded by the existing OpenAI, Ollama and oMLX adapters through public APIs.
The server records actual request bodies and destinations; captures are matched
to those bytes and to logical request IDs, attempt IDs and wire-attempt numbers.
The new tests queue a successful response after failure to expose an unauthorized
resend, and assert the actual terminal outcome, lifecycle and history.

| Decision or preservation check | Named tests | Scope |
| --- | --- | --- |
| Completed hook without allow/reject | `stops an undecided JavaScript admission return %p without caller rejection`; `stops an undecided JavaScript streaming admission return %p` | All three providers; ordinary, structured, chunk and event APIs; undefined, null, false, pending, cancelled, deadline and private object returns |
| Exception is no decision with private evidence | `retains an admission exception without calling it deadline exhaustion`; `reports a thrown admission hook as no decision with private evidence` | All providers and four API forms; exact exception object remains inspectable; absent from JSON, string and Node inspect formatting |
| Full prior attempts survive | `keeps complete history when a later admission completes without returning`; `keeps streaming history when later admission completes without returning` | 503, explicit allow, 502, no decision; exactly two identical requests to the selected endpoint; distinct attempt IDs under one logical ID |
| Broker/session propagation | `propagates an omitted admission return through the public session`; `propagates no decision through broker and session streaming without assistant history` | All providers; ordinary and structured matrix uses public broker APIs; streaming session forwards through broker; no fabricated assistant response or tool invocation |
| Explicit decisions | `keeps admission pending until explicit %s`; `rejects ambiguous admission without another send`; `recovers keepalive-only transport failure after explicit admission` | Pending sends nothing; allow permits recovery; reject remains admission_rejected |
| Cancellation and deadlines | `cancels an unresolved admission at the recovery budget and aborts its signal`; `rechecks the recovery budget immediately before sending after admission and delay`; `does not resend while admission remains pending and cancels that wait`; `expires a pending admission budget without timing out active generation` | Cancellation and deadline outcomes preserved; hook signal aborted; no extra send |
| Absent hook | `requires ambiguous local admission while OpenAI may use policy admission`; provider/form `requires explicit admission for ambiguous local sends` cases | Existing remote policy retry and local admission-required behavior preserved |

Each no-decision outcome ends in a matching `admission_no_decision` lifecycle
event with the original failure, progress and attempt identity. Explicit reject
remains caller rejection. Invalid hook values cannot impersonate cancellation or
deadlines. A pending promise continues waiting under existing cancellation and
budget rules. Migration guidance is in [completion recovery](docs/completion-recovery.md)
and CHANGELOG Unreleased, including exhaustive public union switches.

## Item 2: historical commands and results

All verbose commands were run using
`foundry capture --log-dir .foundry/logs -- <command>`; evidence is archived by
Foundry rather than shipped with the repository.

Before changing admission handling:

- `npm ci`: passed from the existing lockfile, with no dependency changes.
- `npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts`:
  713 tests passed, characterizing existing decisions, exceptions, cancellation,
  deadlines and absent-hook policy.
- `npm test -- --runInBand src/llm/streaming-recovery-conformance.test.ts -t 'reports a thrown admission hook as no decision'`:
  rejecting exit 1, six failures showing admission_rejected instead of
  admission_no_decision; after the engine correction, exit 0, six passed. This
  is the behavioral proof through the actual HTTP boundary, not a marker test.
- Expanded targeted suite: 821 tests passed before the final destination
  assertion refinement; the full gate runs below cover the final source.

Failure reconciliation: the first test invocation exited 127 because Jest was
not installed; `npm ci` resolved it. This was not used as behavioral proof.
The first lint run exited 1 for an indexed object lookup in the new destination
helper. Provider fixture fields replaced the lookup; no warning was suppressed.
The expected rejecting probe is separate from those setup/lint failures.

Final checks on the hashed source above:

| Exact command | Exit | Result |
| --- | --- | --- |
| `npm run format` | 0 | Source/examples formatted; no unrelated changes |
| `npm run lint` | 0 | Zero errors and zero warnings |
| `npm run format:check` | 0 | Passed |
| `npm test` | 0 | 51 suites, 1,700 tests passed |
| `npm run build` | 0 | TypeScript build passed |
| `npm test -- --coverage` | 0 | 51 suites, 1,700 tests passed; all existing 70% thresholds passed |
| `npm audit` | 0 | 0 vulnerabilities, full dependency tree |
| `npm audit --omit=dev --audit-level=moderate` | 0 | 0 vulnerabilities, production dependencies |
| `npm outdated` | 1 | Initial attempt blocked by read-only default npm cache |
| `npm_config_cache=/tmp/mojentic-ts-npm-cache npm outdated` | 1 | Successful registry query; ESLint current 10.12.0, wanted/latest 10.13.0 |
| `npm run docs:build` | 0 | VitePress production build passed |

The environment assignment on the successful outdated query was applied to its
`foundry capture` invocation. Exit 1 is npm's outdated-package report, not a
failed query. Dependencies remain unchanged as required; both security audits
are clean. No advisory was ignored, suppressed or allowlisted.
Coverage: statements **86.69%**, branches **81.46%**, functions **89.64%**,
lines **87.20%**. All four `.hone-gates.json` gates passed. The proof JSON was
validated for shape, types, actual rejecting/corrected exit codes and existing
nonempty logs, with six failed-before and six passed-after public HTTP probes.
`git diff --check` passed.

## Item 5: historical Retry-After HTTP dates

Current tested TypeScript base revision:
`ccc1fe2fed735bbfd1f6dd3a0e471a6a90ad0abc`, plus the uncommitted item-5
correction. The item-2 hashes and results above are historical evidence from
that earlier correction, not hashes of the current working tree.
The parent contract and initiative brief were re-read and their hashes above
verified unchanged. Only TypeScript was changed; parent PARITY.md and other
ports remain outside this worktree's authorization.

The local executable fixture version is `retry-after-http-dates-v1`, with
26 deterministic cases shared by both existing public HTTP conformance suites.
The JSON fixture SHA-256 is
`29da81c5a18457ffa0c9f2f1fcc023db5f4cdedfc96ec40ce360ef2cb2da8ed5`.
The executable fixture-set SHA-256 is
`d3c7914bbb14803a031669b9c5d77f09c8042ce455fcc2a33386b0eb7d479372`.
It hashes the UTF-8 output (including final newlines) of:

```sh
sha256sum src/llm/retry-after-fixtures.json src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts
```

Current file hashes:

```text
876ea50d93f496ec5c57d50652fdcee500c909ae5414694a388a3335e631f0e3  src/llm/recovery.ts
29da81c5a18457ffa0c9f2f1fcc023db5f4cdedfc96ec40ce360ef2cb2da8ed5  src/llm/retry-after-fixtures.json
9deb03d4e9ead298ed33013bf2ff755286e4a9f5c7b8e56453707d56e5f80460  src/llm/recovery-conformance.test.ts
742da209979ba7b9652dfb4a30d6eaaaf7ee07fef28d0310e388ab10e4ee82e8  src/llm/streaming-recovery-conformance.test.ts
```

### Item-5 named-test mapping

Every row runs for OpenAI, Ollama and oMLX using real fetch against loopback
HTTP fixtures. No live inference, fetch mocks or independently authored gateway
mocks establish this evidence. Wall and monotonic clocks, jitter and sleep are
injected deterministically; HTTP destinations and bytes are recorded.

| Named test | Boundary and assertions |
| --- | --- |
| `handles Retry-After $name without shortening the minimum` | Public broker ordinary and structured paths: all three date forms, parsed UTC timestamps and remaining delay; seconds, absent/invalid/overflow and non-HTTP date strings; zero remaining delay for past dates while preserving policy jitter; exact sleep and lifecycle delay; provider ceiling/budget refusal, including obsolete dates; immutable payloads, destinations, distinct attempt IDs, one logical request, safe telemetry. |
| `honors Retry-After $name without shortening delay` | Both maintained gateway streaming forms (chunks and events): the same fixture set and semantics, identical request bytes and destinations, distinct wire-attempt identities and captures, refusal with one send and no scheduled sleep. |
| `propagates Retry-After $name through broker and session` | Ordinary session via broker: the same parsed failure and lifecycle delays, refusal outcomes, byte/destination fidelity, unique attempts; assistant history is added only on success. |
| `propagates Retry-After $name through broker and session streaming` | Streaming session via broker: the same fixture set, parsed failures, exact delays, unchanged request destination/payload, identities, successful output or refusal without resend or assistant history. |

The RFC 850 cases include future years that JavaScript's fixed two-digit-year
pivot would incorrectly treat as past, the exact 50-year boundary, and a date
just beyond it. asctime is explicitly UTC even under the execution environment's
`America/Toronto` timezone. Non-HTTP ISO timestamps, locale dates and missing
GMT remain invalid. Recovery admission, cancellation, privacy and disabled-path
behavior retain their full-suite regression coverage; this is preservation
evidence, not new conformance signoff for unrelated amendment decisions.

### Item-5 commands and results

Each verbose command used the Foundry capture wrapper described above.
The first probe exited 127 because Jest was not installed; `npm ci` then passed
without changing the lockfile. This setup failure is not behavioral proof.

Before changing production code, the public refusal probe below exited 1:
12 tests incorrectly succeeded instead of refusing ceiling/budget violations.
After the shape correction, six asctime tests still failed because JavaScript
used the machine's local timezone; explicit UTC normalization corrected that.
The final expanded probe exited 0 with 18 tests passed, including sessions. Proof logs and validated behavioral
JSON are archived as Foundry execution evidence, outside shipped project files.

| Exact command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | Installed existing lockfile; package, lockfile and runtime unchanged |
| `npm test -- --runInBand src/llm/recovery-conformance.test.ts -t 'Retry-After (RFC850 ceiling\|asctime budget)'` | 1 then 0 | 12 rejecting probes, then 18 passing probes through ordinary/structured broker and session HTTP boundaries |
| `npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts -t Retry-After` | 0 | 468 passed across both HTTP suites, including session propagation |
| `npm run format` | 0 | Formatted source/examples |
| `npm run lint` | 0 | Zero errors and warnings |
| `npm run format:check` | 0 | Passed |
| `npm test` | 0 | 51 suites, 2,084 tests passed |
| `npm run build` | 0 | TypeScript build passed |
| `npm test -- --coverage` | 0 | 51 suites, 2,084 tests passed; existing 70% thresholds passed |
| `npm audit` | 0 | Full tree: 0 vulnerabilities |
| `npm audit --omit=dev --audit-level=moderate` | 0 | Production tree: 0 vulnerabilities |
| `npm_config_cache=/tmp/mojentic-ts-npm-cache npm outdated` | 1 | Successful registry query: ESLint 10.12.0 current, 10.13.0 wanted/latest |
| `npm run docs:build` | 0 | VitePress production build passed |

Outdated exit 1 reports a newer package, not a security finding. Dependencies
remain unchanged as required; no advisory was suppressed or allowlisted.
All four required `.hone-gates.json` gates passed. Coverage: statements **86.73%**, branches **81.54%**, functions **89.70%**,
lines **87.23%**. `git diff --check` and behavioral proof validation passed.

This is local TypeScript HTTP boundary evidence for item 5, not paired
cross-repository verification. The fixtures script provider responses and record
actual adapter requests; no provider repository/commit or consumer repository
was verified against this executable set. Provider-side verification commands,
consumer commits and consumer-side verification results are missing and remain
coordination work before compatibility claims or consumer migrations. The broader
publication hold remains in force. Suggested finalization message:
`fix: honor all HTTP Retry-After date forms in recovery`.

## Item 5 correction: HTTP weekday validation (current)

Tested base: preserved cycle-2 TypeScript
`ef9c713445550dcc52c3850451b7fd7cc9963053`, plus the uncommitted correction
identified by these hashes. Foundry owns Git finalization.
The initiative brief hash above was verified again. The parent release record
is unavailable at `../RELEASE-3.0.0.md` in this isolated worktree; the prior
parent-contract inspection above is historical evidence, not a fresh reading.

The parser now admits only HTTP short weekday names for IMF-fixdate/asctime
and full names for RFC 850 before date parsing. No other recovery decision or
version changed. The local executable fixture set is `retry-after-http-dates-v2`:
38 cases, preserving all 26 v1 cases and adding 12 malformed weekday cases.
They include `Garbage, 10-Oct-26 00:00:04 GMT` and
`Foo Oct 10 00:00:04 2026`, unknown/truncated names, incorrect short/full forms
and incorrect case across all three date forms. At the fixed clock every new
header is invalid, sleeps exactly 100 ms under a 3000 ms ceiling, and succeeds
on replay. Provider frames and expected behavior derive from the same shared
fixture mechanism; no live providers or fetch mocks are used.

Current implementation SHA-256: `679388f921b1771f4daa90455855495c35bb08a9393d69e8596b8fbe898f7aec`.
Fixture-set SHA-256: `e2dec3a652bdac185e91333ff3d2a87a3ae5c6a3f8d1344ea5de65b17088c1ac`,
computed by hashing the exact UTF-8 `sha256sum` output below:

```text
1b11f27fb5b0c07d635167cc9e65dcf5d176c617ce88daa5c43cedbd64874992  src/llm/retry-after-fixtures.json
d3bd090e427da29d232990598f9c590a306988a7f973099cde717b8b605d9efb  src/llm/recovery-conformance.test.ts
742da209979ba7b9652dfb4a30d6eaaaf7ee07fef28d0310e388ab10e4ee82e8  src/llm/streaming-recovery-conformance.test.ts
```

Named public tests are the item-5 mapping above, now consuming v2. Ordinary and
structured results assert actual content/objects, exact scheduled and injected
sleeper delays, parsed failure metadata, server-received request bytes and
destinations, capture agreement and wire/logical identities. Streaming chunks,
streaming events and ordinary/streaming sessions assert successful content and
history, request replay, identities and exact delays. The dedicated
`rejects a malformed RFC850 weekday through public HTTP recovery` probe also
asserts the complete admission/retry/success lifecycle.

Proof first: before expanding fixtures or documentation, the ordinary public
HTTP probe failed on all three providers against unchanged preserved production
source (exit 1): the invalid token became a 4000 ms date. With only weekday
validation corrected, the identical command passed all three (exit 0), including
actual resend, exact 100 ms delay and successful results. Missing Jest initially
caused a setup failure (127); `npm ci` resolved it without dependency changes.
That setup failure is not behavioral evidence.

After expansion, temporarily restoring only `src/llm/recovery.ts` from the exact
preserved commit and running the new malformed-weekday cases produced 90 failed
and 126 passed cases (exit 1). Already rejected malformed tokens remain rejected.
Restoring corrected source passed all 690 focused cases (exit 0), including
all v1 valid/invalid/absent, seconds, UTC, rolling-year, ceiling and budget cases.
No Git refs or sibling files were changed to perform this comparison.

Commands (each through `foundry capture --log-dir`):

- Initial proof: `npm test -- --runInBand src/llm/recovery-conformance.test.ts -t 'ordinary rejects a malformed RFC850 weekday'` (1 then 0).
- Preserved-source expanded regressions: `npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts -t 'invalid weekday'` (1).
- Corrected full date matrix: `npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts -t 'Retry-After|malformed RFC850'` (0).

Fresh validation on the corrected source:

| Command | Exit | Result |
| --- | --- | --- |
| `npm run format` | 0 | Source/examples formatted |
| `npm run lint` | 0 | Zero warnings |
| `npm run format:check` | 0 | Passed |
| `npm test` | 0 | 51 suites / 2,306 tests passed |
| `npm run build` | 0 | Passed |
| `npm test -- --coverage` | 0 | 2,306 tests; statements 86.73%, branches 81.54%, functions 89.70%, lines 87.23%; all 70% floors passed |
| `npm audit` | 0 | Zero vulnerabilities |
| `npm audit --omit=dev --audit-level=moderate` | 0 | Zero vulnerabilities |
| `npm_config_cache=/tmp/mojentic-ts-npm-cache npm outdated` | 1 | Successful registry query; ESLint 10.12.0 current, 10.13.0 wanted/latest |
| `npm run docs:build` | 0 | Passed; existing VitePress/Rolldown bundle-assignment and deprecation diagnostics retained |

The final four `.hone-gates.json` commands were repeated after test cleanup and
all exited 0. The focused 690-case date matrix also passed with
`TZ=America/Toronto` (exit 0), confirming that asctime normalization remains UTC.

Outdated exit 1 reports the available ESLint release, not an advisory. No
suppression or dependency change was made. Package, lockfile and runtime source
are byte-for-byte unchanged from the preserved commit. Complete captures and
validated behavioral proof are retained as Foundry execution evidence, outside
shipped project files.

This is local TypeScript boundary verification, not paired cross-repository
verification. No provider or consumer repository commit was tested against v1
or v2; their verification commands and results remain missing coordination work.
The publication hold and separately authorized consumer migration requirements
remain in force. No compatibility or complete 3.0.0 readiness claim is made.
The parent parity update also remains outside this repository's write scope.

## Remaining decisions: unverified

Amendment item 2 retains its earlier evidence; item 5 now has the local boundary
evidence above. Items 1, 3, 4, 6, 7 and 8 do not receive complete conformance
signoff from these corrections.
Regression checks for absent hooks and other existing behavior are preservation
evidence, not a complete audit of those decisions. In particular capability
citations, provider metadata rules, streaming capture,
keepalive behavior and remaining robustness decisions need their own mappings.
All remaining October 9 recovery contract decisions, native reasoning, model
metadata/request fidelity remain unverified for 3.0.0. The focused session
temperature correction is verified locally below. Existing regression tests do not establish their full
contract conformance. No versions or quality thresholds were changed.

No shared executable contract was changed. The local provider scripts exercise
TypeScript adapters; they are not paired consumer/provider verification against
a live provider or another port. No consumer repository was authorized for this
task, so consumer commits, a shared versioned executable set and consumer-side
verification results are unavailable. Coordination must supply those before any
cross-repository compatibility claim or consumer migration. Neither inspection
of Elixir nor matching lifecycle names proves paired verification. Release and
publication remain on hold pending the broader initiative conditions.

## Part 5, audit bug #4: explicit session temperature zero

Tested TypeScript base: `020fbf98f8693267130f8dbdd570f3be18bb316a`, plus
this uncommitted correction. The binding release part 5 and initiative brief
were inspected; the brief hash matches the authorization recorded above.
Foundry owns finalization. No refs, package/runtime versions, dependencies,
coverage thresholds, CI requirements or other repositories were changed.

`ChatSession` now defaults temperature with `??` instead of `||`. Explicit
zero reaches both public send methods; omission retains `1.0` and explicit
nonzero values remain unchanged. Broader request-default fidelity belongs to
release part 3 and is outside this correction.

The local executable case set is `session-temperature-v1`, stored in
`src/llm/session-temperature-fixtures.json` and consumed by the two existing
HTTP conformance harnesses. The maintained OpenAI, Ollama and oMLX adapters
and the real broker/session send actual HTTP requests to the existing scripted
loopback providers. No fetch, broker or gateway mocks are used. The counter
tool is a real executable tool. This is local adapter boundary conformance,
not evidence of a live provider or another repository verifying these cases.

Named tests (each expanded for `zero`, `omitted`, `nonzero`, and `recovery` /
`disabled`, for each of the three adapters; 36 cases):

- `preserves session temperature $name through send $mode and tool follow-ups`
- `preserves session temperature $name through sendStream $mode and tool follow-ups`

Each checks returned content, exactly-once tool execution, successful conversation
history, assistant/tool history in the actual follow-up request, and every wire
request's temperature (`options.temperature` for Ollama). Recovery cases inject
HTTP 503 before both the initial tool response and the final answer, verifying
byte-identical resends at both stages. Recovery retains completed tool history;
disabled recovery preserves its existing session-history copying behavior.
Omitted temperature sends `1`; explicit `0.4` sends `0.4` on every request.

### Rejecting and passing evidence

Before expanding the case matrix or documentation, six zero-temperature recovery
cases were added against the unchanged base implementation. The command
`npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts -t 'preserves session temperature zero'`
exited **1**: all six rejected actual provider temperature `1` where `0` was
required, after successful content and history assertions. Changing only the
constructor fallback made the identical command exit **0** (six passing cases).
The later expanded command, with `-t 'preserves session temperature'`, exited
**0** with all 36 cases passing. Full logs, actual probe exit codes and validated
behavioral proof are retained in Foundry execution evidence, outside shipped
project files.

Final source and executable-set SHA-256 identities:

```text
9689cd6fc823a1245ffba4df9efa43060c0850c813a948051b56ccc263836a46  src/llm/chat-session.ts
45925454779ac55586adb87ce531e989cfb62bcbca3637c162a0bb2032cd5bf2  src/llm/session-temperature-fixtures.json
244d89e7ba312ede1509d33a62151014e686ca9f3c884f9d9be67136cef37107  src/llm/recovery-conformance.test.ts
2c783bea25db9a97a0946df68d36b2fbca4e15b64ed99587e291135c41bfa9c9  src/llm/streaming-recovery-conformance.test.ts
```

### Verification results

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | Installed the unchanged lockfile |
| `npm run format` | 0 | Formatted source and examples |
| `npm run lint` | 0 | Zero warnings |
| `npm run format:check` | 0 | Passed |
| `npm test` | 0 | 51 suites, 2,342 tests passed |
| `npm run build` | 0 | Passed |
| `npm test -- --coverage` | 0 | 2,342 tests passed; statements 86.73%, branches 81.54%, functions 89.70%, lines 87.23%; all unchanged 70% floors passed |
| `npm audit --omit=dev --audit-level=moderate` | 0 | Zero vulnerabilities |
| `npm audit` | 0 | Zero vulnerabilities |
| `npm_config_cache=/tmp/mojentic-ts-npm-cache npm outdated` | 1 | Registry query succeeded; only ESLint is outdated: current 10.12.0, wanted/latest 10.13.0 |
| `npm run docs:build` | 0 | Passed; existing VitePress/Rolldown plugin diagnostics and transformWithEsbuild deprecation remain |

All four `.hone-gates.json` commands passed in their declared order. The first
`npm outdated` attempt could not write the default cache on the read-only
filesystem; rerunning with the writable cache above completed the query.
Exit 1 reports the available ESLint update, not a security advisory. No advisory
was suppressed, no dependencies were changed, and no test thresholds were lowered.
The documentation tutorial and public configuration JSDoc now explain that zero
is retained and omission keeps `1.0`. README and examples need no API changes.

### Cross-repository verification gap

Only TypeScript base `020fbf98f8693267130f8dbdd570f3be18bb316a` plus these
worktree changes was executed. No external provider or consumer commit was
verified against `session-temperature-v1`; commands and results for those sides
are missing. Paired verification requires separately authorized coordination
using the same identifiable executable cases. No paired compatibility, consumer
migration readiness or coordinated 3.0.0 release readiness is claimed. The parent
PARITY.md update remains outside this repository's write scope; publication
remains on hold.


## Item 3: endpoint capability declarations (clientAbort correction)

Tested TypeScript base: `ba8f95a6b7ae4fc94516e54361130f7c2d79de46` plus the
uncommitted correction identified below. The binding parent contract is the
October 12 amendment, SHA-256
`a53a3a4eb118fa4687dd703d6ce918dd40dd6cb4eda796abc6c429a6e932e7a3`,
at parent commit `4b08dcd1d87f520a4c70928c33a2bc84c228093d`.
This correction addresses only documentation-backed `clientAbort` reporting.

### Inspection and classification

Actual inspection date: **2026-10-17 UTC**, read from the execution clock.
Each provider's maintained endpoint documentation was opened before classification:

| Endpoint and inspected provider documentation | Evidence and classification |
| --- | --- |
| [OpenAI `/v1/chat/completions`](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) | Request/streaming options do not describe how a client aborts. The interrupted-stream usage warning is ambiguous about the facility. `clientAbort: unknown`. |
| [Ollama `/api/chat`](https://docs.ollama.com/api/chat) | Chat parameters, streaming, keep-alive and response fields do not describe a client abort facility. `clientAbort: unknown`. |
| [oMLX `/v1/chat/completions`](https://github.com/jundot/omlx/blob/main/README.md#api-compatibility) | API Compatibility lists streaming Chat Completions without describing client abort. `clientAbort: unknown`. |

Node HTTP documentation alone cannot establish endpoint support. These
classifications do not assert that local abort is impossible or that remote
inference stops. Other capability values, their evidence and the deprecated
`completionRecoveryCapabilities` snapshot are preserved. See the
[capability table and migration](docs/completion-recovery.md#adapter-capabilities-and-preserved-semantics).

### Named executable cases

`src/llm/recovery-capabilities.test.ts` exercises actual gateway instances through
the public LLM barrel exports. Under `recovery capability endpoint evidence`,
each of OpenAI, Ollama and oMLX runs:

- `should expose clientAbort as unknown with endpoint evidence`
- `should expose requestCancellation as unsupported with endpoint evidence`
- `should expose requestStatus as unsupported with endpoint evidence`
- `should expose idempotency as unsupported with endpoint evidence`
- `should expose exactAttemptTermination as unknown with endpoint evidence`

Every case asserts the status and exact endpoint, provider URL, inspection date
and basis. `legacy recovery capability export / should retain the generic
snapshot for existing imports` preserves the previous constant, including its
`supported` client-abort value; it is deprecated and is not endpoint evidence.

Before documentation changes or full gates, the regression command
`npm test -- --runInBand src/llm/recovery-capabilities.test.ts` rejected the old
implementation (exit 1: three client-abort failures, 13 preservation cases passed).
After correcting the declarations and their evidence, the same command passed
(exit 0: all 16 cases). No provider doubles or live requests are involved.
The first attempt could not execute because Jest was absent (exit 127);
`npm ci --cache /tmp/mojentic-ts-npm-cache` installed the locked dependencies
without version changes before the behavioral rejection.

### Initiative coordination: missing counterpart verification

These tests establish local property conformance only. No shared versioned
executable consumer/provider capability contract set exists in this checkout.
The test content hash below identifies the local executable cases, not paired
compatibility evidence. TypeScript verification is against the base commit plus
the listed source hashes. Counterpart commits, commands and results are **missing**;
no consumer or live provider was verified.

Initiative coordination must arrange the same identifiable executable contracts
on both sides of any consumer migration, including supported old/new versions,
optional fields and error behavior, then record both commits, commands and
results in each repository's required gates. That verification remains unfinished
initiative work. Parent PARITY.md synchronization also belongs to the initiative
owner. This task is authorized to write only mojentic-ts; no counterpart changes,
consumer migration or release were performed.

### Item 3 tested source identity

The SHA-256 of `src/llm/recovery-capabilities.test.ts` identifies the executable
local contract cases. Implementation and gate input hashes identify the tested
uncommitted source on the base commit above:

```text
3daf665b04bb7ab9d184c70546f803bd4571aa3977c7152f463ff81cc28ddda0  src/llm/recovery-capabilities.ts
cc9daa14063fbdbbe45307362c825729d420ae6c2577fda4badfd5104a423910  src/llm/recovery-capabilities.test.ts
6c2dd1a7e08cef5e9ec8e9be84dea129c4f153f1679c498db35f6dd16a74f20b  src/llm/gateway.ts
50c910a9a3b504df7b33b46a15fb4bb56af1b2f1b612d597be44c49ebf18c10c  src/llm/gateways/openai.ts
0be41516268e2256afb3e8182f8e10dbc0d0251daa436b8be28626effe4d0051  src/llm/gateways/ollama.ts
b487384f88eb47c48bdeb40d43b33ebb0ce53b52664e498ac44abdfd221c20ab  src/llm/gateways/omlx.ts
8d9a2ae5ed92597127eec4f6ffc12098b8c377c1a8e6925290addd922403eb08  src/llm/recovery.ts
493c060f85283a95ccc16094512117e4a38238c813af223f4de41d3679759389  src/llm/index.ts
1ab36aeabbb86c19f96e55cf47e4cbdfde8b50c7aac4c768a6711ade2cd5b422  .hone-gates.json
f8f0d5fad084bbc866735b3afe8a464f32532746bc222203ce90ab5c416108b3  package.json
0c19a83dda7352b8aa97700e438104425658cce9f53d0567dd97d17eb6d94a1c  package-lock.json
```


### Item 3 verification results

All checks ran in the task worktree against the source hashes above. Verbose
build/test commands were executed through `foundry capture`; that wrapper preserves the command's exit code.

| Command | Result |
| --- | --- |
| `npm run format` | exit 0 |
| `npm run lint` | exit 0, zero warnings |
| `npm run format:check` | exit 0 |
| `npm test` | exit 0, 52 suites and 2,358 tests passed |
| `npm run build` | exit 0 |
| `npm test -- --coverage` | exit 0, 2,358 tests passed; statements 86.76%, branches 81.54%, functions 89.73%, lines 87.25%; every configured 70% threshold exceeded |
| `npm audit --cache /tmp/mojentic-ts-npm-cache` | exit 0, zero vulnerabilities, including development dependencies |
| `npm audit --omit=dev --audit-level=moderate --cache /tmp/mojentic-ts-npm-cache` | exit 0, zero vulnerabilities |
| `npm run docs:build` | exit 0; VitePress/Rolldown bundle-assignment warnings and a transform deprecation notice were emitted |
| `npm outdated --cache /tmp/mojentic-ts-npm-cache` | exit 1, informational: ESLint 10.12.0 installed, 10.13.0 wanted/latest; versions preserved as required |

No package, lockfile or runtime versions changed. Changes remain uncommitted;
Foundry owns finalization. Suggested finalization message:
`Correct documentation-backed client abort capability reporting`.


## October 12 item 8: typed recovery errors

Base: `ba93b45340b34a5b73a44b40172a9643bb93b9e3` plus the uncommitted
implementation/test hashes in [the item 8 recovery record](RECOVERY-CONFORMANCE.md#october-12-item-8-correction-typed-errors).
The local executable regression set `ts-recovery-typed-errors-v1` uses
`src/llm/recovery-typed-errors-v1.json` and the existing scripted HTTP harness.
Its fixture SHA-256 is `358b2ca23b2c69cb592644fb8337d59b6f96d252228731d7a3d9295fe503e6d6`.

Named cases include `item 8 exposes public policy error for $field through $route without wire effects`,
`item 8 retains exact capture cause through %s`,
`item 8 retains original response capture exception through %s`,
`item 8 retains length cause and finish evidence without replay through %s`, and
`item 8 rejects length tool responses through the session with typed finish evidence`.
They assert actual public error classes, private cause identity, finish evidence,
request bodies, safe serialization, tool non-execution and session histories
across all three providers and 11 public routes. Catch characterizations preserve
unrelated legacy Error wrapping. The recovery record lists every named case and
the observed rejecting/passing probe results.

Reproduce local verification:

```bash
npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/broker.test.ts -t 'item 8|legacy thrown gateway'
npm run lint && npm run format:check && npm test && npm run build
npm test -- --coverage
npm audit --omit=dev --audit-level=moderate
npm audit
npm outdated
npm run docs:build
```

All required gates pass; 52 suites / 2,670 tests pass. Coverage exceeds each
configured 70% threshold (statements 87.03%, branches 82.16%, functions 89.75%,
lines 87.50%). Both audits report zero vulnerabilities. Docs build exits zero
with VitePress/Rolldown bundle-assignment diagnostics and a transform deprecation.
`npm outdated` exits 1: ESLint 10.12.0 installed, 10.13.0 wanted/latest.
Versions remain unchanged. Detailed source hashes and results are in the recovery record.

**Counterpart verification remains missing:** no external provider or consumer
verified this same executable set; counterpart commits, commands and results are
unavailable. These local checks do not establish cross-repository compatibility.
Supported old/new consumer contract verification and parent PARITY.md updates
remain initiative coordination work. No sibling repository, binding contract,
package version or Git ref changed; Foundry owns finalization and publication stays held.


## Cycle 8: invalid-jitter correction

Base revision: `a21ef3537208c3af004bab030fb674c8f810bad2`, with uncommitted
source identified in [the recovery correction record](RECOVERY-CONFORMANCE.md#cycle-8-invalid-custom-jitter-before-wire-activity).
The existing `ts-recovery-typed-errors-v1` local fixture mechanism now includes
invalid custom jitter and valid-prefix cases; its additive revision SHA-256 is
`90f28078781fcaff634372d568e992a3afede9257a7fbb3d8af6494559472f47`.
Earlier fixture hashes above identify historical snapshots.

Every possible custom retry sample is validated and retained before HTTP,
capture or lifecycle events, including an invalid second sample after a valid
first sample. Public policy errors expose `RecoveryPolicyError`, code
`RECOVERY_POLICY_ERROR`, field `jitter` on all 11 routes across OpenAI, Ollama
and oMLX. The named `item 8 rejects later invalid jitter through sessionStream
before wire effects` proof failed on the base (three cases) and passed after
correction. The expanded `item 8 rejects invalid jitter $name $prefix.name
through $route before wire effects` matrix similarly failed all 330 cases on
the base and passes after correction. The focused `jitter|item 8` run passes
660 cases, including public event detail, Result/chunk and thrown session
surfaces, valid endpoints and deterministic bounded delays. See the recovery
record for commands, source hashes and final quality results.

No counterpart tested commit or verification result exists for this set.
Scripted-provider HTTP tests prove local boundary conformance only; paired
verification is still required in separately authorized counterpart repositories.
No reasoning, metadata, shared contracts or versions changed in this packet.
Publication and consumer migration holds remain in force.

## Model metadata section 1 (2026-10 correction packet)

Scope: only section 1 of `MODEL-METADATA-2026-10.md`. No reasoning, first-token
measurement or request-fidelity implementation is included in this packet.
TypeScript tested source is base `261f3c0ca55730bfa6d27df650866e23769e799c`
plus the uncommitted changes identified below. Versions remain unchanged;
Foundry owns Git finalization.

Contract source: `svetzal/mojentic-unify` at
`4b08dcd1d87f520a4c70928c33a2bc84c228093d`; contract SHA-256
`a085da1c0d110f9d587a24ace6ac2854b653e1ac28905b3829d94d665b2c906e`.
Fixture version: oMLX 0.7.0rc1 capture from 2026-09-29, Ollama 0.40.5 captures
from 2026-10-15. Replay reuses the existing raw JSON fixture mechanism through
real loopback HTTP and public gateways, without mocking provider libraries.
The Ollama JSON files are byte-identical parent copies; the existing oMLX
`models.json` is also byte-identical to the parent.

```text
f5302087e61a9af18abef1b9315b226aa8dfab326ed1751d4bff12b05e1b9dab  src/llm/gateways/__fixtures__/ollama/error_model_not_found.json
a95dc92e483a8b09d16e739be3111ecba58e90dc2ae5ab49cd22c78e16ff9233  src/llm/gateways/__fixtures__/ollama/show_context_length.json
8236bd781ee623fa2859ce5187d855b2ef5806dfa6a2e38e38d4a612dc876930  src/llm/gateways/__fixtures__/ollama/show_num_ctx_parameter.json
c2ff28301474919f3952ef819daa80c88abce2e502abb018ee3130046e6141cf  src/llm/gateways/__fixtures__/omlx/models.json
```

Executable case set: `src/llm/model-context.test.ts` and
`src/llm/gateways/model-context-http.test.ts`, included in the required `npm test`
gate. Supported prior custom gateways omit the optional callback; the public
fallback returns `Ok(null)`. New gateways return an advertised positive integer
with provenance, `Ok(null)`, or `Err(GatewayError)`.

| Section 1 decision | Named executable evidence |
| --- | --- |
| Configured oMLX host, GET, bearer auth, exact ID, source field | `queries the configured authenticated oMLX endpoint for exact model provenance` |
| Configured Ollama host, POST body, both architecture prefixes and model num_ctx | `reads captured Ollama architecture and model parameters for %s` |
| Missing model, missing fields, unknown results | `returns not advertised for missing oMLX entry or field %j`; `returns not advertised for absent Ollama context %j` |
| Malformed window types and envelopes | `rejects malformed oMLX window %j`; `rejects malformed Ollama window %j`; provider `rejects malformed response body %s`; provider envelope tests |
| Model parameter validation and exact line identity | `rejects malformed model parameter %s`; `ignores num_ctx substrings in other Ollama parameter names` |
| HTTP, including unknown-model 404, and transport errors | Both providers: `retains HTTP failure status %i and body`; `returns a Result error for transport failure` |
| Exact OpenAI registry lookup, no network, no guesses | `reads exact registered context for %s offline`; `does not infer a window for unknown model %s`; `performs no OpenAI HTTP request for registry lookup %s`; missing and malformed registered-window tests |
| Pure effective window precedence and lower/equal/higher caps | `caps explicit numCtx %i at the advertised maximum`; `caps model parameter %i at the advertised maximum`; `uses the model parameter when configuration omits numCtx` |
| Advertised-only upper bound and unknown metadata | `returns the advertised upper bound when no context setting is visible`; `does not guess an unknown window with config %j` |
| Prior custom gateway compatibility, method binding, errors | `keeps existing custom gateway implementations source compatible`; `preserves implemented metadata and method binding`; `preserves the implemented Result error` |
| Completion bytes and registry inference unchanged | `characterizes existing Ollama completion request bytes`; `leaves %s completion request bytes unchanged after metadata`; `keeps inferred reasoning completion parameters after an unknown registry lookup` |
| Shared oMLX endpoint retains list semantics; no metadata cache | `preserves oMLX listModels behavior on the shared endpoint`; `does not cache context metadata after the provider changes it` |

### Coordination relay (parent PARITY.md and counterpart verification)

Proposed parent PARITY row: **Model metadata section 1 / TypeScript** — optional
`getModelContextWindow`, provider provenance and pure Ollama effective-window
helper implemented; captured HTTP and offline registry evidence above. Sections
2 and 3 remain outside this packet. Parent PARITY.md was not edited because
only this TypeScript worktree is authorized.

The TypeScript verification command is:
`npm test -- --runInBand src/llm/model-context.test.ts src/llm/gateways/model-context-http.test.ts`.
Provider captures are replayed, but no current external provider source revision
or live deployment was verified here. No other port or consumer was executed.
Counterpart tested commits, executable contract commands and results are therefore
**missing initiative coordination work**, not a compatibility claim. Initiative
owners must arrange the same identifiable executable contract set in each
participating provider/consumer repository and its required gates, including
supported prior/new API forms, optional metadata and error behavior. Consumer
migrations still require separately authorized paired verification and full
journey checks. No sibling repository was changed.

### Tested source and results

SHA-256 of the uncommitted implementation and executable tests:

```text
3f02a8c1953c028ac62603caa1202f5b45cb681d61d4756caec4b7a89c46b0ee  src/llm/model-context.ts
fab3d4e4fad30b534960fa92910633cfdae966242a02850a1d0d99fe2f471235  src/llm/model-context.test.ts
64cbcf0cef8c6024b5ac78fffb67d2a72ce0e8d6a49c8b2b02330baad915928d  src/llm/gateways/model-context-transport.ts
ecc3277e9a2e3101e9620da4fc2b3f701342b20e86ec8ff339aa93d082ef66d1  src/llm/gateways/model-context-http.test.ts
90bd107b4b35cc5fd919ed8a034d05783fdc037b65ae047379505d67a8b944ba  src/llm/gateways/ollama.ts
4ca9ac9113b4493a80e321907e71575021e62f52a4ca9680cc64f9cdaf1c912a  src/llm/gateways/omlx.ts
29ee96a58a3ccd902f54b969f0f744b173726c2cb86de4e1c1b212ba19e78eb8  src/llm/gateways/openai.ts
efee4f605924d73072ec6080168c151177a23ef1170a1ae4b4da424f4fe26e10  src/llm/gateways/openai-model-registry.ts
d21fae18ff4abf52daf819b9b56393290b063f0159a3e2ac8bffda9ab313666e  src/llm/gateway.ts
f86c5dde016bfec0fe789a7487259c0b29f5f0277edcd1a4b83ec373d4599220  src/llm/index.ts
```

| Required verification | Result |
| --- | --- |
| `npm run format` | Passed; no unrelated formatting changes |
| `npm run lint` | Passed, zero warnings |
| `npm run format:check` | Passed |
| `npm test` | Passed: 54 suites, 3,108 tests (93 metadata cases) |
| `npm run build` | Passed |
| `npm test -- --coverage --runInBand` | Passed: statements 87.27%, branches 82.54%, functions 90.01%, lines 87.71%; all exceed the 70% thresholds |
| Metadata core and transport coverage | 100% statements, branches, functions and lines |
| `npm audit` | Passed: zero vulnerabilities |
| `npm audit --omit=dev --audit-level=moderate` | Passed: zero vulnerabilities |
| `npm outdated` | Completed with npm's exit 1 for available updates: ESLint installed 10.12.0, wanted/latest 10.13.0; no versions changed |
| `npm run docs:build` | Passed |

`npm outdated` initially encountered a read-only default npm cache. Re-running
with `npm_config_cache=/tmp/mojentic-ts-npm-cache` completed the registry check.
All four `.hone-gates.json` commands passed in sequence. The initial executable
probe characterized existing Ollama completion bytes and rejected the absent
oMLX operation (exit 1); after implementation the same HTTP probe passed (exit 0).
No package, lockfile or runtime version changes, publication, tags or ref changes
were made. Suggested finalization message: `Add provider context metadata and Ollama effective-window helper`.

## Model metadata section 2: client first-token timing

Scope: only section 2 of `MODEL-METADATA-2026-10.md`, SHA-256
`a085da1c0d110f9d587a24ace6ac2854b653e1ac28905b3829d94d665b2c906e`,
read from parent contract revision `4b08dcd1d87f520a4c70928c33a2bc84c228093d`.
The initiative brief matched its required SHA-256
`ea6a0efa56bfb3cd74b5ce728f80cc33c6fbd853114bec94b8aabe79f5d28e6e`.
The TypeScript input commit is `199c3cfcbc78c4fc391cebaf826ec9437ac0aa07`;
the corrected source is an uncommitted worktree identified below. Versions,
lockfile, request serialization, reasoning controls and recovery policy remain
unchanged. No consumers or sibling repositories were modified.

### Local executable evidence: ts-stream-first-token-v1

The existing Jest and scripted loopback HTTP mechanism is reused by
`src/llm/first-token-http.test.ts`. Its SHA-256 below identifies this local
executable set. Actual requests traverse the maintained gateway APIs and real
HTTP transports; only `MonotonicClockGateway` is controlled. Fixtures are local
scripts, not independently verified provider or consumer contracts.

The hardest initial probe, `measures the first argument before an oMLX terminal
failure through real HTTP`, first failed with absent timing metadata (exit 1),
then passed with exact 25 ms first-token and request durations (exit 0), one
request, a preceding keepalive and lazy construction before dispatch. Foundry
retains the behavioral proof and complete logs outside the shipped files.

The complete 91-case HTTP suite was also transplanted into a temporary source
snapshot of base `199c3cfcbc78c4fc391cebaf826ec9437ac0aa07`, with the test's
clock gateway available but unused by base production code: 79 timing cases
failed and 12 existing-history/tool-execution characterizations passed. The
corrected worktree passes all 91. This is a behavioral rejection, not a marker
or request-count-only probe.

| Requirement / maintained route | Named tests in `first-token-http.test.ts` |
| --- | --- |
| All OpenAI, Ollama and oMLX legacy chunk paths; recovery enabled and disabled | Provider/recovery matrix: `measures $name legacy chunks after keepalives and empty deltas` for content-first, thinking-first and tool-argument-first |
| Shared `streamCompletionEvents` and `recoverStreamEvents`, including deltas discarded by parsers | `measures $name through broker terminal events`; real OpenAI/oMLX `reasoning_content` and Ollama `thinking` frames |
| Exact first observation and terminal durations | Matrix asserts first token 25 ms, terminal 80 ms, correct kind and one actual HTTP request; later content cannot replace thinking/tool observations |
| Keepalives and empty deltas do not count | Legacy and broker matrix starts with keepalive/empty content; oMLX keepalive deliberately carries content that must be ignored |
| Lazy construction, dispatch origin | Legacy matrix asserts no clock read and zero requests before consuming the generator; initial oMLX probe advances the controlled clock between construction and dispatch |
| Empty completion: paired first-token fields absent | `leaves first-token fields absent on empty legacy streams`; `leaves first-token fields absent on empty event streams and preserves provider timing` |
| Tool names/empty argument deltas are not tokens | `does not count tool names or empty arguments as a token before event rejection` |
| Terminal HTTP failures and authorized retries | `times a rejected HTTP attempt and preserves the recovery request policy`: disabled sends once; enabled retries once after admission; exact terminal timing |
| Failure after first token, no replay | `retains content timing on a broker failure without replay`; `retains timing through session failure and excludes partial assistant history`; actual socket termination and one request |
| Cancellation and exactly one terminal event | `retains first-token evidence when a broker event request is cancelled`; matrix asserts terminal cardinality and iterator completion |
| Tool execution and successful session history | `executes a completed streamed tool once and sends exactly one follow-up request`; `preserves successful session content and history` |
| Provider metrics stay separate | Empty-event and legacy matrix asserts original Ollama durations and nested oMLX `usage.time_to_first_token` alongside client milliseconds |

The existing streaming/recovery conformance suites, terminal-event tests,
streamed tool round-trip tests, session tests and request-byte assertions remain
in the full required test gate. Existing optional custom gateway APIs are
unchanged. Existing provider completion criteria, event-tool rejection,
cancellation, partial-output history handling and recovery redaction are retained.
Legacy chunk callers read `StreamChunk.evidence.metadata` or terminal
`error.evidence.metadata`; broker/session text streams retain their output API.

### Coordination relay and contract gaps

Proposed parent PARITY row: **Model metadata section 2 / TypeScript** — client
monotonic dispatch-to-first-token timing for content, thinking and tool arguments,
plus terminal success/failure duration, implemented on maintained legacy/event
and recovery routes; local HTTP executable evidence `ts-stream-first-token-v1`.
Parent PARITY.md remains unchanged because it is outside this authorized worktree.

No shared versioned executable first-token contract set was available in this
repository. Existing `ts-recovery-typed-errors-v1` cases remain in required gates;
they verify recovery semantics, not cross-repository first-token compatibility.
The initiative must arrange the same identifiable executable cases and supported
old/new API verification on the provider/consumer sides, including optional
fields and failures. Counterpart commits, verification commands and results are
**missing coordination work**. No current provider deployment/source revision,
other port or consuming repository was verified. Local HTTP fixtures do not
establish compatibility or authorize consumer migration or coordinated release.

Two details need parent coordination rather than a new cross-port rule: section
2 does not specify the first-token tie-break when several token kinds appear in
one frame, or whether retry timing denotes the logical completion or an individual
attempt. This implementation follows its existing observation order (thinking,
content, tool arguments) for simultaneous deltas and retains the first dispatch
origin across authorized retries of one logical completion. Each tool-loop
completion starts a fresh timer. These are reported local behavior, not a claim
that other ports agree. Tests separate token kinds and verify the local retry
behavior without changing recovery decisions.

### Commands and results

All verbose verification used Foundry capture, with complete logs archived as
execution evidence. `npm ci` installed the unchanged lockfile. The initial
missing-Jest exit 127 was resolved before the behavioral rejecting probe and is
not the behavioral proof. Existing exact-object assertions were updated for
additive terminal metadata; no warnings were suppressed.

| Command | Result |
| --- | --- |
| `npm test -- --runInBand src/llm/first-token-http.test.ts` | Passed, 91 cases |
| `npm run lint` | Passed, zero warnings |
| `npm run format` and `npm run format:check` | Passed |
| `npm test` | Passed, 55 suites and 3,199 tests |
| `npm run build` | Passed |
| `npm test -- --coverage` | Passed; statements 87.60%, branches 83.16%, functions 90.39%, lines 87.97%, above every existing 70% threshold |
| Timing core coverage | `stream-timing.ts` and `monotonic-clock-gateway.ts`: 100% statements, branches, functions and lines |
| `npm audit` | Passed, zero vulnerabilities |
| `npm audit --omit=dev --audit-level=moderate` | Passed, zero vulnerabilities |
| `npm outdated --cache /tmp/mojentic-timing-npm-cache` | Exit 1 reports ESLint installed 10.12.0, wanted/latest 10.13.0; no dependency changes. Plain `npm outdated` first hit the read-only default npm cache; the writable-cache rerun completed the check. |
| `npm run docs:build` | Passed |

### Corrected source identities

The following SHA-256 values identify the worktree implementation and executable
regressions rather than a finalized commit. Foundry owns Git finalization.

```text
e94d4f53928b3ea519eceedcb0f7e7a41ae2eb5da52076369d92374108b3d2a8  src/llm/first-token-http.test.ts
e2ad2e76b28dc5ae966c0dc59b7cad157e89bb45927a0f3b55c12a6388e2dcb7  src/llm/gateway.ts
879cacc4e73d3e0f22bfc9541ee0ede7c1ce0a89541393657bebd8314b2eaa54  src/llm/gateways/ollama-stream-events.test.ts
c4e6fcf942cbbb73e9c15109246ca766cda817d532b66f569c0564444a820a30  src/llm/gateways/ollama.test.ts
9ce1e293d203a77f8bbf8604457e7094b17ea2ea7eff06dd4be7850bb7ad35ef  src/llm/gateways/ollama.ts
34628f2ee96630c68f9107f0e99b684e342ea546feea786d7f279090ebba513f  src/llm/gateways/omlx.test.ts
0060a754b8a5e74ce2f80ee1b74c84a964437003eab3ab116fad23d7bf98d3a7  src/llm/gateways/omlx.ts
265607cc19817d34390ee559574c5083b9881b4e6b578532b351c4e5bc3a64f5  src/llm/gateways/openai-stream-events.test.ts
8e8674ee297289a003fd7f3186da8865d2487f61f936f889d69f43b8a02c1dcd  src/llm/gateways/openai.ts
d6dc5ed76573e6c6cc90993f18385f8cfee766d2365b7ee4e4bcebe46cddf706  src/llm/gateways/stream-event-transport.ts
7865603318a366276c37917038ef79c820625bd00f9da4ee7f27b69918edd77f  src/llm/models.ts
6de9469d0b56cf939009fadfa6abcd845160137667ff7fd1aae6b9e7c3627531  src/llm/monotonic-clock-gateway.ts
7d17becc1c29b5dfcdeabc575cf9ecfe5df5a74fa5a1dc1181982b97426297e5  src/llm/stream-events.ts
0afaeb93fa03c364a122f29add9364071221b580e0f827b11d8ae710900f1563  src/llm/stream-timing.ts
df7106ad7be55a4b73e2207fcb411f2177bc53589813f4aa2301408db5f82f6b  src/llm/streaming-recovery.ts
```
