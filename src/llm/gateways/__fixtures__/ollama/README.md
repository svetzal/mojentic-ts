# Ollama fixtures

Raw responses from a live Ollama server, for the gateway tests in every port.
The contract that uses them is `MODEL-METADATA-2026-10.md` at the monorepo
root.

Captured on 2026-10-15 from Ollama 0.40.5 (macOS, Apple Silicon). The files are
unedited. Response headers are not included.

| File | Request | What it shows |
| ---- | ------- | ------------- |
| `show_context_length.json` | `POST /api/show {"model":"qwen3.8:27b-mlx"}` | `model_info."qwen3_5.context_length": 262144`; `parameters` has no `num_ctx` line |
| `show_num_ctx_parameter.json` | `POST /api/show {"model":"qwen3.8-flash-next:125b-mlx"}` | `model_info."qwen4_exp.context_length": 262144`; `parameters` has a `num_ctx 262144` line |
| `error_model_not_found.json` | `POST /api/show {"model":"no-such-model:1b"}` | HTTP 404 body |

The `context_length` key carries an architecture prefix that differs between
models (`qwen3_5`, `qwen4_exp`). Match the `.context_length` suffix, not a
fixed key.

## TypeScript replay provenance

Copied byte-for-byte from `svetzal/mojentic-unify` source
`4b08dcd1d87f520a4c70928c33a2bc84c228093d`, for section 1 of
`MODEL-METADATA-2026-10.md` (SHA-256
`a085da1c0d110f9d587a24ace6ac2854b653e1ac28905b3829d94d665b2c906e`).
The executable replay is `../../model-context-http.test.ts`, using an in-process
transport double and the public gateways, as in the oMLX protocol fixture tests.
Replay opens no socket or server and uses deterministic time.
These captures describe the provider versions above; they are not paired
consumer/provider verification of a newly released package.

```text
f5302087e61a9af18abef1b9315b226aa8dfab326ed1751d4bff12b05e1b9dab  error_model_not_found.json
a95dc92e483a8b09d16e739be3111ecba58e90dc2ae5ab49cd22c78e16ff9233  show_context_length.json
8236bd781ee623fa2859ce5187d855b2ef5806dfa6a2e38e38d4a612dc876930  show_num_ctx_parameter.json
```
