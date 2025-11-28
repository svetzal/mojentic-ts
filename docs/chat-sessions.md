# Chat Sessions

`ChatSession` manages the state of a conversation, handling message history, context window limits, and system prompts.

## Creating a Session

```typescript
import { ChatSession, LlmBroker, OllamaGateway } from 'mojentic';

// Initialize broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Start a session
const session = new ChatSession(broker, {
  systemPrompt: "You are a helpful assistant."
});
```

## Interacting

```typescript
// Send a message
const response = await session.sendMessage("Hello!");
console.log(response);

// Send another message (history is preserved)
const response2 = await session.sendMessage("What was my last message?");
console.log(response2);
```

## Context Management

The ChatSession automatically manages the context window. When the history exceeds the model's token limit, older messages are summarized or truncated based on the configured strategy.

## Using Tools

You can register tools with a chat session, making them available for all interactions:

```typescript
import { DateResolverTool } from 'mojentic';

const session = new ChatSession(broker, {
  tools: [new DateResolverTool()]
});
```
