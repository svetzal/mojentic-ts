# Changelog

All notable changes to the Mojentic TypeScript implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
