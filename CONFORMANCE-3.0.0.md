# TypeScript 3.0.0 local conformance

This correction changes test support, tooling, workflows and documentation only.
Library implementations, public APIs, fixture decisions, dependencies and package
versions are unchanged. The tested base is
`2863cec9a37b4e192f3fea8534b3352e067ab1ff` plus this uncommitted worktree diff.
Foundry owns Git finalization. No external repository was modified or verified.

The binding mission parts 1–3 remain transient completion recovery (including the
October 12 amendment), native reasoning, and model metadata/request fidelity.
`TRANSIENT-RECOVERY-2026-10.md` is synchronized byte-for-byte with the revised
parent copy in `/home/svetzal/Work/Projects/Personal/mojentic-unify`. Its revised
conformance section requires in-process transports and deterministic time.
This is source and packed-consumer library conformance, not a claim about a live
provider or verification by an external consumer/provider repository. No boundary
between running services or repositories changes in this correction.

## Execution policy and replacements

All existing library behavioral contracts survive. The `*-http.test.ts` names identify HTTP
protocol contracts; they now use `scripts/test-support/transport.cjs`, never a
socket or server. The ordinary and streaming conformance suites use the same
adapter. It supplies scripted response streams to fetch and to the
`CompletionTransportGateway.send` boundary; no recovery, parser, broker or session
is mocked. The production Node HTTP/HTTPS recovery transport remains unchanged.
Assertions characterize library dispatch decisions at that boundary; they do not
claim to test Node's socket implementation.

Full request bytes, headers, destinations, exact unmasked logical/attempt IDs,
response bytes, lifecycle order, semantic progress, cancellation, truncation,
admission, jitter, Retry-After, reasoning/history, and terminal success/error
assertions remain. No fixture family or behavioral assertion was removed to
achieve isolation. Concurrency uses event ordering; date/timing assertions use
fixed clocks. Agent wait tests use observable completion or virtual polling;
realtime interruption awaits batch settlement rather than racing a real timeout.

Jest rejects socket, listener and DNS access and advances virtual timers only
after promise/stream work drains. No timer is advanced by elapsed real time.
`test-boundary.test.ts` and the fresh installed consumer both execute
`ts-in-process-boundary-v1` from `scripts/test-boundary-contract.cjs`. It checks
every installed denial function without constructing sockets or listeners, then
asserts the exact public gateway error for an unconfigured destination and an
empty transport record before exercising a configured destination. The accepted
exchange asserts the full method, destination, path, headers and request bytes,
and the caller-visible reply. Server-specific Node types and request socket
facades have been replaced by the adapter’s own `TransportRequest` and
`TransportResponse` interfaces; truncation still uses the same response
destruction path. `TransportRequest` retains the in-process `Readable` methods
used by existing event-driven consumers. Package verification preloads the same
network guard in subprocesses and forbids real timers in the installed consumer.
It packs the library and exact locally installed runtime dependencies, installs
those tarballs offline in a fresh directory, compiles installed declarations and
verifies runtime exports. No registry cache hit is needed for that install.

## Parts 1–3 decision-to-test map

Paths are relative to `src/llm/`. Every named family below survives with its
original provider, route and fixture coverage, now at the in-process transport
boundary. Existing implementation/evidence gaps are retained explicitly; this
is not a new release-readiness assessment.

| Binding decision | Surviving executable evidence | Existing scope/limitation | Concrete assertions |
| --- | --- | --- | --- |
| Recovery: typed category, provider, ordinary/structured/streaming operation, status, phase, acceptance, classification, progress, IDs and bounded history | `recovery-conformance.test.ts`: `recovers a 503 with exact bytes, supported controls, history, identities, and ordered lifecycle`; `exhausts persistent 504 with full inspectable history and exactly three actual sends` | Covered for maintained OpenAI/Ollama/oMLX completion adapters; no Anthropic adapter in this port  | Assert typed provider/operation/status/acceptance/progress and full 504 history, with one-based distinct attempt IDs. |
| Stable optional metadata, original private causes; safe formatting/serialization/events | `recovery-conformance.test.ts`: `keeps recognized metadata private when echoed from credentials or payload`; `omits echoed credential/payload metadata and exposes original headers only on inspection`; `retains transport causes and accounts for failed sends without hidden retries` | Covered; UUID allowlist is intentionally stricter than arbitrary provider IDs  | Assert safe metadata omitted for outbound echoes; explicit inspection retains the original headers and cause identity. |
| Opt-in only, default one wire attempt, legacy success/error and tool behavior preserved | `recovery-conformance.test.ts`: `keeps the opt-in default to one wire attempt`; `keeps disabled recovery to one legacy attempt`; `item 8 leaves recovery-disabled length handling unchanged` | Covered  | Assert the complete legacy response/error and a single encoded request when disabled or unspecified. |
| Policy controls and typed validation before capture/HTTP, including every jitter sample | `recovery-conformance.test.ts`: `prevalidates valid jitter endpoints even when the first attempt succeeds`; `does not sample custom jitter when no retry is possible`; item-8 parameterized routes from `recovery-typed-errors-v1.json` | Covered  | Assert typed policy error before request capture/dispatch; valid endpoints accepted and later invalid samples rejected. |
| Default transport, 429, 500/502/503/504 eligibility; permanent/auth/protocol errors excluded; caller categories/statuses affect selection | `recovery-conformance.test.ts`: `honors category selection independently from HTTP status selection`; parameterized permanent statuses and malformed/partial/shape cases. `streaming-recovery-conformance.test.ts`: `refuses unselected categories and statuses without invoking admission`; `keeps complete history when a later admission completes without returning` (503 then 502) | **Evidence gap**: no HTTP 500 case was found, and caller selection is tested by excluding a category/permanent status rather than positively selecting an otherwise excluded eligible status. Partial semantic replay remains forbidden  | Assert selected category changes classification and permanent/protocol failures never invoke admission; retain the stated 500/positive-selection gap. |
| Bounded exponential full jitter; injectable clock/sleeper; ceiling and Retry-After minimum | `recovery-conformance.test.ts`: `uses bounded exponential full jitter for every retry`; `honors Retry-After $name without shortening delay` using `retry-after-fixtures.json` | Covered  | Assert exact requested sleep values from bounded exponential jitter and Retry-After, never shortened to fit a budget. |
| All HTTP-date forms, malformed dates/weekday, past dates, seconds, budget/ceiling refusal | Same fixture family in ordinary, streaming and session conformance; `rejects a malformed RFC850 weekday through public HTTP recovery` | Covered; existing v2 fixtures retained  | Assert the same v2 fixture delay/date/invalid interpretation and refusal outcomes in ordinary, streaming and session routes. |
| Budget from first failure; absolute deadline applies to admission/resend, never active generation; recheck before dispatch | `recovery-conformance.test.ts`: `does not apply recovery budgets or deadlines to active generation`; `cancels an unresolved admission at the recovery budget and aborts its signal`; `rechecks the recovery budget immediately before sending after admission and delay` | Covered  | Assert expired recovery deadlines do not cut off active generation, pending admission aborts, and expiry prevents the next send. |
| No hidden transport retries/redirects; exact count and IDs on actual sends only | `recovery-conformance.test.ts`: `accounts for a terminal 421 without a hidden transport resend`; redirect/status matrices. `recovery-http.test.ts`: `holds ambiguous admission pending, freezes request bytes, and reports exact wire identities` | Covered  | Assert 421/redirect status is terminal, destination unchanged, request bytes exact and logical/attempt IDs unmasked at the transport boundary. |
| Invoke async admission before resend; allow/reject/wait; rejection preserves original failure | `recovery-http.test.ts` same pending-admission case; `recovery-conformance.test.ts` allow/reject matrix; packaged probe explicit reject versus allow | Covered  | Assert admission remains pending before allow; reject retains the original failure and no second request; allow reuses frozen bytes. |
| Absent admission hook: remote eligible retry allowed; ambiguous local retry requires admission unless acceptance is no | `recovery-conformance.test.ts`: `requires ambiguous local admission while OpenAI may use policy admission`; `streaming-recovery-conformance.test.ts`: `requires explicit admission for ambiguous local sends` | Covered  | Assert remote/local policy outcomes, explicit admission requirement and unchanged original 504 failure. |
| Admission without decision/exception has distinct reason; no resend | `recovery-conformance.test.ts`: `keeps complete history when a later admission completes without returning`; `retains an admission exception without calling it deadline exhaustion`; `propagates an omitted admission return through the public session` | Covered  | Assert admission-without-decision and exception remain distinct from rejection/deadline and preserve full attempt history. |
| Five capability statuses with endpoint citations/dates; termination unknown; no invented idempotency/remote termination or model unload | `recovery-capabilities.test.ts` provider/value matrix and `should retain the generic snapshot for existing imports`; `recovery-http.test.ts` headers/identity assertions | Covered for three maintained adapters; clientAbort/remote facilities retain documented unknown/unsupported values, not a support claim  | Assert every advertised capability status and citation/date, with exact-attempt termination unknown. |
| Keep raw progress distinct from observed/delivered semantics; keepalive is nonsemantic | `recovery-conformance.test.ts`: `keeps raw keepalive progress separate from observed and delivered semantics`; streaming keepalive matrices | Covered  | Assert raw bytes increase for keepalives, with zero semantic progress, separately from observed and delivered content/reasoning/tools. |
| Ordinary/structured/streaming use immutable encoded payload, tools, history and controls across admitted attempts | `recovery-conformance.test.ts`: `preserves image and completed tool history plus descriptors with an immutable encoded schema`; `streaming-recovery-conformance.test.ts`: `recovers with immutable supported prior history, tools and temperature` | Covered  | Assert full image/tool/history/schema payloads and controls are immutable across admitted retries, including endpoint and authorization. |
| Partial reasoning/content/tool fragments stop replay, including observed but undelivered bytes; no partial structured parse/tool dispatch/history | `recovery-conformance.test.ts` semantic/capture matrices; `streaming-recovery-conformance.test.ts` public session content/reasoning/tools interruption families and `observes escaped semantic keys before a capture failure` | Covered  | Assert partial semantics forbid retry, preserve typed progress, omit incomplete history, and execute no partial tool. |
| Completed tool calls execute once; tool depth distinct from retry budget; tool-follow-up is separate completion | `streaming-recovery-conformance.test.ts`: `broker executes completed tool once when the subsequent completion fails`; `session recovery proof preserves completed tools and exact admitted follow-up bytes`; `first-token-http.test.ts`: `executes a completed streamed tool once and sends exactly one follow-up request` | Covered  | Assert exact tool arguments/results and execution once; retry bytes equal the follow-up request rather than the earlier completion. |
| Exhaustion/interruption cannot become complete success; length stays typed through broker/session | `recovery-conformance.test.ts` item-8 route matrix; `item 8 rejects length tool responses through the session with typed finish evidence` | Covered  | Assert typed length/capture errors survive broker and session APIs with failure evidence and no successful completion. |
| Lifecycle transitions include safe phase/category/eligibility/reason/acceptance/delay/operation/progress/identities | `recovery-conformance.test.ts` exact ordered 503 lifecycle assertions; `streaming-recovery-conformance.test.ts`: `interrupts observed %s without replay or incomplete tool execution`; `retains original capture cause and observed/undelivered %s through session` | Covered  | Assert exact ordered event arrays and safe fields, same logical ID, distinct attempt IDs, and no payload/credential leakage. |
| Explicit exact wire capture of failed/successful/partial responses; capture failure terminal with private typed cause | `recovery-conformance.test.ts`: `makes request capture failure terminal without sending HTTP`; `preserves both body transport and capture causes on a partial failure`; packaged `ts-packaged-library-v1` exact request comparison | Covered; capture evidence is opt-in  | Assert exact failed/success/partial request/response captures; capture failure retains cause identity and cannot authorize another send. |
| Cancellation authoritative in request/admission/backoff; pending hooks abort; paused-consumer resources close without claiming remote termination | `streaming-recovery-conformance.test.ts`: `closes an active response while consumer is paused before delivering cancellation`; `cancels buffered terminal frames while paused without storing final assistant text`; active/admission/backoff matrix | Covered  | Assert abort closes the owned response before next iteration, records the attempt before cancellation, and never invents remote termination. |
| oMLX recovery keepalive model frames change neither frame index nor metadata | `streaming-recovery-conformance.test.ts`: `recovers keepalive-only interruption with explicit admission and fixed request bytes`; streaming oMLX frame-index assertions | Covered  | Assert keepalive frames change neither semantic progress, frame index nor provider metadata. |
| Migration example/capability table; completion scope excludes realtime and embeddings | `docs/completion-recovery.md`; public-export probe; capability tests | Documented; no realtime/embedding recovery claim  | Assert public exports/capabilities from the installed artifact; document completion-only scope and migration examples. |
| Reasoning: native assistant thinking separate from content/tool results; serialize Ollama thinking and oMLX reasoning_content in history | `gateways/omlx.test.ts`: `should map reasoning_content to thinking`; gateway response/stream fields exist | Covered by `ts-native-reasoning-history-v1`: exact ordinary/stream continuation messages on both native providers, retention/recovery off/on  | Assert exact native assistant thinking/reasoning_content separate from visible text and tool-result messages in each continuation. |
| Disabled, Enabled, Low, Medium, High, XHigh remain distinct; boolean enable/disable versus exact named levels | `models.ts` six-value public type; `reasoning-effort-http.test.ts`: `preserves the complete $name request body`; installed `ts-reasoning-effort-v1` matrix | Covered: exact Ollama think boolean/string and oMLX top-level boolean/named fields; omission sends no control  | Assert complete provider body for all six effort values and omission, including booleans versus named strings. |
| Explicit caller-selected profiles validate efforts/history capability, never model-name guessing | `reasoningProfile` plus public validator; `ts-reasoning-profiles-v1` explicit arbitrary alias and unselected Qwen-looking name HTTP cases; broker propagation tests | Covered: unchanged effort selection plus native-history capability rejection before HTTP in source/installed ts-native-reasoning-history-v1  | Assert arbitrary aliases use explicitly selected profiles and Qwen-looking names do not select profiles implicitly. |
| Qwen3.8 supports disabled/low/medium/xhigh and native history; omitted effort stays unknown | `QWEN3_8_REASONING_PROFILE`, `reasoning-profile.test.ts` and source/installed `ts-reasoning-profiles-v1` matrix | Covered for validation, metadata and native history via `ts-native-reasoning-history-v1`  | Assert exact supported effort set, native-history flag and no implicit effort, including custom boolean-only profiles. |
| Broker retention opt-in; completed ordinary/streamed tool responses retained, never fabricate native history from errors/cancellation | `reasoning-history-contract.test.ts`: `preserves exact completed turns through later %s`, `does not fabricate native history from interrupted streams cancel=%s`, malformed-frame and successful-finish cases | Covered; completed turns survive later failures, incomplete/cancelled turns do not create native history  | Assert completed native turns persist through later errors; interrupted/cancelled/malformed turns never fabricate native history. |
| oMLX preserve_thinking in chat_template_kwargs when retention enabled; recorded wire request | `reasoning-history-http.test.ts`: `retains exact completed native reasoning in the streaming continuation wire`; shared source/installed fixture assertions | Covered; exact preservation request asserted on both continuation requests  | Assert exact chat_template_kwargs.preserve_thinking on both recorded oMLX continuation requests. |
| Structured output shares all native reasoning controls | `ts-reasoning-effort-v1`: ordinary, structured, legacy stream and event stream × recovery off/on × omission and all six controls | Covered; `ts-native-reasoning-history-v1` adds structured history and unsupported-history pre-dispatch assertions  | Assert all four routes and recovery modes use the same native controls; unsupported retention errors precede dispatch. |
| OpenAI rejects unsupported new controls and preserves legacy behavior | `reasoning-effort-http.test.ts`: `rejects $name with no HTTP requests`, o3 and gpt-4o, recovery off/on; installed `ts-reasoning-effort-v1` | Covered for Disabled/Enabled/XHigh: explicit ValidationError before HTTP; event API wraps it in request_failed/detail. Omission and Low/Medium/High registry adaptation preserved. `ts-native-reasoning-history-v1` verifies enabled-retention rejection on every route and exact exclusion from OpenAI bodies with retention off  | Assert ValidationError fields for unsupported OpenAI efforts/retention and zero dispatch; supported legacy effort bodies and warnings stay exact. |
| Metadata: single-purpose public capability; unknown/custom gateway returns not-advertised; errors remain Result errors | `model-context.test.ts`: `keeps existing custom gateway implementations source compatible`; `preserves implemented metadata and method binding`; `preserves the implemented Result error`; installed export/metadata probe | Covered  | Assert custom gateway source compatibility and method binding, Ok(null) for unavailable metadata and original Result errors. |
| oMLX exact model max_model_len, missing model/field, invalid numeric field; configured endpoint/auth | `gateways/model-context-http.test.ts`: `queries the configured authenticated oMLX endpoint for exact model provenance`; missing/nonnumeric matrices; installed probe success/null/404 | Covered  | Assert authenticated configured URL, exact model match, max_model_len provenance, and null/error behavior for missing/invalid fields. |
| Ollama /api/show architecture-prefix context_length, absent model_info, parameter num_ctx, malformed/nonpositive values and 404 | `gateways/model-context-http.test.ts` prefix/missing/invalid/status matrices; `ignores num_ctx substrings in other Ollama parameter names` | Covered  | Assert architecture-prefixed model_info then valid num_ctx fallback, exact provenance and malformed/404 errors. |
| OpenAI explicit registry context only, unknown model never guesses window | `model-context.test.ts` explicit/unknown registry cases; `gateways/model-context-http.test.ts`: `keeps inferred reasoning completion parameters after an unknown registry lookup` | Covered; no broader profile claim  | Assert only explicit registry metadata supplies a window; unknown names return no inferred context limit. |
| Metadata query has no request mutation or hidden cache | `gateways/model-context-http.test.ts`: `leaves %s completion request bytes unchanged after metadata`; `does not cache context metadata after the provider changes it`; installed byte equality | Covered  | Assert exact completion bytes before/after metadata and updated advertised values after a second query. |
| Effective window explicit config then model num_ctx then advertised upper bound; min cap; unknown returns nothing | `model-context.test.ts` above/equal/below matrix; `uses the model parameter when configuration omits numCtx`; `returns the advertised upper bound when no context setting is visible` | Covered  | Assert configured/model/advertised precedence and exact min-cap results for above/equal/below and unknown cases. |
| Timing: monotonic first dispatch, lazy streams, thinking/content/tool arguments, priority thinking > content > tool, empty/keepalive excluded | `first-token-http.test.ts`: `measures $name legacy chunks after keepalives and empty deltas`; `measures $name through broker terminal events`; `does not count tool names or empty arguments as a token before event rejection`; split-frame/legacy-fragment matrices | Covered with controlled clock; installed probe samples thinking-first with a fixed clock  | Assert injected first-token deltas and kind priority; empty content/tool names/keepalives do not start token timing; lazy requests wait for iteration. |
| Timing success/failure/empty/cancel; provider metrics preserved separately | `first-token-http.test.ts`: `leaves first-token fields absent on empty event streams and preserves provider timing`; `retains timing through session failure and excludes partial assistant history`; `retains first-token evidence when a broker event request is cancelled` | Covered  | Assert first-token fields absent when empty, retained on failure/cancel, and provider timing remains separately nested. |
| Timing observed before capture/delivery, retries share clock, tool continuations start fresh clock | `first-token-http.test.ts`: `retains split-frame token timing when response capture rejects`; retry/capture matrices; `executes a completed streamed tool once and sends exactly one follow-up request` | **Partial evidence**: retry/observation timing is covered and implementation starts a fresh timer per continuation; the tool test asserts content/count, not an independently advanced second-completion clock. A direct fresh-clock assertion remains an evidence gap  | Assert exact split-frame/capture and retry timing evidence; retain the stated independent continuation-clock evidence gap. |
| temperature/numCtx/maxTokens optional without invented defaults | `output-limit-http.test.ts`: temperature/context matrix `sends the complete $name body and preserves resend bytes`; `temperature-context-http.test.ts`: `omits sampling defaults on an admitted event-stream resend with identical encoded bodies`; installed `ts-temperature-context-v1` matrix | Covered for maintained gateways: unset temperature omitted, no internal OpenAI context fallback, Ollama emits num_ctx only when configured. Session configuration and deprecated broker entrypoint are outside this bounded correction  | Assert complete omitted/configured sampling bodies, no implicit temperature/context and immutable admitted resend bytes. |
| One output limit; remove numPredict; serialize configured maxTokens exactly once per provider, including streams/retries/tools | `output-limit-http.test.ts`: `removes numPredict from the exported TypeScript CompletionConfig contract`; `ignores a stale JavaScript numPredict alias in favor of maxTokens`; configured limit matrix; `omits the output limit on recovered event requests and resends`; installed exact wire bodies | Covered; legacy behavior outside this correction preserved  | Assert maxTokens once per provider body on every route, absent num_predict and ignored stale JavaScript alias; installed declarations reject numPredict. |
| Required Anthropic max_tokens fallback | No maintained Anthropic adapter/public export in TypeScript | Not applicable to current adapter set; implementing Anthropic would require its documented registry/4096 fallback  | No maintained Anthropic API exists; no provider verification is claimed. |
| OpenAI fixed temperature rewrites caller-set value to only supported value; non-reasoning effort warns and drops | `gateways/openai.test.ts`: `should adapt parameters for reasoning models`; `should warn and ignore reasoning_effort for non-reasoning models` | **Partial**: warning/drop covered; fallback hardcodes 1 rather than deriving sole registry value. Omission and existing o3 caller-set adaptation now have complete in-process HTTP body assertions; the broader registry rule remains open  | Assert current o3 temperature adaptation and non-reasoning warning/drop behavior; retain the stated broader registry-rule gap. |
| Other configured sampling/shape fields, client-only settings never serialized | `ts-openai-sampling-v1`: shared JSON cases in `output-limit-http.test.ts` and installed full-body assertions; `openai-sampling-http.test.ts`: tool continuation with retries | OpenAI topP/frequencyPenalty/presencePenalty covered; six-value Ollama/oMLX controls now covered by ts-reasoning-effort-v1; unrelated request-shape gaps remain  | Assert complete configured top_p/frequency_penalty/presence_penalty bodies and omission; client-only controls absent. |
| Default bodies omit temperature and limits; each configured control sent once; docs/CHANGELOG/PARITY aligned | `output-limit-http.test.ts` complete sampling bodies, retained output-limit matrix, installed `ts-temperature-context-v1`; CHANGELOG and gateway/core guides include migration | Covered for this bounded omission correction; parent PARITY remains outside write scope. Other configured fields and reasoning gaps above remain open  | Assert full omission/configuration bodies and exact session zero; parent PARITY/release records remain outside this task. |

## Shared executable identities

The source `reasoning-history-contract.test.ts` and fresh installed consumer both
call `scripts/reasoning-history-contract.cjs` against the unchanged
`ts-native-reasoning-history-v1` fixture. The source logs `contractIdentity()`;
the package verifier prints the identical fixture and verifier hashes. The same
contract functions drive completed ordinary/stream continuations, retention and
recovery toggles, interruption, malformed finish, structured controls, admitted
resends and OpenAI exclusion in both contexts. These are behavioral contracts,
not independently authored mocks or schema-only checks.

The source and installed matrices also share `ts-reasoning-effort-v1`,
`ts-reasoning-profiles-v1`, `ts-openai-sampling-v1`, and
`ts-temperature-context-v1`; the encompassing artifact verifier is
`ts-packaged-library-v1`. The shared destination verifier is
`ts-in-process-boundary-v1`; both contexts print its identical SHA-256 identity.
Hashes below identify the executable inputs of this run.

| Executable input | SHA-256 |
| --- | --- |
| `scripts/test-support/no-network.cjs` | `834a675e87494f804ef98bf2d3c7be94156b215a5170d93dfd0178735bdf220a` |
| `scripts/test-support/transport.d.cts` | `d6657245c9eca32eb2232a34b78a0c9961cf24d4281665a0651d8c6a07f46d5e` |
| `scripts/test-boundary-contract.cjs` | `1edde9ba1c0fd9fddc03f775b9991b136ad34fd6a39c2009eb779876cef75a46` |
| `scripts/test-boundary-contract.d.cts` | `99d45866fe2c3470293ddee42f1abdf650a058e026c35875be6f002d4eaaf971` |
| `scripts/test-support/no-real-time.cjs` | `8e9bc2f9f573ce28e8926b1a7bf0774a656a4e1a27d16906ea9aed61622b538e` |
| `scripts/test-support/jest-setup.cjs` | `7f653231ef75b25a9eab234ed75fd390b9cc9c3cfb21b40bfcbf32e1f7e94b21` |
| `scripts/reasoning-history-contract.cjs` | `7dbe7699c677c80a1f550ac3e64ad7f8392a42f9cc6b95a804e098b1d97255a4` |
| `scripts/verify-package.cjs` | `811455fa805d90c9837ac5c762ca9c28b8158157d72ba7c471d41641b88f94e2` |
| `scripts/test-support/transport.cjs` | `ffacf511b4cb28747a10bd87810af77d704c13460e84d2cbb8b57f50a194ce3f` |
| `src/llm/gateways/__fixtures__/reasoning-history-v1.json` | `bc4157be6010770537c998626fe11a10e300435c869afaa9a47b57cbc388f2d8` |
| `src/llm/gateways/__fixtures__/reasoning-effort-v1.json` | `88fb59195f2731be3fa116f17da142e3516b02618a2ed82ec8eea58ada3d419a` |
| `src/llm/gateways/__fixtures__/reasoning-profiles-v1.json` | `9219cfb8d8f4f787513a2c5984d1db3fc78301118979016bddd27af6faaf21be` |
| `src/llm/gateways/__fixtures__/openai-sampling-v1.json` | `808208d7683d9e67b75470a84b11420c1e7f95db8eb1f4e79cda780edf442836` |
| `src/llm/retry-after-fixtures.json` | `1b11f27fb5b0c07d635167cc9e65dcf5d176c617ce88daa5c43cedbd64874992` |
| `src/llm/recovery-typed-errors-v1.json` | `90f28078781fcaff634372d568e992a3afede9257a7fbb3d8af6494559472f47` |
| `src/llm/session-temperature-fixtures.json` | `45925454779ac55586adb87ce531e989cfb62bcbca3637c162a0bb2032cd5bf2` |
| `TRANSIENT-RECOVERY-2026-10.md` | `141d4ee5fcfbc18c940a7e7fe8d5ba9e381abc41a6d03f300f541e0fd5236f9d` |

## Final-worktree verification

Every required `.hone-gates.json` command passed against this correction.
The source and installed-consumer contexts use the same tested base plus the
worktree changes; the consumer has no independent repository commit. The revised
parent contract was read at `36f1cd9a2c89b8ad48384ab15a8ad25c4bb387ad`.

| Command | Actual result |
| --- | --- |
| `npm run format` | Exit 0 |
| `npm run lint` | Exit 0; zero warnings |
| `npm run format:check` | Exit 0 |
| `npm test -- --runInBand src/llm/test-boundary.test.ts` | Exit 0; shared public-API destination contract. A temporary unknown-origin fallback produced exit 1 at the semantic rejection assertion; exact-origin dispatch restored exit 0. |
| `npm test -- --runInBand src/llm/recovery-conformance.test.ts src/llm/streaming-recovery-conformance.test.ts src/llm/reasoning-history-contract.test.ts` | Exit 0; 3 suites, 2,209 tests; ordinary/streaming semantics and shared native-history contracts preserved |
| `npm test` | Exit 0; 63 suites, 5,029 tests; network access denied |
| `npm test -- --coverage` | Exit 0; statements 87.68%, branches 83.82%, functions 90.12%, lines 88.00%; all exceed the configured 70% floors |
| `npm run build` | Exit 0; also rebuilt by the final package check |
| `npm run verify:package` | Exit 0; fresh offline tarball install, declaration compile, runtime exports and all retained contract matrices; network and real-timer rejection and shared public-API destination contracts passed |
| `npm audit --omit=dev --audit-level=moderate` | Exit 0; zero vulnerabilities |
| `npm audit` | Exit 0; zero vulnerabilities, including development dependencies |
| `npm outdated --cache /tmp/mojentic-correction-npm-cache` | Exit 1; informational: gpt-tokenizer 4.0.3 installed, 4.1.0 wanted/latest; dependencies unchanged |
| `npm run docs:build` | Exit 0; existing VitePress/Rolldown plugin/bundle diagnostics and esbuild transform deprecation remain |

The source and installed consumer both passed `ts-in-process-boundary-v1` with
verifier SHA-256
`1edde9ba1c0fd9fddc03f775b9991b136ad34fd6a39c2009eb779876cef75a46`.
They assert the identical destination rejection and full configured exchange
against the base commit above plus this worktree; the installed consumer uses the
packed artifact rather than another repository’s executable snapshot.

The final source/consumer logs agree on the native-history fixture hash
`bc4157be6010770537c998626fe11a10e300435c869afaa9a47b57cbc388f2d8`
and shared verifier hash
`7dbe7699c677c80a1f550ac3e64ad7f8392a42f9cc6b95a804e098b1d97255a4`.
The final tested packed artifact SHA-256 is
`a5a6c60fa2d858579b958cfab0d49444d879f30725877b28c71fb6b63119e819`.
No external repository, live provider, service integration, release action or
Git finalization is claimed by these local results.
