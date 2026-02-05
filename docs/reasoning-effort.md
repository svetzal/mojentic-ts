# Reasoning Effort Control

Mojentic supports reasoning effort control, allowing you to enable extended thinking capabilities in supported LLM models.

## Overview

The `reasoningEffort` field on `CompletionConfig` controls how much computational effort the model spends on reasoning before responding:

- **`'low'`**: Quick responses with minimal reasoning
- **`'medium'`**: Balanced reasoning effort
- **`'high'`**: Extended thinking for complex problems

## Usage

```typescript
import { LlmBroker, OllamaGateway, Message, isOk, CompletionConfig } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const config: CompletionConfig = {
  temperature: 0.3,
  reasoningEffort: 'high'
};

const messages = [Message.user('Explain quantum entanglement')];
const result = await broker.generate(messages, undefined, config);

if (isOk(result)) {
  console.log(result.value);
}
```

## Provider-Specific Behavior

### Ollama Gateway

When `reasoningEffort` is set (any value), Ollama receives the `think: true` parameter, enabling extended thinking mode. The model's internal reasoning trace is captured in the `thinking` field of the gateway response.

### OpenAI Gateway

For OpenAI reasoning models (o1, o3 series), the `reasoningEffort` value maps directly to the API's `reasoning_effort` parameter:

- `'low'` → `"low"`
- `'medium'` → `"medium"`
- `'high'` → `"high"`

For non-reasoning models (GPT-4, GPT-4.1), the parameter is ignored with a warning logged.

```typescript
import { OpenAIGateway } from 'mojentic';

const broker = new LlmBroker('o1-preview', new OpenAIGateway());

const config: CompletionConfig = {
  reasoningEffort: 'medium'
};

const result = await broker.generate(messages, undefined, config);
```

## Streaming with Reasoning Effort

Reasoning effort works with streaming:

```typescript
const config: CompletionConfig = {
  reasoningEffort: 'high'
};

for await (const result of broker.generateStream(messages, { config })) {
  if (isOk(result)) {
    process.stdout.write(result.value);
  }
}
```

## When to Use

**Use higher reasoning effort for:**
- Complex mathematical problems
- Multi-step logical reasoning
- Code generation requiring architectural decisions
- Tasks requiring careful consideration of trade-offs

**Use lower reasoning effort (or omit) for:**
- Simple factual questions
- Quick classifications
- Routine formatting tasks
- When response speed is critical

## Thinking Traces

When using Ollama with reasoning effort enabled, the model's thinking process is captured in the `thinking` field of `GatewayResponse`:

```typescript
// Access thinking traces at the gateway level
const response = await gateway.generate(model, messages, config);
if (response.thinking) {
  console.log('Model reasoning:', response.thinking);
}
```

## See Also

- [LLM Broker](broker.md)
- [Streaming](streaming.md)
- [Core Types API](api/core.md)
