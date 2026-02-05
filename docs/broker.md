# LLM Broker Guide

The `LlmBroker` is the central interface for interacting with Large Language Models in Mojentic. It provides a consistent API across different LLM providers (gateways) and handles tool execution, error handling, and message management.

## Overview

The Broker acts as an intermediary between your application and LLM providers:

```
Your App → Broker → Gateway → LLM Provider
                ↓
            Tool Execution
```

## Creating a Broker

```typescript
import { LlmBroker, OllamaGateway } from 'mojentic';

// Basic broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);
```

### Broker Structure

```typescript
class LlmBroker {
  constructor(
    private readonly model: string,        // Model identifier
    private readonly gateway: LlmGateway   // Gateway implementation
  )
}
```

## Text Generation

The primary use case is generating text responses:

```typescript
import { Message, isOk } from 'mojentic';

const messages = [Message.user('Explain TypeScript in one sentence')];

const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value);
  // "TypeScript is a statically-typed superset of JavaScript..."
} else {
  console.error('Generation failed:', result.error);
}
```

### With Configuration

```typescript
const config: CompletionConfig = {
  temperature: 0.3,  // Lower = more focused
  maxTokens: 500
};

const result = await broker.generate(messages, undefined, config);
```

### With Tools

```typescript
import { DateResolverTool } from 'mojentic';

const tools = [new DateResolverTool()];
const result = await broker.generate(messages, tools, config);
```

## Structured Output

Generate responses conforming to a JSON schema:

```typescript
const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    keywords: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['title', 'summary']
};

const messages = [Message.user('Analyze: TypeScript is a typed language')];

const result = await broker.generateObject(messages, schema);

if (isOk(result)) {
  console.log(result.value);
  // {
  //   title: "TypeScript Language Analysis",
  //   summary: "Typed superset of JavaScript...",
  //   keywords: ["typed", "compiled", "JavaScript"]
  // }
}
```

## Tool Execution Flow

When tools are provided, the Broker handles a recursive loop:

1. Send messages to LLM
2. If LLM requests tools:
   - Execute each tool
   - Add tool results to conversation
   - Return to step 1
3. Return final text response

```typescript
// Example: Date resolution tool usage
const messages = [Message.user("What's the date next Monday?")];
const tools = [new DateResolverTool()];

// The broker will:
// 1. Call LLM with the question
// 2. LLM responds with tool call request
// 3. Broker executes DateResolverTool.run(args)
// 4. Broker adds result to conversation
// 5. Calls LLM again with tool result
// 6. LLM responds with final answer
const result = await broker.generate(messages, tools);
```

### Tool Call Handling

The broker automatically:

- Matches tool calls to available tools
- Executes tools with provided arguments
- Handles tool errors gracefully
- Manages conversation state

## Streaming

Generate responses in real-time:

```typescript
const messages = [Message.user('Write a short poem about TypeScript')];

for await (const chunk of broker.generateStream(messages)) {
  if (isOk(chunk)) {
    process.stdout.write(chunk.value);
  } else {
    console.error('Stream error:', chunk.error);
    break;
  }
}
```

## Message Management

The Broker accepts a list of messages representing the conversation:

```typescript
const messages = [
  Message.system('You are a helpful coding assistant'),
  Message.user('How do I read a file in Node.js?'),
  Message.assistant('You can use fs.readFile()...'),
  Message.user('What about async/await?')
];

const result = await broker.generate(messages);
```

### Message Types

- `Message.system(content)` - Set LLM behavior and context
- `Message.user(content)` - User input
- `Message.assistant(content, toolCalls?)` - LLM responses (for history)
- `Message.tool(content, toolCallId, name)` - Tool execution results

## Error Handling

The Broker returns Result types for explicit error handling:

```typescript
import { isOk, isErr, unwrap, unwrapOr } from 'mojentic';

const result = await broker.generate(messages);

// Pattern 1: Type guard
if (isOk(result)) {
  console.log(result.value);
} else {
  console.error(result.error);
}

// Pattern 2: Unwrap (throws on error)
try {
  const text = unwrap(result);
} catch (error) {
  console.error('Failed:', error);
}

// Pattern 3: Unwrap with default
const text = unwrapOr(result, 'Default response');
```

### Error Types

```typescript
import {
  MojenticError,   // Base error
  GatewayError,    // API/network errors
  ToolError,       // Tool execution errors
  ParseError,      // JSON parsing errors
  TimeoutError     // Timeout errors
} from 'mojentic';
```

## Configuration Options

Fine-tune LLM behavior:

```typescript
// Creative writing
const creativeConfig: CompletionConfig = {
  temperature: 1.5,
  maxTokens: 2000
};

// Factual responses
const factualConfig: CompletionConfig = {
  temperature: 0.1,
  maxTokens: 500
};

// JSON output
const jsonConfig: CompletionConfig = {
  responseFormat: {
    type: 'json_object'
  }
};
```

### Reasoning Effort

Control how much the model thinks before responding:

```typescript
// Deep reasoning for complex problems
const thinkingConfig: CompletionConfig = {
  reasoningEffort: 'high',
  temperature: 0.1
};

// Quick responses
const fastConfig: CompletionConfig = {
  reasoningEffort: 'low'
};
```

For Ollama, this enables the `think: true` parameter. For OpenAI reasoning models (o1, o3 series), it maps to the `reasoning_effort` API parameter. See [Reasoning Effort](reasoning-effort.md) for full details.

## Best Practices

### 1. Use System Messages

Set clear instructions:

```typescript
const messages = [
  Message.system(`
    You are a helpful assistant that provides concise answers.
    Always format code examples with proper syntax highlighting.
  `),
  Message.user('How do I create a class in TypeScript?')
];
```

### 2. Handle Tool Errors

Tools can fail:

```typescript
import { BaseTool, Ok, Err, ToolError } from 'mojentic';

class MyTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const result = await this.doWork(args);
      return Ok(result);
    } catch (error) {
      return Err(new ToolError(
        `Tool failed: ${error.message}`,
        'MyTool'
      ));
    }
  }
}
```

### 3. Manage Context Windows

Long conversations need truncation:

```typescript
function keepRecentMessages(messages: LlmMessage[], maxCount = 10): LlmMessage[] {
  return messages.slice(-maxCount);
}

const recentMessages = keepRecentMessages(conversationHistory);
const result = await broker.generate(recentMessages);
```

## Advanced Usage

### Multiple Models

```typescript
// Use different models for different tasks
const fastBroker = new LlmBroker('phi4:14b', new OllamaGateway());
const smartBroker = new LlmBroker('qwen3:32b', new OllamaGateway());

// Quick classification
const category = await fastBroker.generate(classifyMessages);

// Deep analysis
const analysis = await smartBroker.generate(analysisMessages);
```

### Tool Composition

```typescript
// Combine multiple tools
const tools = [
  new DateResolverTool(),
  new WeatherTool(),
  new CalculatorTool()
];

// LLM can use any tool as needed
const result = await broker.generate(messages, tools);
```

### Schema Validation

```typescript
// Strict schemas ensure valid output
const schema = {
  type: 'object',
  properties: {
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    category: { type: 'string', enum: ['tech', 'business', 'other'] }
  },
  required: ['confidence', 'category'],
  additionalProperties: false
};

const result = await broker.generateObject(messages, schema);

if (isOk(result)) {
  // Guaranteed to have required fields with valid values
  if (result.value.confidence > 0.8) {
    processHighConfidence(result.value);
  }
}
```

## See Also

- [Getting Started](/getting-started)
- [Tool Usage](/tool-usage)
- [Structured Output](/structured-output)
- [Error Handling](/error-handling)
