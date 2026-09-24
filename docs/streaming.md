# Streaming Responses

Streaming allows you to receive LLM responses chunk-by-chunk as they are generated, improving perceived latency for users.

## Basic Streaming

Use `broker.generateStream` to get an async generator of chunks:

```typescript
import { LlmBroker, OllamaGateway, Message, isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const messages = [Message.user("Tell me a story.")];

for await (const result of broker.generateStream(messages)) {
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

## Streaming with Tools

Mojentic supports streaming even when tools are involved. The broker will pause streaming to execute tools and then resume streaming the final response.

```typescript
import { DateResolverTool } from 'mojentic';

const tools = [new DateResolverTool()];

for await (const result of broker.generateStream(messages, { tools })) {
  // The stream will contain text chunks.
  // Tool execution happens transparently in the background.
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

## Structured output in streaming requests

Set `responseFormat` on the `CompletionConfig` to request a response format in a
streaming request. The gateways send the same field that they send for a
non-streaming request.

| `responseFormat` | OpenAI `response_format` | Ollama `format` |
| ---------------- | ------------------------ | --------------- |
| not set | not sent | not sent |
| `{ type: 'text' }` | `{ type: 'text' }` | not sent |
| `{ type: 'json_object' }` | `{ type: 'json_object' }` | `"json"` |
| `{ type: 'json_object', schema }` | `{ type: 'json_schema', json_schema: { name: 'response', schema } }` | the schema |

```typescript
const schema = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

for await (const result of broker.generateStream(messages, {
  responseFormat: { type: 'json_object', schema },
})) {
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

The request field records what you asked for. It does not prove that the
provider enforced it. Parse and validate the complete content before you use it.
