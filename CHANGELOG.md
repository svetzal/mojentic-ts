# Changelog

All notable changes to the Mojentic TypeScript implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-05-21

### Added

- **Realtime Voice subsystem** (`src/realtime/`): `RealtimeVoiceBroker` and `RealtimeSession` siblings to `LlmBroker` for duplex audio/text sessions with parallel tool calling. Targets OpenAI's Realtime API via `OpenAIRealtimeGateway` over WebSocket.
  - Vendor-neutral `RealtimeEvent` union; raw events available via `session.rawEvents()`.
  - Server VAD and manual VAD (push-to-talk) turn detection.
  - Barge-in / manual interruption with configurable output policy (`drop` | `submit-completed-only` | `submit`).
  - Audio I/O as `AsyncIterable<Int16Array>` (PCM16, 24 kHz). Hardware-free — examples use WAV files.
  - `Symbol.asyncDispose` support for `await using` syntax.
  - Six runnable examples under `examples/realtime/`.
  - VitePress guide at `docs/realtime-voice.md`.
- **`ToolRunner` abstraction** (`src/llm/tools/runner.ts`): pluggable execution strategies for batches of tool calls.
  - `SerialToolRunner` — one-at-a-time (default for `LlmBroker`, preserves backward compatibility).
  - `ParallelToolRunner(maxConcurrency=4)` — bounded fan-out (default for `RealtimeVoiceBroker`).
  - Both honour `AbortSignal` for hard cancellation.
- **`LlmTool.run(args, ctx?)`** — optional second parameter exposes `ToolRunCtx.signal` so tools can opt in to cancellation. Existing tools that ignore the context continue to work unchanged.
- **`recordToolBatch` / `ToolBatchTracerEvent`** — aggregate per-batch tracer events so consumers can measure parallelism gains without joining per-call events.
- Example: `examples/parallel_tool_calls.ts`.
- OpenAI model registry: explicit entries for the GPT-5.4 and GPT-5.5 reasoning models (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5`, `gpt-5.5-pro`, plus dated snapshots) with their correct context windows (1.05M / 400K), 128K output limit, image input, and Chat Completions + Responses API support. Previously these fell through to pattern matching, which inferred only a generic reasoning profile with wrong token limits. Pattern mappings for `gpt-5.3`/`gpt-5.4`/`gpt-5.5` were also added so future dated snapshots still resolve to `REASONING`.

### Fixed

- Parallel tool timing test thresholds tightened to use 100 ms delays and 185 ms elapsed guard, making the test resilient to environment-load spikes while still detecting sequential fallback.

## [1.4.0] - 2026-05-11

### Added

- `maxToolIterations` option on `CompletionConfig` (default `10`) — bounds recursive tool-calling in both `generate` and `generateStream`; yields/throws a `ToolError` when the limit is reached. Previously `generateStream` could recurse without bound on repeated tool-call responses.
- Integration test exercising the OpenAI tool-calling round-trip at the HTTP boundary (assistant tool-call → tool result → final response), backed by a shared fixture set used across all four mojentic ports.

### Fixed

- OpenAI gateway adapter silently dropped tool-role messages — it checked the assistant-style `tool_calls` field on tool-role messages instead of `tool_call_id`, so the tool result was excluded from the next request and multi-turn tool calling failed on the second LLM call.
- OpenAI gateway adapter double-serialized tool-call `arguments` — `JSON.stringify` was applied to an already-serialized JSON string, corrupting tool-call round-trips.
- `SimpleRecursiveAgent` completion detection used substring matching for `DONE`/`FAIL`; it now requires a strict whole-string match (case-insensitive, trimmed), so prose containing those words no longer triggers premature completion.
- `AsyncDispatcher.waitForEmptyQueue` could return while agent handlers were still in flight; it now waits for both the queue to drain and all in-flight handlers to complete.
- Asynchronous event-handler errors in `SimpleRecursiveAgent` were swallowed, leaving `solve()` to hang until its timeout; handler errors now surface via a registered error handler (`onError`).
- `SharedWorkingMemory.getWorkingMemory()` returned a shallow copy, so nested mutations leaked back into the shared store; it now returns a deep copy.

## [1.3.1] - 2026-04-13

### Security

- Fixed path traversal vulnerability in `vite` (GHSA-4w7w-66w2-5vf9) via npm override pinning `vite>=6.4.2`
- Dependency audit confirms zero vulnerabilities in production dependencies

## [1.3.0] - 2026-04-11

### Changed

- Updated TypeScript to 6.0.2 and fixed `moduleResolution` deprecation warning
- Updated `typescript-eslint` to 8.58.0 and fixed ESLint config module type
- Updated ESLint to 10.1.0

### Fixed

- Fixed high-severity vulnerabilities in `flatted` and `picomatch`
- Fixed broken npm self-update step in publish workflow that prevented v1.2.5/v1.2.6 from publishing to npm

### Security

- Dependency audit confirms zero vulnerabilities in production dependencies

## [1.2.4] - 2026-03-17

### Security

- Updated dependencies to latest patch versions to address known security vulnerabilities
- Bumped `@typescript-eslint` ecosystem to 8.57.1
- Bumped `@types/node` to 25.5.0
- Dependency audit confirms zero vulnerabilities in production dependencies

## [1.2.3] - 2026-02-27

### Security

- Fixed high-severity ReDoS vulnerabilities in `minimatch` (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74)
- Bumped `minimatch` 10.2.2 → 10.2.3
- Dependency audit confirms zero vulnerabilities

## [1.2.2] - 2026-02-26

### Security

- Updated dependencies to latest patch versions to address known security vulnerabilities
- Dependency audit confirms zero vulnerabilities in production dependencies

## [1.2.1] - 2026-02-22

### Security

- Updated `@types/node` to 25.3.0 resolving 66 transitive dependency updates
- Upgraded ESLint to v10 with flat config, resolving 31 known vulnerabilities
- Dependency audit confirms zero vulnerabilities in production dependencies

## [1.2.0] - 2026-02-05

### Added

- Reasoning effort control via `CompletionConfig.reasoningEffort` (`'low'` | `'medium'` | `'high'`)
  - Ollama gateway: maps to `think: true` parameter for extended thinking
  - OpenAI gateway: maps to `reasoning_effort` API parameter for reasoning models
- `thinking` field on gateway response for model reasoning traces (populated by Ollama)

## [1.1.0] - 2026-02-05

### Added

- API endpoint support flags on `ModelCapabilities`: `supportsChatApi`, `supportsCompletionsApi`, `supportsResponsesApi`
  - Indicates which OpenAI API endpoints each model supports (Chat, Completions, Responses)
  - Populated for all registered models based on endpoint audit data
- New models: `babbage-002`, `davinci-002`, `gpt-5.1-codex-mini`, `codex-mini-latest`

### Fixed

- `gpt-3.5-turbo-instruct` models now correctly flagged as completions-only (not chat-capable)

## [1.0.1] - 2026-02-01

### Added

- `ChatSession.sendStream()` method for streaming responses with automatic conversation history management
  - Yields content chunks in real-time as they arrive from the LLM via `AsyncGenerator<string>`
  - Automatically records user message and assembled assistant response in conversation history
  - Supports tool calling through broker's recursive streaming
  - Respects context window limits

## [1.0.0] - 2025-11-27

### 🎉 First Stable Release

This release marks the first stable version of Mojentic for TypeScript, released simultaneously across all four language implementations (Python, Elixir, Rust, and TypeScript) with full feature parity.

### Highlights

- **Complete LLM Integration Layer**: Broker, OpenAI + Ollama gateways, structured output, tool calling, streaming with recursive tool execution, image analysis, tokenizer, embeddings
- **Full Tracer System**: Event recording, correlation tracking, event filtering, broker/tool integration
- **Complete Agent System**: Base agents, async agents, event system, dispatcher, router, aggregators, iterative solver, recursive agent, ReAct pattern, shared working memory
- **Comprehensive Tool Suite**: DateResolver, File tools (8 tools), Task manager, Tell user, Ask user, Web search, Current datetime, Tool wrapper (broker as tool)
- **24 Examples**: Full example suite demonstrating all major features
- **Result Type Pattern**: Rust-inspired type-safe error handling throughout

### Added

- npm publishing configuration with proper package metadata
- Full feature parity with Python reference implementation

## [0.1.0] - 2025-01-11

### Added

#### Core Infrastructure
- Result type pattern inspired by Rust for type-safe error handling
- Comprehensive error hierarchy with `MojenticError`, `GatewayError`, `ToolError`, `ValidationError`, `ParseError`, and `TimeoutError`
- Helper functions for Result type: `Ok`, `Err`, `isOk`, `isErr`, `unwrap`, `unwrapOr`, `mapResult`, `mapError`

#### Data Models
- `LlmMessage` interface with support for System, User, Assistant, and Tool roles
- `Message` helper class for convenient message creation
- `ToolCall` interface for LLM function calling
- `CompletionConfig` interface for LLM configuration
- `GatewayResponse` interface for gateway responses
- `StreamChunk` interface for streaming responses

#### Gateway System
- `LlmGateway` interface defining the contract for LLM providers
- `OllamaGateway` implementation with full feature support:
  - Chat completions
  - Structured output (JSON mode)
  - Tool calling
  - Streaming support
  - Model listing
  - Message adaptation
  - Multimodal content (images) - structure in place, not fully tested

#### Tool System
- `LlmTool` interface for implementing custom tools
- `BaseTool` abstract class for convenient tool implementation
- `DateResolverTool` example tool for resolving relative date references
- JSON Schema support for tool parameters

#### LLM Broker
- `LlmBroker` class as the main interface for LLM interactions
- `generate()` method for text generation with automatic tool calling
- `generateObject()` method for structured output with JSON schema
- `generateStream()` method for streaming completions
- `listModels()` method for listing available models
- Automatic tool execution with configurable iteration limits

#### Examples
- `simple_llm.ts` - Basic text generation example
- `structured_output.ts` - JSON schema-based structured output example
- `tool_usage.ts` - Tool calling with automatic execution example

#### Testing
- Jest test framework configuration
- Unit tests for error handling
- Unit tests for message helpers
- Test coverage reporting

#### Documentation
- Comprehensive README.md with quick start guide
- API reference documentation
- Usage examples
- MIT License
- TYPESCRIPT.md implementation summary
- Updated PARITY.md to include TypeScript implementation

#### Development Tools
- TypeScript configuration with strict mode
- ESLint configuration with TypeScript rules
- Prettier configuration for code formatting
- Jest configuration for testing
- GitHub Actions CI/CD pipeline (4 parallel jobs):
  - Lint checking
  - Format checking
  - Build validation
  - Test execution with coverage

### Technical Details

- Minimum Node.js version: 18.0.0
- TypeScript version: 5.3.3
- Uses native `fetch` API (Node 18+)
- Uses `AsyncGenerator` for streaming
- Full type definitions for IDE support

### Notes

This is the initial release of Mojentic TypeScript, bringing the LLM integration framework to the JavaScript/TypeScript ecosystem. It's particularly well-suited for building VS Code extensions, Obsidian plugins, and Node.js applications with AI capabilities.

The implementation focuses on:
- Type safety with comprehensive TypeScript definitions
- Developer experience with excellent IDE support
- Reliability through Result type pattern for error handling
- Simplicity with a clean, intuitive API
- Flexibility for extension and customization

### Known Limitations

- OpenAI gateway not yet implemented (planned for v0.2.0)
- Anthropic gateway not yet implemented (planned for v0.2.0)
- ChatSession not yet implemented (planned for v0.2.0)
- Image analysis in Ollama gateway has structure but is not fully tested
- Limited test coverage (to be expanded in future releases)

### Future Roadmap

#### v0.2.0 (Near Future)
- OpenAI gateway implementation
- Anthropic gateway implementation
- ChatSession for conversation management
- Additional built-in tools
- Token counting utilities
- Expanded test coverage

#### v1.0.0 (Future)
- Agent system
- Event-driven architecture
- Tracer system for observability
- Embeddings support

---

[0.1.0]: https://github.com/svetzal/mojentic-ts/releases/tag/v0.1.0
