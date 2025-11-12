# Mojentic TypeScript

A modern LLM integration framework for TypeScript with tool support, structured output generation, and streaming capabilities. Perfect for building VS Code extensions, Obsidian plugins, and Node.js applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0-green)](https://nodejs.org/)

## 🚀 Features

- **🔌 Multi-Provider Support**: Works with Ollama (OpenAI and Anthropic coming soon)
- **🛠️ Tool System**: Extensible function calling for LLMs
- **📊 Structured Output**: Type-safe response parsing with JSON schemas
- **🌊 Streaming Support**: Real-time streaming completions
- **🔒 Type-Safe**: Full TypeScript support with comprehensive type definitions
- **🎯 Result Type Pattern**: Rust-inspired error handling for robust code
- **🏗️ Modular Design**: Clean architecture with pluggable gateways

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

## 🏗️ Architecture

Mojentic is structured in layers:

### Layer 1: LLM Integration (Current)

- **LlmBroker** - Main interface for LLM interactions
- **LlmGateway** interface - Abstract interface for LLM providers
- **OllamaGateway** - Ollama provider implementation (✅ Complete)
- **OpenAI Gateway** - OpenAI provider (🚧 Planned)
- **Anthropic Gateway** - Anthropic Claude provider (🚧 Planned)
- **Tool System** - Extensible function calling
- **Message Models** - Type-safe message handling

### Layer 2: Agent System (Future)

- Event-driven agent coordination
- Async event processing
- Router and dispatcher

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

The repository includes several runnable examples:

```bash
# Install dependencies
npm install

# Run examples
npm run example:simple      # Simple text generation
npm run example:structured  # Structured output
npm run example:tool        # Tool usage
```

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

# Lint
npm run lint

# Format
npm run format
```

## 🗺️ Roadmap

### Current (v0.1.0)
- ✅ Core types and error handling
- ✅ LlmGateway interface
- ✅ Ollama gateway with streaming
- ✅ LlmBroker with tool support
- ✅ Example tools (DateResolver)
- ✅ Comprehensive examples

### Near Future (v0.2.0)
- 🚧 OpenAI gateway
- 🚧 Anthropic gateway
- 🚧 ChatSession for conversation management
- 🚧 More built-in tools
- 🚧 Token counting utilities

### Future (v1.0.0)
- 🔮 Agent system
- 🔮 Event-driven architecture
- 🔮 Tracer system for observability
- 🔮 Embeddings support

## 🤝 Contributing

Contributions are welcome! This is part of the Mojentic family of implementations:

- **mojentic-py** - Python implementation (reference)
- **mojentic-ex** - Elixir implementation
- **mojentic-ru** - Rust implementation
- **mojentic-ts** - TypeScript implementation (this)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Credits

Mojentic is a Mojility product by Stacey Vetzal.

## 📞 Support

- 🐛 [Issue Tracker](https://github.com/svetzal/mojentic-ts/issues)
- 📧 Email: stacey@mojility.com
- 🌐 Website: [mojility.com](https://mojility.com)

## 🌟 Use Cases

Perfect for:

- 🔧 **VS Code Extensions**: Build AI-powered editor features
- 📝 **Obsidian Plugins**: Create intelligent note-taking tools
- 🌐 **Web Applications**: Add AI capabilities to Node.js apps
- 🤖 **CLI Tools**: Build intelligent command-line utilities
- 📊 **Data Processing**: Automate analysis and extraction

---

**Built with ❤️ for the TypeScript community**
