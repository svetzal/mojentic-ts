# Introduction to Mojentic for TypeScript

Mojentic is a comprehensive LLM integration framework designed to make building AI-powered applications simple, reliable, and maintainable. The TypeScript implementation embraces type safety and modern async patterns.

## Philosophy

The TypeScript implementation of Mojentic follows these principles:

- **Type Safety First**: Leverage TypeScript's type system to catch errors at compile time
- **Explicit Error Handling**: Use Result types to make errors visible and type-safe
- **Clean Abstractions**: Simple interfaces that hide complexity
- **Developer Experience**: Excellent IDE support with IntelliSense
- **Composable Design**: Mix and match components to build complex behaviors

## Core Features

### Layer 1: LLM Integration

- **LLM Broker**: Central interface for LLM interactions with any provider
- **Multiple Gateways**: Support for Ollama (OpenAI and Anthropic planned)
- **Tool Calling**: Automatic recursive tool execution
- **Structured Output**: Schema-based JSON parsing and validation
- **Streaming**: Real-time response streaming
- **Message History**: Conversation context management

### Error Handling

Mojentic uses a Result type pattern for explicit error handling:

```typescript
const result = await broker.generate(messages);

if (isOk(result)) {
  console.log('Success:', result.value);
} else {
  console.error('Error:', result.error.message);
}
```

All operations return `Result<T, Error>` types, making errors visible in the type system.

## Quick Example

```typescript
import { LlmBroker, OllamaGateway, Message, isOk } from 'mojentic';

// Create a broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Generate text
const messages = [Message.user('What is TypeScript?')];
const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value);
}
```

## Architecture

Mojentic is organized into layers:

1. **Layer 1**: Core LLM integration (Broker, Gateways, Tools, Messages)
2. **Layer 2**: Advanced features (ChatSession, Tracer system - planned)
3. **Layer 3**: Agent system for complex workflows (planned)

## Next Steps

- [Getting Started](/getting-started) - Installation and basic usage
- [Broker Guide](/broker) - Understanding the LLM Broker
- [Tool Usage](/tool-usage) - Building and using tools
- [Structured Output](/structured-output) - Working with schemas

## The Problem

Building applications with Large Language Models involves several challenges:

1. **Provider Lock-in**: Different providers have different APIs
2. **Error Handling**: Network and API errors need careful handling
3. **Tool Calling**: Function calling requires complex orchestration
4. **Type Safety**: Raw API responses lack type information
5. **Streaming**: Real-time responses need special handling

## The Solution

Mojentic solves these problems with:

### 🔌 Provider Abstraction

Switch between Ollama, OpenAI, and Anthropic with a single line:

```typescript
// Use Ollama
const broker = new LlmBroker('qwen3:32b', new OllamaGateway());

// Switch to OpenAI
const broker = new LlmBroker('gpt-4', new OpenAIGateway());
```

### 🔒 Type Safety

Full TypeScript support with comprehensive types:

```typescript
interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

const result = await broker.generateObject<SentimentAnalysis>(
  messages,
  schema
);

if (isOk(result)) {
  // result.value is typed as SentimentAnalysis
  console.log(result.value.sentiment);
}
```

### 🛠️ Automatic Tool Calling

Tools are called automatically by the broker:

```typescript
const tools = [new DateResolverTool(), new WeatherTool()];
const result = await broker.generate(messages, tools);
// Mojentic handles all tool calls automatically
```

### 🎯 Robust Error Handling

Result type pattern makes errors explicit:

```typescript
const result = await broker.generate(messages);

if (isOk(result)) {
  // Success path - result.value is string
  console.log(result.value);
} else {
  // Error path - result.error is Error
  console.error(result.error);
}
```

## Architecture

Mojentic is built in layers:

### Layer 1: LLM Integration (Current)

The foundation provides direct LLM interaction:

- **LlmBroker** - Main interface for all operations
- **LlmGateway** - Abstract interface for providers
- **Gateway Implementations** - Ollama, OpenAI, Anthropic
- **Tool System** - Extensible function calling
- **Message Models** - Type-safe message handling

### Layer 2: Advanced Features (Planned)

Future enhancements:

- **ChatSession** - Conversation state management
- **Tracer System** - Observability and debugging
- **Embeddings** - Vector generation and search

### Layer 3: Agent System (Future)

Multi-agent orchestration:

- **Event System** - Event-driven coordination
- **Agent Behaviors** - Reusable agent patterns
- **Workflow Engine** - Complex agent workflows

## Philosophy

Mojentic follows these principles:

### Simplicity

The API should be intuitive and easy to learn:

```typescript
const result = await broker.generate([
  Message.user('Hello!')
]);
```

### Type Safety

Types should guide development and catch errors:

```typescript
// TypeScript knows the return type
const result: Result<string, Error> = await broker.generate(messages);
```

### Explicit Error Handling

Errors should be values, not exceptions:

```typescript
// No try-catch needed
if (isOk(result)) {
  // Handle success
} else {
  // Handle error
}
```

### Composability

Components should work together seamlessly:

```typescript
// Compose gateways, tools, and configs
const broker = new LlmBroker(model, gateway);
const result = await broker.generate(messages, tools, config);
```

## Comparison

### vs Direct API Calls

**Direct OpenAI API:**
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
// Raw response, manual error handling, provider-specific
```

**With Mojentic:**
```typescript
const result = await broker.generate([Message.user('Hello')]);
// Typed result, automatic error handling, provider-agnostic
```

### vs LangChain

**LangChain:**
- Python-first with TypeScript port
- Large, complex API surface
- Many abstractions and concepts
- Heavy dependencies

**Mojentic:**
- TypeScript-first design
- Small, focused API
- Clear, simple concepts
- Minimal dependencies

## Use Cases

Mojentic excels at:

### 🔧 VS Code Extensions

Build AI-powered editor features:
- Code completion
- Documentation generation
- Refactoring assistance

### 📝 Obsidian Plugins

Create intelligent note-taking:
- Note generation
- Summarization
- Tag suggestions

### 🌐 Web Applications

Add AI to Node.js apps:
- Chatbots
- Content generation
- Data extraction

### 🤖 CLI Tools

Build command-line AI:
- Code generators
- File processors
- Interactive assistants

## Next Steps

Ready to build with Mojentic?

- [Getting Started](/guide/getting-started) - First steps
- [Examples](/examples/) - Complete examples
- [API Reference](/api/broker) - Detailed API docs
