# Simple Recursive Agent

The `SimpleRecursiveAgent` provides a declarative, event-driven approach to iterative problem-solving with LLMs. It automatically handles retries, tool execution, and state management while giving you visibility into each step through events.

## Overview

The SimpleRecursiveAgent:
- Solves problems through iterative refinement
- Emits events at each step for monitoring and debugging
- Handles tool execution automatically
- Stops when it finds a solution, fails, or reaches max iterations
- Provides timeout protection (300 seconds default)

## Basic Usage

```typescript
import { SimpleRecursiveAgent } from 'mojentic';
import { LlmBroker } from 'mojentic';
import { OllamaGateway } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Create agent with 5 max iterations
const agent = new SimpleRecursiveAgent(broker, [], 5);

// Solve a problem
const solution = await agent.solve('What is the capital of France?');
console.log(solution);

// Clean up
agent.dispose();
```

## With Tools

The agent can use tools to gather information or perform actions:

```typescript
import { DateResolverTool } from 'mojentic';

const agent = new SimpleRecursiveAgent(
  broker,
  [new DateResolverTool()], // Tools available to the agent
  5  // Max iterations
);

const solution = await agent.solve("What's the date next Friday?");
```

## Event Monitoring

Subscribe to events to monitor the problem-solving process:

```typescript
import {
  SimpleRecursiveAgent,
  GoalSubmittedEvent,
  IterationCompletedEvent,
  GoalAchievedEvent,
  GoalFailedEvent,
  TimeoutEvent
} from 'mojentic';

const agent = new SimpleRecursiveAgent(broker, [], 5);

// Monitor each iteration
agent.emitter.subscribe('iteration-completed', (event: IterationCompletedEvent) => {
  console.log(`Iteration ${event.state.iteration}:`);
  console.log(`Response: ${event.response}`);
});

// Know when the goal is achieved
agent.emitter.subscribe('goal-achieved', (event: GoalAchievedEvent) => {
  console.log(`Success after ${event.state.iteration} iterations!`);
});

// Handle failures
agent.emitter.subscribe('goal-failed', (event: GoalFailedEvent) => {
  console.error(`Failed: ${event.state.solution}`);
});

const solution = await agent.solve('Complex problem');
```

## Custom System Prompt

Customize the agent's behavior with a custom system prompt:

```typescript
const customPrompt =
  'You are a concise assistant that provides brief, factual answers. ' +
  'Always respond in exactly one sentence.';

const agent = new SimpleRecursiveAgent(
  broker,
  [],
  5,
  customPrompt
);
```

## Event Types

### GoalState

The state object that tracks the problem-solving process:

```typescript
interface GoalState {
  goal: string;           // The problem to solve
  iteration: number;      // Current iteration count
  maxIterations: number;  // Maximum allowed iterations
  solution: string | null; // The solution, if found
  isComplete: boolean;    // Whether solving is complete
}
```

### Event Types

All events contain a `state: GoalState` property:

- **GoalSubmittedEvent**: Emitted when a problem is submitted
- **IterationCompletedEvent**: Emitted after each iteration (includes `response: string`)
- **GoalAchievedEvent**: Emitted when the goal is successfully solved
- **GoalFailedEvent**: Emitted when the goal cannot be solved
- **TimeoutEvent**: Emitted if solving exceeds 300 seconds

## Concurrent Problem Solving

You can create multiple agents or reuse one agent to solve problems concurrently:

```typescript
const agent = new SimpleRecursiveAgent(broker, [], 3);

const problems = [
  'What is the Pythagorean theorem?',
  'Explain recursion in programming.'
];

// Solve all problems concurrently
const solutions = await Promise.all(
  problems.map(problem => agent.solve(problem))
);

solutions.forEach((solution, i) => {
  console.log(`Problem ${i + 1}: ${solution}`);
});

agent.dispose();
```

## Completion Criteria

The agent stops iterating when:

1. **Success**: The LLM response contains "DONE" (case-insensitive)
2. **Failure**: The LLM response contains "FAIL" (case-insensitive)
3. **Max Iterations**: The iteration count reaches `maxIterations`
4. **Timeout**: 300 seconds have elapsed

When stopped at max iterations, the last response is returned as the best available solution.

## API Reference

### Constructor

```typescript
constructor(
  llm: LlmBroker,
  availableTools?: LlmTool[],
  maxIterations?: number,
  systemPrompt?: string
)
```

**Parameters:**
- `llm`: The LLM broker to use for generating responses
- `availableTools`: Array of tools the agent can use (default: `[]`)
- `maxIterations`: Maximum number of iterations (default: `5`)
- `systemPrompt`: Custom system prompt (default: problem-solving assistant prompt)

### Methods

#### solve(problem: string): Promise<string>

Solve a problem asynchronously.

**Parameters:**
- `problem`: The problem to solve

**Returns:** Promise that resolves to the solution string

**Throws:** `TimeoutError` if the solution cannot be found within 300 seconds

#### dispose(): void

Clean up resources (disposes the internal ChatSession).

### Properties

#### emitter: EventEmitter

The event emitter for subscribing to agent events.

**Methods:**
- `subscribe<T>(eventType, callback): UnsubscribeFn` - Subscribe to an event type
- `emit(event)` - Emit an event (called internally by the agent)

## Best Practices

1. **Always dispose**: Call `dispose()` when done to free resources:
   ```typescript
   try {
     const solution = await agent.solve(problem);
   } finally {
     agent.dispose();
   }
   ```

2. **Set appropriate max iterations**: Balance between thoroughness and performance:
   - Simple queries: 3-5 iterations
   - Complex problems: 10-20 iterations

3. **Use event monitoring for debugging**: Subscribe to events during development to understand the agent's reasoning process

4. **Provide clear problem statements**: The more specific your problem description, the better the agent can solve it

5. **Guide with system prompts**: Use custom system prompts to shape the agent's approach to problem-solving

## Example: Complete Workflow

```typescript
import {
  SimpleRecursiveAgent,
  LlmBroker,
  OllamaGateway,
  DateResolverTool,
  IterationCompletedEvent,
  GoalAchievedEvent
} from 'mojentic';

async function solveProblem() {
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  const agent = new SimpleRecursiveAgent(
    broker,
    [new DateResolverTool()],
    5
  );

  // Log progress
  agent.emitter.subscribe('iteration-completed', (event: IterationCompletedEvent) => {
    console.log(`Iteration ${event.state.iteration}/${event.state.maxIterations}`);
  });

  agent.emitter.subscribe('goal-achieved', (event: GoalAchievedEvent) => {
    console.log(`✓ Solved in ${event.state.iteration} iterations`);
  });

  try {
    const solution = await agent.solve(
      "What's the date two Fridays from now?"
    );
    console.log('\nSolution:', solution);
  } finally {
    agent.dispose();
  }
}

solveProblem().catch(console.error);
```

## Comparison with IterativeProblemSolver

Both agents solve problems iteratively, but they differ in approach:

**SimpleRecursiveAgent:**
- Event-driven architecture
- Explicit event types for each stage
- Manual event subscription for monitoring
- 300-second hard timeout
- Best for: Custom event handling, complex workflows, debugging

**IterativeProblemSolver:**
- Simpler API, minimal boilerplate
- Direct access to chat history
- Best for: Quick prototyping, straightforward tasks

Choose `SimpleRecursiveAgent` when you need fine-grained control and visibility into the problem-solving process. Choose `IterativeProblemSolver` for simpler use cases.
