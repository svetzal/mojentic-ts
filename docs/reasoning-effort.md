# Reasoning Effort Control

Mojentic supports reasoning effort control, allowing you to enable extended thinking capabilities in supported LLM models.

## Overview

The `reasoningEffort` field on `CompletionConfig` controls how much computational effort the model spends on reasoning before responding:

- **`'disabled'`**: Explicitly disable reasoning where supported
- **`'enabled'`**: Enable reasoning without selecting a named level
- **`'xhigh'`**: Select the provider's extra-high named level
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

Ollama sends `think: false` for `disabled`, `think: true` for `enabled`, and the exact string for `low`, `medium`, `high` or `xhigh`. Omission sends no `think` field. The model's internal reasoning trace is captured in the `thinking` field of the gateway response.

### OpenAI Gateway

For OpenAI reasoning models (o1, o3 series), the `reasoningEffort` value maps directly to the API's `reasoning_effort` parameter:

- `'low'` → `"low"`
- `'medium'` → `"medium"`
- `'high'` → `"high"`

For non-reasoning models, Low/Medium/High are ignored with a warning, preserving the existing model-registry behavior. Omission sends no effort field.

Under the 3.0.0 rule, `disabled`, `enabled` and `xhigh` return `Err(ValidationError)` with `field: 'reasoningEffort'` before HTTP dispatch on every model, including recovery-enabled requests. Legacy streams yield one error result; event streams yield one `request_failed` error with the `ValidationError` in `detail`. These controls are never silently omitted or rewritten on OpenAI. The different 3.1 mapping is outside this release.

```typescript
import { OpenAIGateway } from 'mojentic';

const broker = new LlmBroker('o1-preview', new OpenAIGateway());

const config: CompletionConfig = {
  reasoningEffort: 'medium'
};

const result = await broker.generate(messages, undefined, config);
```

### oMLX Gateway

oMLX sends top-level `enable_thinking: false` for `disabled` and `enable_thinking: true` for `enabled`. Named levels use top-level `reasoning_effort` with the exact string. Boolean controls send no named effort; named controls send no boolean. Omission sends neither field. These mappings apply to ordinary, structured and streaming requests, with recovery on or off. Provider/model support determines whether the request is accepted.

Caller-selected reasoning profiles, native assistant reasoning history and opt-in retention remain unimplemented. A returned thinking trace does not imply reasoning history is retained.


## Streaming with Reasoning Effort

Reasoning effort works with streaming:

```typescript
const config: CompletionConfig = {
  reasoningEffort: 'high'
};

for await (const result of broker.generateStream(messages, config)) {
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
if (isOk(response) && response.value.thinking) {
  console.log('Model reasoning:', response.value.thinking);
}
```

## See Also

- [LLM Broker](broker.md)
- [Streaming](streaming.md)
- [Core Types API](api/core.md)
