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
