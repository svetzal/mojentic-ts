# 3.0.0 conformance: admission, capabilities, Retry-After dates and session temperature

This is a partial conformance record for October 12 recovery amendment items 2, 3 and 5
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


## Item 3: endpoint capability declarations

Tested TypeScript base: `91ea4dccf0d859211ccd6084dd51f5638250c99c` plus the
uncommitted capability correction. The binding parent contract remains the
October 12 amendment, SHA-256
`a53a3a4eb118fa4687dd703d6ce918dd40dd6cb4eda796abc6c429a6e932e7a3`,
at parent commit `4b08dcd1d87f520a4c70928c33a2bc84c228093d`.
Only item 3 is implemented by this correction; other release requirements remain
outside its scope.

`src/llm/recovery-capabilities.test.ts` exercises the actual public gateway
properties, imported through the public LLM barrel, for OpenAI, Ollama and oMLX.
The suite `recovery capability endpoint evidence` expands these named tests for
**each** provider:

- `should expose clientAbort as supported with endpoint evidence`
- `should expose requestCancellation as unsupported with endpoint evidence`
- `should expose requestStatus as unsupported with endpoint evidence`
- `should expose idempotency as unsupported with endpoint evidence`
- `should expose exactAttemptTermination as unknown with endpoint evidence`

Each asserts the individual value, exact endpoint, provider documentation URL,
inspection date (`2026-10-17`) and explanatory basis. These are property
conformance tests with no provider doubles or network calls. The first regression
run failed all 15 cases against the old gateway declarations; the corrected run
passed all 15. The additional test `legacy recovery capability export / should
retain the generic snapshot for existing imports` guards the retained public
constant. The interface now uses `CompletionRecoveryCapabilities`, independently
of the deprecated constant's literal type. See the
[capability table and migration](docs/completion-recovery.md#adapter-capabilities-and-preserved-semantics)
for endpoint citations and all five values.

Local cancellation is interpreted as the adapter's HTTP abort facility, with
Node transport documentation as additional evidence. The provider docs identify
endpoint scope; they do not promise that local abort terminates remote inference.
This distinction should be retained in coordinated contract review. OpenAI stored
completion retrieval and other API families are not evidence of in-flight status
for the Chat Completions POST. No exact-attempt termination is claimed.

### Coordination limits

No shared versioned executable consumer/provider capability contract set exists
in this checkout. The test file hash below identifies the local executable cases;
it is not paired verification. No consumer repository or live provider was
verified, and no counterpart commit, command or result is available. Coordination
must supply and execute the same versioned capability contracts in affected
consumers before declaring this public interface compatible. Existing consumers
of the literal constant type need migration; retaining its export does not prove
their compatibility. Parent PARITY.md updates are left to the initiative owner
because sibling writes are outside this task's authorization. No package,
lockfile or runtime version, Git ref, provider execution, request encoding,
admission, cancellation, Retry-After, streaming or temperature behavior changed.

### Item 3 tested source identity

SHA-256 of the uncommitted implementation and gate inputs:

```text
e32db84d5a6ac6f762d14871e663a7798e92a7b5e7e654d50ddae682c58c3b1b  src/llm/recovery-capabilities.ts
3dda0edc6d7b8fc513d26f6828191ef54a1dba040d419f57ea9e556081466ded  src/llm/recovery-capabilities.test.ts
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

All commands below ran against the source hashes above; required thresholds and
audit scope were preserved.

| Command | Result |
| --- | --- |
| `npm run format` | exit 0 |
| `npm run lint` | exit 0, zero warnings |
| `npm run format:check` | exit 0 |
| `npm test` | exit 0, 52 suites and 2,358 tests passed |
| `npm run build` | exit 0 |
| `npm test -- --coverage` | exit 0, 2,358 tests passed; statements 86.76%, branches 81.54%, functions 89.73%, lines 87.25%; all exceed the configured 70% thresholds |
| `npm audit` | exit 0, zero vulnerabilities including development dependencies |
| `npm audit --omit=dev --audit-level=moderate` | exit 0, zero vulnerabilities |
| `npm run docs:build` | exit 0; upstream VitePress transform deprecation notices remain |
| `npm outdated --cache /tmp/mojentic-ts-npm-cache` | exit 1, reports ESLint 10.12.0 installed, 10.13.0 wanted/latest; informational, no version changes |

The initial acceptance test could not run before dependency installation
(`jest` absent, exit 127). `npm ci` then succeeded without changing the lockfile.
The behavioral rejection recorded above occurred after installation (exit 1,
15 failing assertions), followed by a corrected run (exit 0, 15 passing tests).
The initial `npm outdated` attempt could not write the read-only default cache;
the writable temporary cache rerun produced the version report above.

Suggested finalization message: `Document endpoint-specific recovery capabilities`.
Foundry owns Git finalization; all changes remain uncommitted.
