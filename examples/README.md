# Mojentic TypeScript Examples

This directory contains example scripts demonstrating various features of the Mojentic TypeScript library.

## Prerequisites

Before running these examples, ensure you have:

1. **Node.js installed** (version 18 or later)
2. **Ollama running locally** at `http://localhost:11434`
3. **At least one model pulled**, for example:
   ```bash
   ollama pull phi4:14b
   ollama pull qwen2.5:3b
   ```
4. **Dependencies installed**:
   ```bash
   npm install
   ```

## Available Examples

### Level 1: Basic LLM Usage

#### `simple_llm.ts`
Basic text generation with a local LLM model.
```bash
npm run example:simple
```

#### `list_models.ts`
List all available models from the Ollama gateway.
```bash
npm run example:list-models
```

#### `structured_output.ts`
Generate structured JSON output using a schema.
```bash
npm run example:structured
```

#### `tool_usage.ts`
Use tools (functions) that the LLM can call.
```bash
npm run example:tool
```

### Level 2: Advanced LLM Features

#### `broker_examples.ts`
Comprehensive demonstration of various broker features.
```bash
npm run example:broker
```

#### `streaming.ts`
Stream responses chunk-by-chunk with tool calling support.
```bash
npm run example:streaming
```

#### `chat_session.ts`
Interactive chat session maintaining conversation history.
```bash
npm run example:chat
```

#### `chat_session_with_tool.ts`
Chat session with access to tools.
```bash
npm run example:chat-tool
```

#### `image_analysis.ts`
Analyze images using vision-capable models.
```bash
npm run example:image
```

#### `embeddings.ts`
Generate vector embeddings for text.
```bash
npm run example:embeddings
```

#### `tokenizer_example.ts`
Token counting and management.
```bash
npm run example:tokenizer
```

### Level 3: Tool System Extensions

#### `file_tool.ts`
Demonstrates file operations using the FileTool.
```bash
npm run example:file-tool
```

#### `coding_file_tool.ts`
Advanced file operations for coding tasks.
```bash
npm run example:coding-tool
```

#### `broker_as_tool.ts`
Wrap agents as tools for delegation patterns.
```bash
npm run example:broker-as-tool
```

#### `ephemeral-task-manager.ts`
Task management using the TaskManager tool.
```bash
npm run example:task-manager
```

#### `tell-user.ts`
Demonstrates the TellUser tool for agent-to-user communication.
```bash
npm run example:tell-user
```

#### `web_search.ts`
Web search capabilities.
```bash
npm run example:web-search
```

### Level 4: Tracing & Observability

#### `tracer-demo.ts`
Demonstrates the event tracing system.
```bash
npm run example:tracer
```

### Level 5: Agent System Basics

#### `async-llm.ts`
Demonstrates asynchronous LLM agents.
```bash
npm run example:async-llm
```

### Level 6: Advanced Agent Patterns

#### `iterative-solver.ts`
Multi-step problem solving agent.
```bash
npm run example:iterative-solver
```

#### `recursive-agent.ts`
Self-recursive agent pattern.
```bash
npm run example:recursive-agent
```

#### `solver-chat-session.ts`
Interactive chat with a solver agent.
```bash
npm run example:solver-chat
```

### Level 7: Multi-Agent & Specialized

#### `react.ts`
Implementation of the ReAct (Reasoning + Acting) pattern.
```bash
npm run example:react
```

#### `working-memory.ts`
Shared working memory between agents.
```bash
npm run example:working-memory
```

## Configuration

You can customize behavior using environment variables:

- `OLLAMA_HOST` - Ollama server URL (default: `http://localhost:11434`)
- `OPENAI_API_KEY` - API key for OpenAI gateway

## Running Examples

All examples can be run via `npm run example:<name>`. See `package.json` for the full list of scripts.
