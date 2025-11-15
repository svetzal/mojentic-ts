# Agent Delegation

Agent delegation is a powerful pattern that allows you to build hierarchical agent systems where coordinator agents delegate tasks to specialist agents. This is implemented using the `ToolWrapper` class, which wraps agents as tools.

## Overview

The agent delegation pattern enables:

- **Hierarchical agent architectures**: Coordinator agents manage multiple specialist agents
- **Domain expertise**: Each specialist agent can focus on a specific domain with its own tools
- **Composability**: Agents can be nested and combined in flexible ways
- **Modularity**: Easy to add, remove, or replace specialist agents

## Core Components

### Agent

The `Agent` class combines an LLM broker, tools, and behavior into a cohesive unit:

```typescript
import { Agent, LlmBroker, OllamaGateway, DateResolverTool } from 'mojentic';

const agent = new Agent(
  new LlmBroker('qwen3:32b', new OllamaGateway()),
  [new DateResolverTool()],
  'You are a helpful assistant that can resolve dates.'
);

const result = await agent.generate('What day is next Friday?');
```

### ToolWrapper

The `ToolWrapper` class wraps an agent as a tool, making it callable by other agents:

```typescript
import { ToolWrapper } from 'mojentic';

const wrappedAgent = new ToolWrapper(
  agent,
  'date_specialist',
  'A specialist in date and time queries.'
);
```

The wrapped agent becomes a tool with a single `input` parameter that accepts string instructions.

## Basic Example

Here's a simple example of a coordinator using a specialist:

```typescript
import {
  Agent,
  LlmBroker,
  OllamaGateway,
  ToolWrapper,
  DateResolverTool,
} from 'mojentic';

// Create a temporal specialist
const temporalSpecialist = new Agent(
  new LlmBroker('qwen3:7b', new OllamaGateway()),
  [new DateResolverTool()],
  'You are a temporal specialist with expertise in dates and time.'
);

// Create a coordinator that uses the specialist
const coordinator = new Agent(
  new LlmBroker('qwen3:32b', new OllamaGateway()),
  [
    new ToolWrapper(
      temporalSpecialist,
      'temporal_specialist',
      'Expert in date and time queries. Use for questions about dates, calendars, and temporal references.'
    ),
  ],
  `You are an intelligent coordinator that delegates tasks to specialist agents.
When users ask about dates or time, use the temporal_specialist tool.`
);

// Use the coordinator
const result = await coordinator.generate('What day of the week is next Friday?');
```

## Advanced Example: Multiple Specialists

You can create coordinators with multiple specialists:

```typescript
// Create specialists
const temporalSpecialist = new Agent(
  new LlmBroker('qwen3:7b', gateway),
  [new DateResolverTool(), new CurrentDatetimeTool()],
  'You are a temporal specialist...'
);

const knowledgeSpecialist = new Agent(
  new LlmBroker('qwen3:7b', gateway),
  [],
  'You are a general knowledge expert...'
);

// Create coordinator with multiple specialists
const coordinator = new Agent(
  new LlmBroker('qwen3:32b', gateway),
  [
    new ToolWrapper(
      temporalSpecialist,
      'temporal_specialist',
      'Specialist in dates and time'
    ),
    new ToolWrapper(
      knowledgeSpecialist,
      'knowledge_specialist',
      'General knowledge expert'
    ),
  ],
  `You are a coordinator. Analyze requests and delegate to appropriate specialists:
- temporal_specialist: For date/time queries
- knowledge_specialist: For general knowledge questions`
);

// The coordinator can now handle diverse queries
const result1 = await coordinator.generate('What day is tomorrow?');
const result2 = await coordinator.generate('What is TypeScript?');
const result3 = await coordinator.generate(
  'What day is tomorrow and what year did World War II end?'
);
```

## How It Works

1. **User sends query to coordinator**: The coordinator agent receives the user's input
2. **Coordinator analyzes**: The coordinator's LLM analyzes which specialist(s) to use
3. **Tool calls generated**: The LLM generates tool calls for the appropriate specialists
4. **Specialist execution**: Each wrapped agent:
   - Receives input through its `run()` method
   - Creates initial messages from its behavior
   - Appends the input as a user message
   - Calls its broker with its own tools
   - Returns the response
5. **Response synthesis**: The coordinator synthesizes specialist responses into a final answer

## Message Flow

When a specialist agent is called through ToolWrapper:

```
User Query → Coordinator Agent
             ↓
             Coordinator LLM analyzes query
             ↓
             Tool call: temporal_specialist("What day is next Friday?")
             ↓
             ToolWrapper.run({ input: "What day is next Friday?" })
             ↓
             Creates messages:
             [
               { role: "system", content: "You are a temporal specialist..." },
               { role: "user", content: "What day is next Friday?" }
             ]
             ↓
             Calls specialist's broker.generate(messages, specialist's tools)
             ↓
             Specialist may use its own tools (DateResolverTool)
             ↓
             Returns response to coordinator
             ↓
             Coordinator synthesizes final response
```

## Best Practices

### 1. Clear Specialist Descriptions

Provide clear, specific descriptions for wrapped agents:

```typescript
new ToolWrapper(
  agent,
  'temporal_specialist',
  'Expert in date and time queries. Use for: relative dates (tomorrow, next Friday), current time, date calculations, and calendrical questions.'
);
```

### 2. Appropriate Model Selection

Use smaller, faster models for specialists and larger models for coordinators:

```typescript
// Smaller model for specialist tasks
const specialist = new Agent(new LlmBroker('qwen3:7b', gateway), tools, behavior);

// Larger model for coordination and synthesis
const coordinator = new Agent(
  new LlmBroker('qwen3:32b', gateway),
  wrappedSpecialists,
  coordinatorBehavior
);
```

### 3. Focused Specialist Behaviors

Give each specialist a focused, clear role:

```typescript
const specialist = new Agent(
  broker,
  [new DateResolverTool()],
  `You are a temporal specialist with deep knowledge of dates and time.
Your expertise includes:
- Resolving relative date references
- Providing current date and time information
- Calculating date differences
Always be precise and provide complete information.`
);
```

### 4. Clear Coordinator Instructions

Help the coordinator understand when to use each specialist:

```typescript
const coordinator = new Agent(
  broker,
  specialists,
  `You are an intelligent coordinator that delegates tasks to specialist agents.

Available specialists:
- temporal_specialist: For date/time queries
- knowledge_specialist: For general knowledge questions
- calculation_specialist: For mathematical computations

Analyze the user's request and delegate to the appropriate specialist(s).
You can call multiple specialists if needed.`
);
```

## Nested Delegation

Specialists can themselves be coordinators, creating multi-level hierarchies:

```typescript
// Sub-specialist
const dateSpecialist = new Agent(broker, [new DateResolverTool()], 'Date expert');

// Mid-level coordinator
const temporalCoordinator = new Agent(
  broker,
  [new ToolWrapper(dateSpecialist, 'date_specialist', 'Date calculations')],
  'Temporal coordinator'
);

// Top-level coordinator
const mainCoordinator = new Agent(
  broker,
  [
    new ToolWrapper(temporalCoordinator, 'temporal_coordinator', 'All temporal queries'),
    // ... other specialists
  ],
  'Main coordinator'
);
```

## Complete Example

See [examples/broker_as_tool.ts](https://github.com/svetzal/mojentic-ts/blob/main/examples/broker_as_tool.ts) for a complete, runnable example demonstrating:

- Creating specialist agents with specific tools
- Wrapping specialists as tools
- Building a coordinator agent
- Handling various types of queries
- Multi-specialist coordination

## Performance Considerations

- **Latency**: Each delegation adds an LLM call, so use judiciously
- **Cost**: Multiple LLM calls increase costs
- **Token usage**: Coordinator prompts and specialist behaviors add to token counts
- **Optimization**: Cache specialist responses when appropriate

## Error Handling

ToolWrapper handles errors gracefully:

```typescript
// Missing input parameter
const result = await wrappedAgent.run({});
// Returns: { error: 'input is required' }

// Broker errors are propagated
if (!result.ok) {
  console.error('Specialist failed:', result.error.message);
}
```

## API Reference

### Agent

```typescript
class Agent {
  constructor(
    broker: LlmBroker,
    tools?: LlmTool[],
    behavior?: string
  );

  generate(input: string): Promise<Result<string, Error>>;
  createInitialMessages(): LlmMessage[];
  getBroker(): LlmBroker;
  getTools(): LlmTool[];
  getBehavior(): string;
}
```

### ToolWrapper

```typescript
class ToolWrapper extends BaseTool {
  constructor(
    agent: Agent,
    toolName: string,
    toolDescription: string
  );

  run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  descriptor(): ToolDescriptor;
  name(): string;
}
```

## See Also

- [Tool Usage](./tool-usage.md) - General tool system documentation
- [Broker](./broker.md) - LLM broker documentation
- [API Reference](./api/tools.md) - Tool API documentation
