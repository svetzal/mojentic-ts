# Working Memory Pattern

The working memory pattern enables agents to maintain and share context across multiple interactions. This guide shows how to use `SharedWorkingMemory` and build memory-aware agents in TypeScript.

## Overview

Working memory provides:
- **Shared Context**: Multiple agents can read from and write to the same memory
- **Continuous Learning**: Agents automatically learn and remember new information
- **State Persistence**: Knowledge is maintained across interactions
- **Type Safety**: Strongly typed with TypeScript interfaces

## Quick Start

### Basic Usage

```typescript
import { SharedWorkingMemory } from 'mojentic/context';

// Create memory with initial data
const memory = new SharedWorkingMemory({
  User: {
    name: 'Alice',
    age: 30
  }
});

// Retrieve current state
const current = memory.getWorkingMemory();

// Update memory (deep merge)
memory.mergeToWorkingMemory({
  User: {
    city: 'NYC',
    preferences: {
      theme: 'dark'
    }
  }
});

// Result: {User: {name: 'Alice', age: 30, city: 'NYC', preferences: {...}}}
```

### Memory-Aware Agent

```typescript
import { LlmBroker } from 'mojentic';
import { OllamaGateway } from 'mojentic/gateways';
import { AsyncLlmAgentWithMemory } from 'mojentic/agents';
import { SharedWorkingMemory } from 'mojentic/context';

// Initialize
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen2.5:7b', gateway);
const memory = new SharedWorkingMemory({
  User: { name: 'Alice' }
});

// Create agent
const agent = new AsyncLlmAgentWithMemory({
  broker,
  memory,
  behaviour: 'You are a helpful assistant who remembers things.',
  instructions: 'Answer questions and remember any new information.',
  responseModel: {
    type: 'object',
    required: ['answer'],
    properties: {
      answer: { type: 'string' }
    }
  }
});

// Generate response with memory context
const result = await agent.generateResponseWithMemory<{ answer: string }>(
  'I love pizza and my favorite color is blue'
);

if (isOk(result)) {
  console.log(result.value.answer);
  // Memory automatically updated with learned preferences
}
```

## Core Concepts

### SharedWorkingMemory

A simple, mutable key-value store that agents use to share context:

```typescript
class SharedWorkingMemory {
  constructor(initial?: Record<string, unknown>)

  getWorkingMemory(): Record<string, unknown>

  mergeToWorkingMemory(updates: Record<string, unknown>): void
}
```

**Key features:**
- **Simple API**: Just 3 methods to learn
- **Deep Merge**: Nested objects are recursively merged
- **Type-Safe**: Full TypeScript support

### AsyncLlmAgentWithMemory

An LLM agent that automatically includes memory in its context:

```typescript
const agent = new AsyncLlmAgentWithMemory({
  broker: broker,              // LLM broker for generation
  memory: memory,              // SharedWorkingMemory instance
  behaviour: '...',            // System-level instructions
  instructions: '...',         // Task-specific instructions
  responseModel: {...}         // JSON schema for responses
});
```

**How it works:**
1. Memory is automatically injected into the prompt
2. Response model is extended with a `memory` field
3. Agent can update memory as part of its response
4. Updated memory is available after generation

## Deep Merge Behavior

Memory updates use deep merge to preserve existing data:

```typescript
// Initial memory
const memory = new SharedWorkingMemory({
  User: {
    name: 'Alice',
    age: 30,
    address: {
      city: 'NYC',
      state: 'NY'
    }
  }
});

// Update with nested data
memory.mergeToWorkingMemory({
  User: {
    age: 31,
    address: {
      zip: '10001'
    }
  }
});

// Result: All fields preserved, nested objects merged
// {
//   User: {
//     name: 'Alice',      // Preserved
//     age: 31,            // Updated
//     address: {
//       city: 'NYC',      // Preserved
//       state: 'NY',      // Preserved
//       zip: '10001'      // Added
//     }
//   }
// }
```

## Building Custom Memory-Aware Agents

You can build your own agents using the memory pattern:

```typescript
import { AsyncLlmAgentWithMemory, Event } from 'mojentic/agents';
import { SharedWorkingMemory } from 'mojentic/context';
import { Result, Ok, Err, isOk } from 'mojentic/error';

interface ResearchEvent extends Event {
  type: 'ResearchEvent';
  topic: string;
}

interface ResearchResponse {
  findings: string;
}

class ResearchAgent extends AsyncLlmAgentWithMemory {
  constructor(broker: LlmBroker, memory: SharedWorkingMemory) {
    super({
      broker,
      memory,
      behaviour: 'You are a research assistant.',
      instructions: 'Research topics and maintain organized notes.',
      responseModel: {
        type: 'object',
        required: ['findings'],
        properties: {
          findings: { type: 'string' }
        }
      }
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type === 'ResearchEvent') {
      const researchEvent = event as ResearchEvent;

      const result = await this.generateResponseWithMemory<ResearchResponse>(
        `Research: ${researchEvent.topic}`
      );

      if (isOk(result)) {
        return Ok([{
          type: 'ResearchComplete',
          source: 'ResearchAgent',
          correlationId: event.correlationId,
          findings: result.value.findings
        }]);
      }

      return result as Result<Event[], Error>;
    }

    return Ok([]);
  }
}
```

## Multi-Agent Coordination

Multiple agents can share the same memory instance:

```typescript
// Shared memory
const memory = new SharedWorkingMemory({
  context: {}
});

// Multiple agents
const researcher = new AsyncLlmAgentWithMemory({
  broker,
  memory,
  behaviour: 'You are a research assistant.',
  instructions: 'Research topics thoroughly.',
  responseModel: researchSchema
});

const writer = new AsyncLlmAgentWithMemory({
  broker,
  memory,
  behaviour: 'You are a technical writer.',
  instructions: 'Write clear documentation from research.',
  responseModel: writingSchema
});

// Researcher updates memory
const researchResult = await researcher.generateResponseWithMemory(
  'Research TypeScript async patterns'
);

// Writer uses updated memory (already shared)
const articleResult = await writer.generateResponseWithMemory(
  'Write an article about what you learned'
);
```

## Use Cases

### 1. Conversational Chatbots

```typescript
const memory = new SharedWorkingMemory({
  conversation_history: [],
  user_preferences: {}
});
```

### 2. Workflow Automation

```typescript
const memory = new SharedWorkingMemory({
  workflow_state: 'started',
  completed_steps: [],
  pending_tasks: []
});
```

### 3. Knowledge Base Building

```typescript
const memory = new SharedWorkingMemory({
  entities: {},
  relationships: [],
  facts: []
});
```

### 4. Multi-Step Planning

```typescript
const memory = new SharedWorkingMemory({
  goals: [],
  current_plan: [],
  obstacles: []
});
```

## Best Practices

### 1. Structure Your Memory

Use clear, hierarchical keys:

```typescript
{
  User: {...},
  Conversation: {...},
  SystemState: {...}
}
```

### 2. Use Result Types

Handle errors with the Result pattern:

```typescript
const result = await agent.generateResponseWithMemory(input);

if (isOk(result)) {
  // Success path
  console.log(result.value);
} else {
  // Error path
  console.error(result.error);
}
```

### 3. Type Your Responses

Define interfaces for response models:

```typescript
interface UserResponse {
  answer: string;
  confidence: number;
}

const result = await agent.generateResponseWithMemory<UserResponse>(input);
```

### 4. Validate Memory Updates

Check memory quality:

```typescript
const result = await agent.generateResponseWithMemory(input);

if (isOk(result)) {
  const currentMemory = memory.getWorkingMemory();
  if (isValidMemoryState(currentMemory)) {
    // Proceed with valid memory
  } else {
    // Handle invalid state
  }
}
```

## Example Application

See the complete working memory example:

```bash
cd mojentic-ts
npx ts-node examples/working-memory.ts
```

The example demonstrates:
- Initializing memory with user data
- RequestAgent that learns from conversation
- Event-driven coordination with AsyncDispatcher
- Memory persistence across interactions

## API Reference

### SharedWorkingMemory

```typescript
class SharedWorkingMemory {
  /**
   * Create new memory with optional initial data
   */
  constructor(initial?: Record<string, unknown>);

  /**
   * Get current memory state as plain object
   */
  getWorkingMemory(): Record<string, unknown>;

  /**
   * Deep merge updates into memory
   */
  mergeToWorkingMemory(updates: Record<string, unknown>): void;
}
```

### AsyncLlmAgentWithMemory

```typescript
class AsyncLlmAgentWithMemory {
  /**
   * Create agent with memory support
   */
  constructor(config: AsyncLlmAgentWithMemoryConfig);

  /**
   * Generate response with memory context
   * @returns Result containing response and updated memory
   */
  async generateResponseWithMemory<T>(
    content: string
  ): Promise<Result<T, Error>>;
}
```

See `src/context/shared-working-memory.ts` and `src/agents/async-llm-agent-with-memory.ts` for full documentation.

## Testing

The library includes comprehensive tests for working memory:

```bash
npm test -- shared-working-memory.test.ts
npm test -- async-llm-agent-with-memory.test.ts
```

## Related Patterns

- **BaseAsyncAgent**: Simple async agents without memory
- **AsyncAggregatorAgent**: Aggregates events from multiple sources
- **AsyncDispatcher**: Coordinates event routing between agents

## Further Reading

- [Agent Patterns Guide](./async-agents.md)
- [Event System Guide](./async-agents.md#event-driven-architecture)
- [API Reference](./api/)
