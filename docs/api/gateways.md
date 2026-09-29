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
  maxTokens?: number;        // Cross-provider max tokens to generate
  numPredict?: number;       // Ollama-specific max tokens (takes precedence)
  topP?: number;             // 0.0-1.0, nucleus sampling
  topK?: number;             // Top-K sampling (limits token choices)
  numCtx?: number;           // Context window size in tokens
  frequencyPenalty?: number; // Penalty for token frequency
  presencePenalty?: number;  // Penalty for token presence
  stop?: string[];           // Stop sequences
  stream?: boolean;          // Enable streaming
  responseFormat?: {         // Structured output
    type: 'json_object' | 'text';
    schema?: Record<string, unknown>;
  };
}
```

**Example:**
```typescript
const config = {
  temperature: 0.7,
  numPredict: 2000,  // Ollama-specific, preferred over maxTokens
  topP: 0.9,
  topK: 40,
  numCtx: 8192,      // Context window size
  stop: ['END', 'STOP']
};

const result = await gateway.generate('qwen3:32b', messages, config);
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

## OMLXGateway

Gateway for [oMLX](https://github.com/jundot/omlx), an LLM server for Apple Silicon.

oMLX uses the OpenAI chat completions protocol. Do not use `OpenAIGateway` for it. The OpenAI
gateway changes requests for model names that it does not know, discards `reasoning_content`,
and chunks embedding input with the OpenAI tokenizer. `OMLXGateway` uses the OpenAI message
adapter and the OpenAI stream parsers. It does not use the OpenAI model registry, and it does
not change parameters for each model.

### Configuration

```typescript
class OMLXGateway implements LlmGateway {
  constructor(host?: string, apiKey?: string, timeout?: number);
}
```

| Parameter | Environment variable | Default |
| --------- | -------------------- | ------- |
| `host` | `OMLX_HOST` | `http://localhost:8000` |
| `apiKey` | `OMLX_API_KEY` | none |
| `timeout` (milliseconds) | `OMLX_TIMEOUT` | `600000` (10 minutes) |

- The gateway uses the constructor value first, then the environment variable, then the
  default.
- Give the host without `/v1`. The gateway adds `/v1` to each path.
- When there is an API key, the gateway sends `Authorization: Bearer <key>`. When there is no
  key, the gateway sends no `Authorization` header.
- The timeout applies to each request that does not stream, and to `loadModel`. Local models
  are slow, so the default is long. A reply of 16384 tokens at 16 tokens each second takes
  17 minutes.
- The timeout does not apply to streams. A fetch timeout includes the full response body, so it
  would stop a long reply. To stop a stream, stop the iteration, or abort the `signal` that you
  give to `generateStreamEvents`.
- If `OMLX_TIMEOUT` is not a positive integer, the gateway uses the default.

```typescript
import { LlmBroker, Message, OMLXGateway } from 'mojentic';

const gateway = new OMLXGateway(); // OMLX_HOST, OMLX_API_KEY, OMLX_TIMEOUT
const broker = new LlmBroker('Qwen3.8-27B-MLX-8bit', gateway);
const result = await broker.generate([Message.user('Hello')]);
```

### Request body

| `CompletionConfig` | Request body |
| ------------------ | ------------ |
| `temperature` | `temperature` (default `1.0`) |
| `maxTokens` | `max_tokens` (default `16384`). Never `max_completion_tokens` |
| `topP`, `topK` | `top_p`, `top_k`, when set |
| `reasoningEffort` | `reasoning_effort`, unchanged, when set |
| `responseFormat` | `response_format`, as the OpenAI gateway sends it |
| `numCtx`, `numPredict` | Not sent. oMLX sets the context length for each model |

Tools go in `tools`, in the OpenAI format.

### Thinking

The gateway puts `reasoning_content` from the response in `GatewayResponse.thinking`. When the
response has no `reasoning_content`, `thinking` is `undefined`.

The gateway sends `reasoningEffort` to the chat template of the model. The effect of the value
depends on the model. When `reasoningEffort` is not set, the model uses its default. Qwen 3
models think by default.

### Truncated replies

When the finish reason is not `stop`, `content` is not an answer. Examine `finishReason` before
you use `content`.

If `maxTokens` stops generation during thinking, a response that does not stream puts the
partial reasoning in `content`. Its `thinking` is `undefined`, and its finish reason is
`length`. The gateway does not move text between the two fields.

### Structured output

`LlmBroker.generateObject`, and a `responseFormat` of `json_object` with a schema, send this
`response_format`:

```json
{ "type": "json_schema", "json_schema": { "name": "response", "schema": { } } }
```

If oMLX cannot compile a grammar for the schema, it adds instructions to the prompt instead. It
reports this in a `Warning` response header. When the request asked for JSON (with or without a
schema) and the response has a `Warning` header, the gateway:

- puts the header value in `metadata.response_format_warning` (it joins several headers with
  `, `)
- logs a warning with `console.warn`

The gateway does not try the request again, and does not fail. You must validate the content.
The gateway ignores the header when the request asked for text, or for no format.

### Usage

`GatewayResponse.usage` holds the prompt, completion and total token counts that oMLX reported.
oMLX reports more fields, for example `model_load_duration`, `time_to_first_token` and
`generation_tokens_per_second`. The gateway keeps the full `usage` object, unchanged, in
`metadata.usage`. The gateway never estimates usage.

### Streaming

The gateway supports `generateStreamEvents` (and `LlmBroker.generateStreamEvents`). The rules
are the same as for the OpenAI gateway. The request asks oMLX to report usage.
`reasoning_content` deltas make no events. The `metadata` of the completion evidence holds the
`usage` object that oMLX reported.

`generateStream` operates as it does for the OpenAI gateway. It does not send
`reasoning_content`. oMLX sends each tool call in one delta, and the gateway yields it as one
chunk.

oMLX starts each stream with a keep-alive frame, a `data:` frame whose `model` is `keepalive`.
It sends more of these frames during a long prompt evaluation. The gateway removes these frames
in the two streaming APIs. Thus `keepalive` is never the reported provider model.

### Models

```typescript
const models = await gateway.listModels(); // model ids, sorted
await gateway.loadModel('Qwen3.8-27B-MLX-8bit'); // Result<void, Error>
await gateway.unloadModel('Qwen3.8-27B-MLX-8bit'); // Result<void, Error>
```

- `loadModel` returns when the model is in memory. A chat request loads its model
  automatically, so use `loadModel` only to prepare a model before you use it.
- If you unload a model that is not loaded, oMLX returns HTTP 400. The gateway returns this as
  a `GatewayError`.
- oMLX downloads models only through its admin dashboard. The gateway has no pull operation.

### Embeddings

```typescript
const embedding = await gateway.calculateEmbeddings('some text', 'my-embedding-model');
```

You must give a model. oMLX has no default embedding model. If the model is missing or empty,
`calculateEmbeddings` throws a `ValidationError` and sends no request. The gateway sends the
text in one request, with no chunks and no tokenizer. A chat model returns HTTP 400, and the
gateway returns a `GatewayError`.

### Errors

- An HTTP error status gives a `GatewayError`. `statusCode` holds the status and `body` holds the
  response body, unchanged. The gateway does not parse the error message.
- A request that is longer than the timeout gives a `TimeoutError`.
- In `generateStreamEvents`, an HTTP error status gives a `provider_error` event. Its `detail`
  holds `{ status, body }`.

See `examples/omlx.ts` for one chat turn against a local server.

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
