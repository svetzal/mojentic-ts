# 3.0.0 conformance: admission without a decision

This is a partial conformance record for October 12 recovery amendment item 2.
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

## Tested source and executable cases

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

## Commands and results

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

## Remaining decisions: unverified

Only amendment item 2 has been implemented and verified here. Items 1, 3, 4,
5, 6, 7 and 8 do not receive complete conformance signoff from this task.
Regression checks for absent hooks and other existing behavior are preservation
evidence, not a complete audit of those decisions. In particular capability
citations, provider metadata rules, all HTTP-date forms, streaming capture,
keepalive behavior and remaining robustness decisions need their own mappings.
All remaining October 9 recovery contract decisions, native reasoning, model
metadata/request fidelity and the separate session temperature issue remain
unverified for 3.0.0. Existing regression tests do not establish their full
contract conformance. No versions or quality thresholds were changed.

No shared executable contract was changed. The local provider scripts exercise
TypeScript adapters; they are not paired consumer/provider verification against
a live provider or another port. No consumer repository was authorized for this
task, so consumer commits, a shared versioned executable set and consumer-side
verification results are unavailable. Coordination must supply those before any
cross-repository compatibility claim or consumer migration. Neither inspection
of Elixir nor matching lifecycle names proves paired verification. Release and
publication remain on hold pending the broader initiative conditions.
