---
layout: home

hero:
  name: Mojentic
  text: Modern LLM Integration for TypeScript
  tagline: Type-safe, elegant framework for building AI-powered applications
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/svetzal/mojentic-ts

features:
  - icon: 🔌
    title: Multi-Provider Support
    details: Works with Ollama, OpenAI, and Anthropic. Switch providers with a single line of code.

  - icon: 🛠️
    title: Tool System
    details: Extensible function calling lets LLMs interact with your code and APIs seamlessly.

  - icon: 📊
    title: Structured Output
    details: Type-safe response parsing with JSON schemas. Get validated TypeScript objects from LLMs.

  - icon: 🌊
    title: Streaming Support
    details: Real-time streaming completions for responsive user experiences.

  - icon: 🔒
    title: Type-Safe
    details: Full TypeScript support with comprehensive type definitions and IntelliSense.

  - icon: 🎯
    title: Result Pattern
    details: Rust-inspired error handling for robust, predictable code.
---

## Quick Example

```typescript
import { LlmBroker, OllamaGateway, Message, isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const messages = [Message.user('What is TypeScript?')];
const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value);
}
```

## Perfect For

- 🔧 **VS Code Extensions** - Build AI-powered editor features
- 📝 **Obsidian Plugins** - Create intelligent note-taking tools
- 🌐 **Web Applications** - Add AI capabilities to Node.js apps
- 🤖 **CLI Tools** - Build intelligent command-line utilities
