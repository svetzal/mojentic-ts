# Example: Web Search

The `WebSearchTool` demonstrates how to integrate external APIs into your agent's toolset. This example implementation supports multiple providers like Tavily and Serper.

## Configuration

The web search tool typically requires an API key for a search provider (e.g., Tavily, Serper).

```typescript
process.env.TAVILY_API_KEY = "your-api-key";
```

## Usage

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { WebSearchTool } from 'mojentic';

// Initialize broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Register the tool
const tools = [new WebSearchTool({ provider: 'tavily' })];

// Ask a question requiring up-to-date info
const messages = [
  Message.user("What is the current stock price of Apple?")
];

const result = await broker.generate(messages, tools);
```

## Supported Providers

- **Tavily**: Optimized for LLM agents
- **Serper**: Google Search API
- **DuckDuckGo**: Privacy-focused search (no API key required for basic usage)
