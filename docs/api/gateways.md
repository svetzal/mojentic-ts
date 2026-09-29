# API Reference - Gateways

A gateway connects Mojentic to one LLM provider. Most code does not call a gateway directly.
You give the gateway to an `LlmBroker`, and the broker calls it. Call a gateway directly to get
the provider response without the broker, for example the finish reason or the token usage.

## LlmGateway Interface

```typescript
interface LlmGateway {
  generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>>;

  generateStream(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): AsyncGenerator<Result<StreamChunk, Error>>;

  generateStreamEvents?(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    signal?: AbortSignal
  ): AsyncGenerator<LlmStreamEvent>;

  listModels(): Promise<Result<string[], Error>>;

  calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>>;
}
```

All gateways implement this interface.

- The model is the first argument. The messages are the second argument.
- `tools` is an array of `ToolDescriptor`. The broker gets a descriptor from each `LlmTool`
  with `tool.descriptor()`. A gateway does not run tools. It returns the tool calls in the
  response.
- `generateStream` is an async generator. Do not `await` it. Use `for await` to read
  the items. Each item is a `Result`. An error in the stream is an `Err` item. The generator
  does not throw it.
- `generateStreamEvents` is optional. All three gateways in this package implement it. The
  broker uses it for `LlmBroker.generateStreamEvents`. Refer to
  [Streaming](../streaming.md#single-turn-streaming-with-terminal-completion-evidence).

## Available gateways

| Gateway | Provider | Constructor |
| ------- | -------- | ----------- |
| `OllamaGateway` | [Ollama](https://ollama.com/) | `new OllamaGateway(baseUrl?)` |
| `OpenAIGateway` | [OpenAI](https://platform.openai.com/) | `new OpenAIGateway(apiKey?, baseUrl?)` |
| `OMLXGateway` | [oMLX](https://github.com/jundot/omlx) | `new OMLXGateway(host?, apiKey?, timeout?)` |

This package has no gateway for other providers. To add a provider, write a class that
implements `LlmGateway`.

## OllamaGateway

Gateway for the [Ollama](https://ollama.com/) local LLM server.

### Configuration

```typescript
class OllamaGateway implements LlmGateway {
  constructor(baseUrl?: string);
}
```

| Parameter | Environment variable | Default |
| --------- | -------------------- | ------- |
| `baseUrl` | `OLLAMA_HOST` | `http://localhost:11434` |

The gateway uses the constructor value first, then the environment variable, then the default.

```typescript
import { OllamaGateway } from 'mojentic';

// OLLAMA_HOST, or the local server
const gateway = new OllamaGateway();

// A server on a different host
const remote = new OllamaGateway('http://192.168.1.100:11434');
```

### generate

```typescript
async generate(
  model: string,
  messages: LlmMessage[],
  config?: CompletionConfig,
  tools?: ToolDescriptor[]
): Promise<Result<GatewayResponse, Error>>
```

Get one full response.

```typescript
import { Message, isOk } from 'mojentic';

const messages = [Message.user('Hello!')];

const result = await gateway.generate('qwen3:32b', messages, {
  temperature: 0.8,
  maxTokens: 1000,
});

if (isOk(result)) {
  console.log(result.value.content);
  console.log('Finish reason:', result.value.finishReason);
  console.log('Tokens used:', result.value.usage?.totalTokens);
}
```

The response has these values from Ollama:

- `finishReason` is the `done_reason` of the response. If there is no `done_reason` and the
  response has `done: true`, the finish reason is `stop`.
- `thinking` is the `thinking` text of the message, when the model returns it.
- `model` is the model name that Ollama reports.

### generateStream

```typescript
async *generateStream(
  model: string,
  messages: LlmMessage[],
  config?: CompletionConfig,
  tools?: ToolDescriptor[]
): AsyncGenerator<Result<StreamChunk, Error>>
```

Get the response in chunks, as Ollama generates it. The gateway sets `stream: true` in the
request. You do not set `stream` in the configuration.

```typescript
import { isOk } from 'mojentic';

for await (const result of gateway.generateStream('qwen3:32b', messages)) {
  if (!isOk(result)) {
    console.error('Stream error:', result.error.message);
    break;
  }

  const chunk = result.value;
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
  if (chunk.done) {
    console.log('\n---Done---');
  }
}
```

The last chunk has `done: true` and the finish reason `stop`. The gateway sets `stop` on this
chunk for all replies, also for a reply that stopped at the token limit. To get the true finish
reason, use `generate` or `generateStreamEvents`.

If a line of the stream is not valid JSON, the gateway yields an `Err` item. Then it continues
with the next line.

### listModels

```typescript
async listModels(): Promise<Result<string[], Error>>
```

Get the names of the models that the server has.

```typescript
const result = await gateway.listModels();

if (isOk(result)) {
  result.value.forEach((model) => console.log(`  - ${model}`));
}
```

### calculateEmbeddings

```typescript
async calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>>
```

Get the embedding vector for the text. The default model is `nomic-embed-text`.

### pullModel

```typescript
async pullModel(modelName: string, onProgress?: PullProgressCallback): Promise<Result<void, Error>>
```

Download a model to the Ollama server. The gateway calls `onProgress` for each progress
message from Ollama.

```typescript
await gateway.pullModel('qwen3:32b', (progress) => {
  console.log(progress.status, progress.completed, progress.total);
});
```

### Request body

| `CompletionConfig` | Request body |
| ------------------ | ------------ |
| `temperature` | `options.temperature`, when set |
| `numPredict` | `options.num_predict`, when set |
| `maxTokens` | `options.num_predict`, when set and `numPredict` is not set |
| `topP`, `topK` | `options.top_p`, `options.top_k`, when set |
| `numCtx` | `options.num_ctx`, when set |
| `stop` | `options.stop`, when set |
| `responseFormat` of `json_object` | `format`. The schema, or `"json"` when there is no schema |
| `reasoningEffort` | `think: true`, for all values |
| `frequencyPenalty`, `presencePenalty` | Not sent |

Tools go in `tools`, in the Ollama format.

### Messages

- The gateway sends `tool_calls` of an assistant message to Ollama without changes. The
  `arguments` stay a JSON string.
- For a message with content items, the gateway joins the text items with a newline. It sends
  each image item in `images`. If the image URL is a data URI, the gateway sends the base64 part
  only.

### Errors

- An HTTP error status gives a `GatewayError`. `statusCode` holds the status. The message holds
  the response body.
- A connection failure gives a `GatewayError` with no `statusCode`. For example, this occurs
  when the Ollama server does not run.

## OpenAIGateway

Gateway for the [OpenAI](https://platform.openai.com/) chat completions API.

### Configuration

```typescript
class OpenAIGateway implements LlmGateway {
  constructor(apiKey?: string, baseUrl?: string);
}
```

| Parameter | Environment variable | Default |
| --------- | -------------------- | ------- |
| `apiKey` | `OPENAI_API_KEY` | none |
| `baseUrl` | `OPENAI_API_ENDPOINT` | `https://api.openai.com/v1` |

- The gateway uses the constructor value first, then the environment variable, then the
  default.
- The base URL includes `/v1`. The gateway adds the path, for example `/chat/completions`.
- The gateway sends `Authorization: Bearer <key>` with each request.

```typescript
import { LlmBroker, Message, OpenAIGateway } from 'mojentic';

const gateway = new OpenAIGateway(); // OPENAI_API_KEY, OPENAI_API_ENDPOINT
const broker = new LlmBroker('gpt-4o', gateway);
const result = await broker.generate([Message.user('Hello')]);
```

Do not use `OpenAIGateway` for oMLX. Use `OMLXGateway`.

### Model registry

The gateway finds the capabilities of the model in the
[OpenAI model registry](./openai-model-registry.md). It changes the request to agree with them.
When it changes a value, it logs a warning with `console.warn`.

- For a reasoning model, the gateway sends `max_completion_tokens`, not `max_tokens`.
- If the model does not accept a temperature, the gateway removes it. If the model accepts only
  some temperatures, the gateway sends `1.0` in place of a value that the model does not accept.
- The gateway sends `reasoning_effort` only for a reasoning model. For other models, it ignores
  `reasoningEffort`.
- If the model does not support tools, the gateway removes the tools.
- If the registry does not know the model, it finds the capabilities from the model name. If
  no name pattern agrees, it uses the capabilities of a chat model.

### Request body

| `CompletionConfig` | Request body |
| ------------------ | ------------ |
| `temperature` | `temperature` (default `1.0`), changed by the model registry |
| `maxTokens` | `max_tokens` or `max_completion_tokens` (default `16384`) |
| `reasoningEffort` | `reasoning_effort`, for a reasoning model only |
| `responseFormat` | `response_format`. With a schema, `{ type: 'json_schema', json_schema: { name: 'response', schema } }` |
| `topP`, `topK`, `numCtx`, `numPredict`, `stop` | Not sent |
| `frequencyPenalty`, `presencePenalty` | Not sent |

Tools go in `tools`, in the OpenAI format.

### Messages

The OpenAI message adapter changes each message as follows:

- A system message with string content goes to OpenAI without changes. A system message with
  content items goes with empty content.
- A user message with no image items goes as one string. The adapter joins the text items with
  a newline.
- A user message with image items goes as a list of `text` and `image_url` content parts, in
  the order that you give them. A data URI or an `http(s)` URL goes without changes. The
  adapter reads all other image values as paths to local files and changes each file into a
  base64 data URI. If the adapter cannot read a file, it writes an error to the console. It
  does not send that image. Refer to [Image Analysis](../image-analysis.md#gateway-support).
- An assistant message goes with its text and its `tool_calls`. The `arguments` stay a JSON
  string. If a tool call has no `id`, the adapter sends an empty `id`.
- A tool message goes with its string content and its `tool_call_id`. A tool message with
  content items goes with empty content. If the message has no `tool_call_id`, the
  adapter does not send it.
- For a message with an unknown role, the adapter writes an error to the console. It does not
  send that message.

### Response

- `usage` holds the token counts that OpenAI reported.
- `metadata` holds the response `id`, `created` and, when present, `system_fingerprint`.
- `thinking` is always `undefined`.

### Streaming

`generateStream` yields each content delta as one chunk. The gateway collects the tool call
deltas. It yields the full tool calls in one chunk, with `done: true` and the finish reason
`tool_calls`. For other finish reasons, the last chunk has `done: true` and the finish reason
from OpenAI.

If the model registry says that the model does not support streaming, `generateStream` yields
one `Err` item and sends no request.

`generateStreamEvents` asks OpenAI to report usage. The completion evidence holds that usage.

### Models and embeddings

- `listModels` returns the model ids, sorted.
- `calculateEmbeddings` uses `text-embedding-3-large` as the default model. The gateway divides
  a long text into parts of 8191 tokens or fewer. It sends one request for each part. When there
  is more than one part, it returns the mean of the vectors, normalized to length 1.

### Errors

- An HTTP error status gives a `GatewayError`. `statusCode` holds the status. The message holds
  the response body.
- A connection failure gives a `GatewayError` with no `statusCode`.

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

### Messages

`OMLXGateway` uses the OpenAI message adapter. It changes messages as `OpenAIGateway` does.
Refer to [OpenAIGateway Messages](#messages-1).

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

## Stream chunks

```typescript
interface StreamChunk {
  content?: string;          // Text in this chunk, when there is text
  toolCalls?: ToolCall[];    // Tool calls, in a chunk that has done: true
  finishReason?: FinishReason;
  done: boolean;             // True for the last chunk
}
```

A chunk can have no `content`. Examine `content` before you use it. The broker does not give
chunks to you. `LlmBroker.generateStream` yields the text only, as `Result<string, Error>`.

## Errors

A gateway returns errors as `Err` values. It does not throw them.

```typescript
import { GatewayError, isErr } from 'mojentic';

const result = await gateway.generate('qwen3:32b', messages);

if (isErr(result)) {
  const error = result.error;

  if (error instanceof GatewayError && error.statusCode === 404) {
    console.error('Model not found. Install it with: ollama pull qwen3:32b');
  } else if (error instanceof GatewayError && error.statusCode === undefined) {
    console.error('No HTTP response. Is the server running?', error.message);
  } else {
    console.error('Gateway error:', error.message);
  }
}
```

## Example

```typescript
import { OllamaGateway, Message, isOk, isErr, GatewayError } from 'mojentic';

const gateway = new OllamaGateway();
const modelId = 'qwen3:32b';

// Make sure that the server runs and has the model
const modelsResult = await gateway.listModels();
if (isErr(modelsResult)) {
  console.error('Cannot connect to the Ollama server');
  process.exit(1);
}
if (!modelsResult.value.includes(modelId)) {
  console.error(`Model ${modelId} not found. Install it with: ollama pull ${modelId}`);
  process.exit(1);
}

const messages = [
  Message.system('You are a helpful assistant'),
  Message.user('Explain async/await in TypeScript'),
];

const result = await gateway.generate(modelId, messages, {
  temperature: 0.7,
  maxTokens: 1000,
});

if (isOk(result)) {
  const response = result.value;
  console.log('Response:', response.content);
  console.log('Finish reason:', response.finishReason);
  console.log('Prompt tokens:', response.usage?.promptTokens);
  console.log('Completion tokens:', response.usage?.completionTokens);
  console.log('Total tokens:', response.usage?.totalTokens);
} else if (result.error instanceof GatewayError) {
  console.error('Gateway error:', result.error.message);
  console.error('Status:', result.error.statusCode);
} else {
  console.error('Error:', result.error.message);
}
```

## See Also

- [Getting Started](/getting-started)
- [Broker API](/api/broker)
- [Core API](/api/core)
- [OpenAI Model Registry](/api/openai-model-registry)
- [Streaming Guide](/streaming)
