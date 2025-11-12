# Getting Started

This guide will help you get started with Mojentic in just a few minutes.

## Prerequisites

- Node.js 18.0 or higher
- A package manager (npm, yarn, or pnpm)
- Ollama installed (for local LLMs)

## Installation

::: code-group

```bash [npm]
npm install mojentic
```

```bash [yarn]
yarn add mojentic
```

```bash [pnpm]
pnpm add mojentic
```

:::

## Set Up Ollama

If you want to use local models with Ollama:

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model:
   ```bash
   ollama pull qwen3:32b
   ```
3. Verify it's running:
   ```bash
   ollama list
   ```

## Your First Program

Create a new file `hello-mojentic.ts`:

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { isOk } from 'mojentic';

async function main() {
  // Create a gateway for Ollama
  const gateway = new OllamaGateway();
  
  // Create a broker with the model and gateway
  const broker = new LlmBroker('qwen3:32b', gateway);
  
  // Create a message
  const messages = [
    Message.user('Explain TypeScript in one sentence.')
  ];
  
  // Generate a response
  const result = await broker.generate(messages);
  
  // Handle the result
  if (isOk(result)) {
    console.log('Response:', result.value);
  } else {
    console.error('Error:', result.error.message);
  }
}

main();
```

Run it:

```bash
npx ts-node hello-mojentic.ts
```

## Understanding the Code

Let's break down what's happening:

### 1. Create a Gateway

```typescript
const gateway = new OllamaGateway();
```

The gateway is responsible for communicating with the LLM provider. Each provider (Ollama, OpenAI, Anthropic) has its own gateway implementation.

### 2. Create a Broker

```typescript
const broker = new LlmBroker('qwen3:32b', gateway);
```

The broker is your main interface to the LLM. It handles message formatting, tool calling, and response processing.

### 3. Create Messages

```typescript
const messages = [Message.user('Explain TypeScript in one sentence.')];
```

Messages represent the conversation. The `Message` helper provides convenient methods for creating different message types.

### 4. Generate a Response

```typescript
const result = await broker.generate(messages);
```

The `generate()` method sends your messages to the LLM and returns a `Result` type.

### 5. Handle the Result

```typescript
if (isOk(result)) {
  console.log('Response:', result.value);
} else {
  console.error('Error:', result.error.message);
}
```

The `Result` type makes error handling explicit and type-safe. Use `isOk()` to check for success.

## Next Steps

Now that you have a working example, explore more features:

- [Structured Output](/guide/structured-output) - Get type-safe JSON from LLMs
- [Tool System](/guide/tools) - Let LLMs call your functions
- [Streaming](/guide/streaming) - Real-time response streaming
- [Error Handling](/guide/error-handling) - Robust error handling patterns

## Common Issues

### "Cannot find module 'mojentic'"

Make sure you've installed the package:
```bash
npm install mojentic
```

### "Ollama connection refused"

Ensure Ollama is running:
```bash
ollama serve
```

### TypeScript errors

Make sure you have TypeScript and Node types installed:
```bash
npm install -D typescript @types/node
```

## Getting Help

- 📚 Check the [API Reference](/api/broker)
- 💬 Open an issue on [GitHub](https://github.com/svetzal/mojentic-ts/issues)
- 📧 Email: stacey@mojility.com
