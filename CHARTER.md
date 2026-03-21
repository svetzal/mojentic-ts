# Mojentic TypeScript Charter

## Purpose

Mojentic-ts is the TypeScript implementation of the Mojentic LLM integration framework. It provides a unified API for interacting with LLM providers (OpenAI, Ollama), with built-in tool calling, structured output, streaming, tracing, and an event-driven agent system. It exists to bring full Mojentic feature parity to the TypeScript ecosystem for use in Node.js applications, VS Code extensions, and Obsidian plugins.

## Goals

- Maintain full feature parity with the Python, Elixir, and Rust Mojentic implementations
- Provide type-safe, idiomatic TypeScript APIs using Result types, Zod validation, and async generators
- Support multiple LLM providers through a common gateway abstraction
- Enable agent-based workflows with event-driven dispatching, routing, and shared working memory
- Offer complete observability through the tracer system with correlation tracking
- Ship as a single npm package with zero mandatory runtime dependencies on specific LLM providers

## Non-Goals

- Being a general-purpose AI application framework (it is an LLM integration library)
- Supporting browser environments (Node.js and compatible runtimes only)
- Providing its own model hosting or fine-tuning capabilities
- Replacing provider-specific SDKs for advanced provider-only features

## Target Users

TypeScript and Node.js developers building LLM-powered applications, IDE extensions, or automation tools who want a consistent, well-typed abstraction over multiple LLM providers with built-in tool calling, structured output, and agent patterns.
