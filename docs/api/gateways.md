# API Reference - Gateways

Gateways provide the interface between Mojentic and LLM providers.

## LlmGateway Interface

```typescript
interface LlmGateway {
  generate(
    messages: LlmMessage[],
    modelId: string,
    config?: CompletionConfig
  ): Promise<Result<GatewayResponse, Error>>;

  generateStream(
    messages: LlmMessage[],
    modelId: string,
    config?: CompletionConfig
  ): Promise<Result<AsyncGenerator<StreamChunk, void, unknown>, Error>>;

  listModels(): Promise<Result<string[], Error>>;
}
```

Base interface for all LLM gateways.

## OllamaGateway

Gateway for [Ollama](https://ollama.ai/) local LLM server.

### Constructor

```typescript
class OllamaGateway implements LlmGateway {
  constructor(baseUrl?: string)
}
```

**Parameters:**
- `baseUrl`: Ollama server URL (default: 'http://localhost:11434')

**Example:**
```typescript
import { OllamaGateway } from 'mojentic';

// Default local server
const gateway = new OllamaGateway();

// Custom URL
const gateway = new OllamaGateway('http://192.168.1.100:11434');
```

### generate

```typescript
async generate(
  messages: LlmMessage[],
  modelId: string,
  config?: CompletionConfig
): Promise<Result<GatewayResponse, Error>>
```

Generate a complete response.

**Parameters:**
- `messages`: Conversation messages
- `modelId`: Ollama model name (e.g., 'qwen3:32b', 'llama2', 'mistral')
- `config`: Optional configuration

**Returns:**
- `Result<GatewayResponse, Error>`: Ok with response or Err with error

**Example:**
```typescript
const messages = [
  Message.user('Hello!')
];

const result = await gateway.generate(messages, 'qwen3:32b');

if (isOk(result)) {
  const response = result.value;
  console.log(response.content);
  console.log('Tokens used:', response.usage?.totalTokens);
}
```

**With Configuration:**
```typescript
const result = await gateway.generate(messages, 'qwen3:32b', {
  temperature: 0.8,
  maxTokens: 1000
});
```

### generateStream

```typescript
async generateStream(
  messages: LlmMessage[],
  modelId: string,
  config?: CompletionConfig
): Promise<Result<AsyncGenerator<StreamChunk, void, unknown>, Error>>
```

Generate a streaming response.

**Parameters:**
- `messages`: Conversation messages
- `modelId`: Ollama model name
- `config`: Optional configuration (must include `stream: true`)

**Returns:**
- `Result<AsyncGenerator<StreamChunk>, Error>`: Ok with async generator or Err with error

**Example:**
```typescript
const result = await gateway.generateStream(
  messages,
  'qwen3:32b',
  { stream: true }
);

if (isOk(result)) {
  for await (const chunk of result.value) {
    process.stdout.write(chunk.content);

    if (chunk.isComplete) {
      console.log('\n---Done---');
    }
  }
}
```

### listModels

```typescript
async listModels(): Promise<Result<string[], Error>>
```

Get list of available models.

**Returns:**
- `Result<string[], Error>`: Ok with model names or Err with error

**Example:**
```typescript
const result = await gateway.listModels();

if (isOk(result)) {
  console.log('Available models:');
  result.value.forEach(model => console.log(`  - ${model}`));
}
```

## Supported Models

Ollama supports many models. Popular ones include:

- **Qwen**: `qwen3:32b`, `qwen3:14b`, `qwen3:7b`
- **Llama**: `llama2`, `llama2:13b`, `llama2:70b`
- **Mistral**: `mistral`, `mistral:7b`
- **CodeLlama**: `codellama`, `codellama:13b`
- **Phi**: `phi`, `phi:medium`

Check available models:
```bash
ollama list
```

Pull new models:
```bash
ollama pull qwen3:32b
```

## Message Format

### Mojentic to Ollama

Mojentic messages are converted to Ollama format:

```typescript
// Mojentic
{
  role: MessageRole.User,
  content: "Hello!"
}

// Ollama API
{
  role: "user",
  content: "Hello!"
}
```

### Tool Calls

Tool calls are converted to Ollama's format:

```typescript
// Mojentic
{
  role: MessageRole.Assistant,
  content: "",
  toolCalls: [{
    id: "call_1",
    type: "function",
    function: {
      name: "get_weather",
      arguments: '{"location": "Paris"}'
    }
  }]
}

// Ollama API
{
  role: "assistant",
  content: "",
  tool_calls: [{
    id: "call_1",
    type: "function",
    function: {
      name: "get_weather",
      arguments: {"location": "Paris"}
    }
  }]
}
```

## Configuration Options

### Ollama-Specific

```typescript
interface OllamaConfig extends CompletionConfig {
  temperature?: number;      // 0.0-2.0
  maxTokens?: number;        // Max tokens to generate
  topP?: number;             // 0.0-1.0
  topK?: number;             // Top-K sampling
  repeatPenalty?: number;    // Repetition penalty
  seed?: number;             // Random seed for determinism
  stream?: boolean;          // Enable streaming
}
```

**Example:**
```typescript
const config = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  seed: 42
};

const result = await gateway.generate(messages, 'qwen3:32b', config);
```

### Temperature Guide

- `0.0-0.3`: Focused, deterministic
- `0.4-0.7`: Balanced
- `0.8-1.2`: Creative
- `1.3-2.0`: Very creative, less coherent

## Error Handling

### Gateway Errors

```typescript
const result = await gateway.generate(messages, 'qwen3:32b');

if (isErr(result)) {
  const error = result.error;

  if (error instanceof GatewayError) {
    console.error('Ollama error:', error.message);
    console.error('Status code:', error.statusCode);

    if (error.statusCode === 404) {
      console.error('Model not found. Install with: ollama pull qwen3:32b');
    } else if (error.statusCode === 503) {
      console.error('Ollama server not responding');
    }
  }
}
```

### Connection Errors

```typescript
try {
  const result = await gateway.generate(messages, 'qwen3:32b');

  if (isErr(result)) {
    if (result.error.message.includes('ECONNREFUSED')) {
      console.error('Cannot connect to Ollama. Is it running?');
      console.error('Start with: ollama serve');
    }
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Streaming Details

### Chunk Structure

```typescript
interface StreamChunk {
  content: string;        // Partial text
  isComplete: boolean;    // Is this the last chunk?
  toolCalls?: ToolCall[]; // Tool calls (only in final chunk)
  finishReason?: string;  // Why generation stopped
}
```

### Processing Chunks

```typescript
const result = await gateway.generateStream(messages, 'qwen3:32b', {
  stream: true
});

if (isOk(result)) {
  let fullResponse = '';

  for await (const chunk of result.value) {
    fullResponse += chunk.content;
    process.stdout.write(chunk.content);

    if (chunk.isComplete) {
      console.log('\n---Complete---');
      console.log('Full response length:', fullResponse.length);

      if (chunk.toolCalls) {
        console.log('Tool calls requested:', chunk.toolCalls.length);
      }
    }
  }
}
```

### Stream Error Handling

```typescript
const result = await gateway.generateStream(messages, 'qwen3:32b', {
  stream: true
});

if (isErr(result)) {
  console.error('Failed to start stream:', result.error);
  return;
}

try {
  for await (const chunk of result.value) {
    // Process chunk
  }
} catch (error) {
  console.error('Stream interrupted:', error);
}
```

## Best Practices

### 1. Connection Management

```typescript
// Good: Reuse gateway instance
const gateway = new OllamaGateway();

async function chat1() {
  return await gateway.generate(messages, 'qwen3:32b');
}

async function chat2() {
  return await gateway.generate(messages, 'qwen3:32b');
}
```

### 2. Check Server Availability

```typescript
async function ensureOllamaRunning(gateway: OllamaGateway): Promise<boolean> {
  const result = await gateway.listModels();
  return isOk(result);
}

if (!await ensureOllamaRunning(gateway)) {
  console.error('Ollama server not available');
  process.exit(1);
}
```

### 3. Model Validation

```typescript
async function checkModel(
  gateway: OllamaGateway,
  modelId: string
): Promise<boolean> {
  const result = await gateway.listModels();

  if (isOk(result)) {
    return result.value.includes(modelId);
  }

  return false;
}

const modelExists = await checkModel(gateway, 'qwen3:32b');
if (!modelExists) {
  console.error('Model not installed. Run: ollama pull qwen3:32b');
}
```

### 4. Streaming for Long Responses

```typescript
// Use streaming for better UX with long responses
const config = {
  stream: true,
  maxTokens: 4000
};

const result = await gateway.generateStream(messages, 'qwen3:32b', config);
```

## Complete Example

```typescript
import {
  OllamaGateway,
  Message,
  isOk,
  isErr,
  GatewayError
} from 'mojentic';

// Setup
const gateway = new OllamaGateway();

// Check server
const modelsResult = await gateway.listModels();
if (isErr(modelsResult)) {
  console.error('Cannot connect to Ollama server');
  process.exit(1);
}

console.log('Available models:', modelsResult.value);

// Check specific model
const modelId = 'qwen3:32b';
if (!modelsResult.value.includes(modelId)) {
  console.error(`Model ${modelId} not found`);
  console.error(`Install with: ollama pull ${modelId}`);
  process.exit(1);
}

// Generate
const messages = [
  Message.system('You are a helpful assistant'),
  Message.user('Explain async/await in TypeScript')
];

const config = {
  temperature: 0.7,
  maxTokens: 1000
};

const result = await gateway.generate(messages, modelId, config);

if (isOk(result)) {
  const response = result.value;
  console.log('Response:', response.content);
  console.log('\nUsage:');
  console.log('  Prompt tokens:', response.usage?.promptTokens);
  console.log('  Completion tokens:', response.usage?.completionTokens);
  console.log('  Total tokens:', response.usage?.totalTokens);
} else {
  const error = result.error;

  if (error instanceof GatewayError) {
    console.error('Gateway error:', error.message);
    console.error('Status:', error.statusCode);
  } else {
    console.error('Error:', error.message);
  }
}
```

## Future Gateways

Planned gateway implementations:

- **OpenAI**: ChatGPT models (GPT-4, GPT-3.5-turbo)
- **Anthropic**: Claude models
- **Google**: Gemini models
- **Groq**: Fast inference

All gateways implement the same `LlmGateway` interface for consistency.

## See Also

- [Getting Started](/getting-started)
- [Broker API](/api/broker)
- [Core API](/api/core)
- [Streaming Guide](/streaming)
