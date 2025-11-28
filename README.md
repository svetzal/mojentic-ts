# Mojentic

[![npm](https://img.shields.io/npm/v/mojentic.svg)](https://www.npmjs.com/package/mojentic)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0-green)](https://nodejs.org/)

A modern LLM integration framework for TypeScript with full feature parity across Python, Elixir, and Rust implementations. Perfect for building VS Code extensions, Obsidian plugins, and Node.js applications.

## 🚀 Features

- **🔌 Multi-Provider Support**: OpenAI and Ollama gateways
- **🤖 Agent System**: Complete event-driven agent framework with ReAct pattern
- **🛠️ Tool System**: Extensible function calling with automatic recursive execution
- **📊 Structured Output**: Type-safe response parsing with JSON schemas
- **🌊 Streaming**: Real-time streaming with full tool calling support
- **🔍 Tracer System**: Complete observability for debugging and monitoring
- **🔒 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🎯 Result Type Pattern**: Rust-inspired error handling for robust code
- **📦 24 Examples**: Comprehensive examples demonstrating all features

## 📦 Installation

```bash
npm install mojentic
# or
yarn add mojentic
# or
pnpm add mojentic
```

## 🔧 Prerequisites

To use Mojentic with local models, you need Ollama installed and running:

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull qwen3:32b`
3. Verify it's running: `ollama list`

## 🎯 Quick Start

### Simple Text Generation

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const messages = [Message.user('What is TypeScript?')];
const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

### Structured Output

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { isOk } from 'mojentic';

interface SentimentAnalysis {
  sentiment: string;
  confidence: number;
  reasoning: string;
}

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const schema = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
  },
  required: ['sentiment', 'confidence', 'reasoning'],
};

const messages = [
  Message.user('I love this new framework!'),
];

const result = await broker.generateObject<SentimentAnalysis>(messages, schema);

if (isOk(result)) {
  console.log(`Sentiment: ${result.value.sentiment}`);
  console.log(`Confidence: ${(result.value.confidence * 100).toFixed(1)}%`);
}
```

### Tool Usage

```typescript
import { LlmBroker, OllamaGateway, Message, DateResolverTool } from 'mojentic';
import { isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const tools = [new DateResolverTool()];

const messages = [
  Message.system('You are a helpful assistant with access to tools.'),
  Message.user('What day of the week is next Friday?'),
];

// The broker automatically handles tool calls
const result = await broker.generate(messages, tools);

if (isOk(result)) {
  console.log(result.value);
}
```

### Streaming

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const messages = [Message.user('Write a short poem about TypeScript')];

for await (const chunk of broker.generateStream(messages)) {
  if (isOk(chunk)) {
    process.stdout.write(chunk.value);
  }
}
```

### Tracer System

Monitor and debug your LLM applications:

```typescript
import { LlmBroker, OllamaGateway, Message, TracerSystem } from 'mojentic';
import { DateResolverTool } from 'mojentic';
import { isOk } from 'mojentic';

// Create a tracer system
const tracer = new TracerSystem();

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway, tracer);

const tools = [new DateResolverTool()];

// Generate unique correlation ID for tracing related events
const correlationId = crypto.randomUUID();

const messages = [
  Message.user('What day is next Friday?'),
];

const result = await broker.generate(messages, tools, {}, 10, correlationId);

// Query tracer events
const allEvents = tracer.getEvents();
console.log(`Recorded ${allEvents.length} events`);

// Filter by correlation ID
const relatedEvents = tracer.getEvents({
  filterFunc: (e) => e.correlationId === correlationId
});

// Print event summaries
relatedEvents.forEach(event => {
  console.log(event.printableSummary());
});
```

See [Tracer Documentation](docs/tracer.md) for comprehensive usage guide.

## 🏗️ Architecture

Mojentic is structured in three layers:

### Layer 1: LLM Integration

- **LlmBroker** - Main interface for LLM interactions
- **LlmGateway** interface - Abstract interface for LLM providers
- **OllamaGateway** / **OpenAiGateway** - Provider implementations
- **ChatSession** - Conversational session management
- **TokenizerGateway** - Token counting with tiktoken
- **EmbeddingsGateway** - Vector embeddings
- **Tool System** - Extensible function calling with 10+ built-in tools

### Layer 2: Tracer System

- **TracerSystem** - Complete event recording for observability
- **EventStore** - Flexible event storage and querying
- **NullTracer** - Zero-overhead when tracing is disabled
- Correlation ID tracking across requests

### Layer 3: Agent System

- **AsyncDispatcher** - Async event processing
- **Router** - Event-to-agent routing
- **AsyncLlmAgent** - LLM-powered async agents
- **AsyncAggregatorAgent** - Multi-event aggregation
- **IterativeProblemSolver** - Multi-step reasoning
- **SimpleRecursiveAgent** - Self-recursive processing
- **SharedWorkingMemory** - Agent context sharing
- ReAct pattern implementation

## 🛠️ Creating Custom Tools

Implement the `LlmTool` interface:

```typescript
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from 'mojentic';
import { Ok, Result } from 'mojentic';

export class WeatherTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const location = args.location as string;
    // Fetch weather data...
    return Ok({
      location,
      temperature: 22,
      condition: 'sunny',
    });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name',
            },
          },
          required: ['location'],
        },
      },
    };
  }
}
```

## 🎨 Error Handling

Mojentic uses a Result type pattern inspired by Rust:

```typescript
import { Result, Ok, Err, isOk, isErr, unwrap, unwrapOr } from 'mojentic';

const result = await broker.generate(messages);

// Pattern 1: Check and narrow
if (isOk(result)) {
  console.log(result.value); // Type: string
} else {
  console.error(result.error); // Type: Error
}

// Pattern 2: Unwrap (throws on error)
const value = unwrap(result);

// Pattern 3: Unwrap with default
const value = unwrapOr(result, 'default value');

// Pattern 4: Map and transform
const mapped = mapResult(result, (text) => text.toUpperCase());
```

### Error Types

```typescript
import {
  MojenticError,      // Base error
  GatewayError,       // API/network errors
  ToolError,          // Tool execution errors
  ValidationError,    // Input validation errors
  ParseError,         // JSON parsing errors
  TimeoutError,       // Timeout errors
} from 'mojentic';
```

## 📖 API Reference

### LlmBroker

Main interface for LLM interactions:

```typescript
class LlmBroker {
  constructor(model: string, gateway: LlmGateway);

  // Generate text completion
  generate(
    messages: LlmMessage[],
    tools?: LlmTool[],
    config?: CompletionConfig,
    maxToolIterations?: number
  ): Promise<Result<string, Error>>;

  // Generate structured object
  generateObject<T>(
    messages: LlmMessage[],
    schema: Record<string, unknown>,
    config?: CompletionConfig
  ): Promise<Result<T, Error>>;

  // Generate streaming completion
  generateStream(
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: LlmTool[]
  ): AsyncGenerator<Result<string, Error>>;

  // List available models
  listModels(): Promise<Result<string[], Error>>;

  // Get current model
  getModel(): string;
}
```

### Message Helpers

```typescript
class Message {
  static system(content: string): LlmMessage;
  static user(content: string): LlmMessage;
  static assistant(content: string, toolCalls?: ToolCall[]): LlmMessage;
  static tool(content: string, toolCallId: string, name: string): LlmMessage;
}
```

### CompletionConfig

```typescript
interface CompletionConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  responseFormat?: {
    type: 'json_object' | 'text';
    schema?: Record<string, unknown>;
  };
}
```

## 🧪 Examples

Run any of the 24 included examples:

```bash
# Install dependencies
npm install

# Core examples
npm run example:simple      # Simple text generation
npm run example:structured  # Structured output
npm run example:tool        # Tool usage
npm run example:streaming   # Streaming responses

# Advanced examples
npm run example:broker          # Comprehensive broker features
npm run example:broker-as-tool  # Agent delegation pattern
npm run example:tracer          # Tracer system demo
npm run example:async-llm       # Async agents
npm run example:iterative-solver # Multi-step problem solving
npm run example:recursive-agent  # Recursive agent patterns
```

## 🏗️ Architecture

Mojentic is structured in three layers:

### Layer 1: LLM Integration

- `LlmBroker` - Main interface for LLM interactions
- `LlmGateway` interface - Abstract interface for LLM providers
- `OllamaGateway` / `OpenAiGateway` - Provider implementations
- `ChatSession` - Conversational session management
- `TokenizerGateway` - Token counting with tiktoken
- `EmbeddingsGateway` - Vector embeddings
- Comprehensive tool system with 10+ built-in tools

### Layer 2: Tracer System

- `TracerSystem` - Event recording for observability
- `EventStore` - Flexible event storage and querying
- Correlation ID tracking across requests
- LLM call, response, and tool events

### Layer 3: Agent System

- `AsyncDispatcher` - Async event processing
- `Router` - Event-to-agent routing
- `AsyncLlmAgent` - LLM-powered agents
- `AsyncAggregatorAgent` - Multi-event aggregation
- `IterativeProblemSolver` - Multi-step reasoning
- `SimpleRecursiveAgent` - Self-recursive processing
- `SharedWorkingMemory` - Agent context sharing
- ReAct pattern implementation

## 🔧 Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint (zero warnings enforced)
npm run lint

# Format
npm run format

# Full quality check
npm run quality
```

## 🤝 Contributing

Contributions are welcome! This is part of the Mojentic family of implementations:

- **mojentic-py** - Python implementation (reference)
- **mojentic-ex** - Elixir implementation
- **mojentic-ru** - Rust implementation
- **mojentic-ts** - TypeScript implementation (this)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## Credits

Mojentic is a [Mojility](https://mojility.com) product by Stacey Vetzal.
