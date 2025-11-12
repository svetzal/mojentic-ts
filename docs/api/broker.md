# API Reference - Broker

The LlmBroker is the main interface for interacting with LLMs.

## LlmBroker Class

```typescript
class LlmBroker {
  constructor(
    modelId: string,
    gateway: LlmGateway,
    config?: CompletionConfig
  )
}
```

Central orchestrator for LLM interactions.

**Parameters:**
- `modelId`: Model identifier (e.g., 'qwen3:32b', 'gpt-4')
- `gateway`: LLM gateway instance
- `config`: Optional default configuration

**Example:**
```typescript
import { LlmBroker, OllamaGateway } from 'mojentic';

const gateway = new OllamaGateway('http://localhost:11434');
const broker = new LlmBroker('qwen3:32b', gateway, {
  temperature: 0.7,
  maxTokens: 2000
});
```

## Methods

### generate

```typescript
async generate(
  messages: LlmMessage[],
  tools?: LlmTool[],
  config?: CompletionConfig
): Promise<Result<string, Error>>
```

Generate a text response from the LLM.

**Parameters:**
- `messages`: Conversation history
- `tools`: Optional tools the LLM can call
- `config`: Optional configuration overrides

**Returns:**
- `Result<string, Error>`: Ok with generated text or Err with error

**Example:**
```typescript
const messages = [
  Message.system('You are a helpful assistant'),
  Message.user('What is the capital of France?')
];

const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value); // "The capital of France is Paris."
}
```

**With Tools:**
```typescript
const tools = [new DateResolverTool()];

const messages = [
  Message.user('What day is next Friday?')
];

const result = await broker.generate(messages, tools);
// The broker will automatically:
// 1. Send request to LLM
// 2. Execute any tool calls
// 3. Send results back to LLM
// 4. Return final response
```

**With Config Override:**
```typescript
const result = await broker.generate(messages, undefined, {
  temperature: 0.9,
  maxTokens: 500
});
```

### generateObject

```typescript
async generateObject(
  messages: LlmMessage[],
  schema: Record<string, any>,
  config?: CompletionConfig
): Promise<Result<Record<string, any>, Error>>
```

Generate structured output matching a JSON schema.

**Parameters:**
- `messages`: Conversation history
- `schema`: JSON Schema defining expected structure
- `config`: Optional configuration overrides

**Returns:**
- `Result<Record<string, any>, Error>`: Ok with parsed object or Err with error

**Example:**
```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    city: { type: 'string' }
  },
  required: ['name', 'age']
};

const messages = [
  Message.user('Extract: John Smith, 34, lives in Seattle')
];

const result = await broker.generateObject(messages, schema);

if (isOk(result)) {
  console.log(result.value);
  // { name: "John Smith", age: 34, city: "Seattle" }
}
```

**Complex Schema:**
```typescript
const schema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          product: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' }
        },
        required: ['product', 'quantity', 'price']
      }
    },
    total: { type: 'number' }
  },
  required: ['items', 'total']
};

const result = await broker.generateObject(messages, schema);
```

### generateStream

```typescript
async generateStream(
  messages: LlmMessage[],
  tools?: LlmTool[],
  config?: CompletionConfig
): Promise<Result<AsyncGenerator<StreamChunk, void, unknown>, Error>>
```

Generate a streaming response.

**Parameters:**
- `messages`: Conversation history
- `tools`: Optional tools the LLM can call
- `config`: Optional configuration overrides

**Returns:**
- `Result<AsyncGenerator<StreamChunk>, Error>`: Ok with async generator or Err with error

**Example:**
```typescript
const messages = [
  Message.user('Write a short story')
];

const result = await broker.generateStream(messages);

if (isOk(result)) {
  for await (const chunk of result.value) {
    process.stdout.write(chunk.content);

    if (chunk.isComplete) {
      console.log('\n---Complete---');
      if (chunk.finishReason) {
        console.log(`Reason: ${chunk.finishReason}`);
      }
    }
  }
}
```

**Error Handling:**
```typescript
const result = await broker.generateStream(messages);

if (isErr(result)) {
  console.error('Failed to start stream:', result.error);
  return;
}

try {
  for await (const chunk of result.value) {
    process.stdout.write(chunk.content);
  }
} catch (error) {
  console.error('Stream error:', error);
}
```

## Message Management

### Building Conversations

```typescript
const messages: LlmMessage[] = [
  Message.system('You are a helpful coding assistant'),
  Message.user('How do I read a file in TypeScript?'),
  Message.assistant('You can use fs.readFile...'),
  Message.user('What about async/await?')
];

const result = await broker.generate(messages);
```

### Appending Responses

```typescript
let messages = [Message.user('Hello')];

const result1 = await broker.generate(messages);
if (isOk(result1)) {
  messages.push(Message.assistant(result1.value));
}

messages.push(Message.user('Tell me more'));

const result2 = await broker.generate(messages);
```

### Managing Context

```typescript
// Keep last N messages
function trimMessages(messages: LlmMessage[], keepLast: number): LlmMessage[] {
  const system = messages.filter(m => m.role === MessageRole.System);
  const others = messages.filter(m => m.role !== MessageRole.System);
  return [...system, ...others.slice(-keepLast)];
}

let messages = [...longConversation];
messages = trimMessages(messages, 10);

const result = await broker.generate(messages);
```

## Configuration

### Default Configuration

Set default config in constructor:

```typescript
const broker = new LlmBroker('qwen3:32b', gateway, {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9
});

// Uses default config
await broker.generate(messages);
```

### Per-Request Configuration

Override config per request:

```typescript
// More creative
const creative = await broker.generate(messages, undefined, {
  temperature: 1.2
});

// More focused
const focused = await broker.generate(messages, undefined, {
  temperature: 0.3
});

// Shorter response
const brief = await broker.generate(messages, undefined, {
  maxTokens: 100
});
```

### Common Settings

```typescript
// Deterministic responses
const config = {
  temperature: 0.0,
  topP: 1.0
};

// Creative responses
const config = {
  temperature: 1.5,
  topP: 0.95
};

// Balanced
const config = {
  temperature: 0.7,
  maxTokens: 1000
};
```

## Tool Execution

### Automatic Execution

The broker automatically executes tools:

```typescript
const tools = [
  new DateResolverTool(),
  new WeatherTool(),
  new CalculatorTool()
];

const messages = [
  Message.user('What will the weather be like next Monday in Tokyo?')
];

const result = await broker.generate(messages, tools);
// 1. LLM calls DateResolverTool('next Monday')
// 2. LLM calls WeatherTool('Tokyo', '2025-12-15')
// 3. LLM provides final answer
```

### Tool Call Limit

The broker limits recursive tool calls to prevent infinite loops:

```typescript
// Maximum 10 tool execution rounds by default
const result = await broker.generate(messages, tools);
```

If limit is exceeded, returns an error.

### Tool Results

Tool results are automatically added to conversation:

```typescript
// Initial messages
[
  Message.user('What day is tomorrow?')
]

// After tool execution
[
  Message.user('What day is tomorrow?'),
  Message.assistant('', [toolCall]),
  Message.tool('{"date": "2025-12-11", "day": "Thursday"}', toolCallId, 'resolve_date'),
  Message.assistant('Tomorrow is Thursday, December 11, 2025')
]
```

## Error Handling

### Result Type

All methods return `Result<T, Error>`:

```typescript
const result = await broker.generate(messages);

if (isOk(result)) {
  // Success path
  const text = result.value;
} else {
  // Error path
  const error = result.error;
}
```

### Error Types

```typescript
const result = await broker.generate(messages);

if (isErr(result)) {
  const error = result.error;

  if (error instanceof GatewayError) {
    console.error('Gateway failed:', error.gateway, error.statusCode);
  } else if (error instanceof ToolError) {
    console.error('Tool failed:', error.toolName);
  } else if (error instanceof TimeoutError) {
    console.error('Timeout after', error.timeoutMs, 'ms');
  }
}
```

### Structured Output Errors

```typescript
const result = await broker.generateObject(messages, schema);

if (isErr(result)) {
  const error = result.error;

  if (error instanceof ParseError) {
    console.error('Failed to parse JSON');
  } else if (error instanceof ValidationError) {
    console.error('Response does not match schema');
  }
}
```

## Best Practices

### 1. Reuse Broker Instances

```typescript
// Good: Create once, reuse
const broker = new LlmBroker('qwen3:32b', gateway);

async function chat(message: string) {
  return await broker.generate([Message.user(message)]);
}

// Bad: Create for each request
async function chat(message: string) {
  const broker = new LlmBroker('qwen3:32b', gateway);
  return await broker.generate([Message.user(message)]);
}
```

### 2. Handle Errors

```typescript
// Good: Check result
const result = await broker.generate(messages);
if (isOk(result)) {
  return result.value;
} else {
  console.error(result.error);
  return 'An error occurred';
}

// Bad: Assume success
const result = await broker.generate(messages);
return result.value; // Type error! Could be undefined
```

### 3. Use System Messages

```typescript
// Good: Clear system context
const messages = [
  Message.system('You are a helpful coding assistant specializing in TypeScript'),
  Message.user('How do I use async/await?')
];

// Less effective: No system context
const messages = [
  Message.user('How do I use async/await?')
];
```

### 4. Manage Context Length

```typescript
// Monitor message count
if (messages.length > 20) {
  messages = trimMessages(messages, 15);
}

const result = await broker.generate(messages);
```

## Complete Example

```typescript
import {
  LlmBroker,
  OllamaGateway,
  Message,
  DateResolverTool,
  isOk,
  isErr,
  GatewayError
} from 'mojentic';

// Setup
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway, {
  temperature: 0.7
});

// Tools
const tools = [new DateResolverTool()];

// Conversation
const messages = [
  Message.system('You are a helpful assistant'),
  Message.user('What day is next Monday?')
];

// Generate
const result = await broker.generate(messages, tools);

if (isOk(result)) {
  console.log('Response:', result.value);

  // Continue conversation
  messages.push(Message.assistant(result.value));
  messages.push(Message.user('And the Monday after that?'));

  const result2 = await broker.generate(messages, tools);
  if (isOk(result2)) {
    console.log('Response 2:', result2.value);
  }
} else {
  const error = result.error;

  if (error instanceof GatewayError) {
    console.error(`Gateway ${error.gateway} error:`, error.message);
  } else {
    console.error('Error:', error.message);
  }
}
```

## See Also

- [Getting Started](/getting-started)
- [Broker Guide](/broker)
- [Tool Usage](/tool-usage)
- [Structured Output](/structured-output)
- [Core API](/api/core)
- [Gateway API](/api/gateways)
