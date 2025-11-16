# Tracer System

The Tracer System provides comprehensive observability and debugging capabilities for your LLM applications. It records LLM calls, tool executions, and agent interactions, allowing you to trace the complete flow of requests through your system.

## Table of Contents

- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Quick Start](#quick-start)
- [Event Types](#event-types)
- [Correlation IDs](#correlation-ids)
- [Querying Events](#querying-events)
- [Integration](#integration)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

The Tracer System consists of four main components:

1. **TracerEvents**: Strongly-typed event classes that record specific interactions
2. **EventStore**: Storage and retrieval of tracer events
3. **TracerSystem**: High-level API for recording and querying events
4. **NullTracer**: Null object pattern for zero-overhead when tracing is disabled

## Core Concepts

### Events as Documentation

Every tracer event provides a `printableSummary()` method that creates human-readable output:

```typescript
const event = new LLMCallTracerEvent('gpt-4', [Message.user('Hello')], 0.7);
console.log(event.printableSummary());
// [14:23:45.123] LLMCallTracerEvent (correlation_id: abc-123)
//    Model: gpt-4
//    Messages: 1 message
//    Temperature: 0.7
```

### Correlation IDs

Correlation IDs link related events across your system:

```typescript
const correlationId = crypto.randomUUID();

// All events in this conversation share the same correlationId
tracer.recordLlmCall('gpt-4', messages, 0.7, tools, correlationId);
tracer.recordToolCall('resolve_date', args, result, 'broker', 25, correlationId);
tracer.recordLlmResponse('gpt-4', response, undefined, 150, correlationId);

// Later, find all events for this conversation
const conversationEvents = tracer.getEvents({
  filterFunc: (e) => e.correlationId === correlationId,
});
```

## Quick Start

### Basic Usage

```typescript
import { TracerSystem } from 'mojentic';

// Create a tracer system
const tracer = new TracerSystem();

// Record an LLM call
tracer.recordLlmCall('gpt-4', [Message.user('What is TypeScript?')], 0.7);

// Record the response
tracer.recordLlmResponse('gpt-4', 'TypeScript is a typed superset of JavaScript...', undefined, 150);

// Get all events
const events = tracer.getEvents();
console.log(`Recorded ${events.length} events`);

// Print event summaries
events.forEach((event) => {
  console.log(event.printableSummary());
});
```

### With LLM Broker

```typescript
import { LlmBroker, TracerSystem } from 'mojentic';
import { OllamaGateway } from 'mojentic/gateways';

const tracer = new TracerSystem();
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway, tracer);

// The broker automatically records LLM calls and responses
const result = await broker.generate([Message.user('Hello')]);

// Check what was recorded
const events = tracer.getEvents();
console.log(`Recorded ${events.length} events`);
```

### Disabling Tracing

Use the null tracer for zero overhead when tracing is not needed:

```typescript
import { nullTracer } from 'mojentic';

// All tracer methods are no-ops
const broker = new LlmBroker('gpt-4', gateway, nullTracer);
```

Or disable an existing tracer:

```typescript
tracer.disable();
// No events will be recorded

tracer.enable();
// Resume recording events
```

## Event Types

### LLMCallTracerEvent

Records when an LLM is called:

```typescript
tracer.recordLlmCall(
  'gpt-4',
  [Message.user('Hello')],
  0.7,
  [dateTool.descriptor()],
  correlationId
);
```

Captures:
- Model name
- Messages sent
- Temperature setting
- Available tools
- Correlation ID
- Timestamp

### LLMResponseTracerEvent

Records when an LLM responds:

```typescript
tracer.recordLlmResponse('gpt-4', 'Hello there!', toolCalls, 150.5, correlationId);
```

Captures:
- Model name
- Response content
- Tool calls made by LLM
- Call duration (ms)
- Correlation ID
- Timestamp

### ToolCallTracerEvent

Records when a tool is executed:

```typescript
tracer.recordToolCall(
  'resolve_date',
  { date_string: 'tomorrow' },
  { resolved: '2025-11-16' },
  'broker',
  25.3,
  correlationId
);
```

Captures:
- Tool name
- Arguments passed
- Result returned
- Caller identity
- Call duration (ms)
- Correlation ID
- Timestamp

### AgentInteractionTracerEvent

Records agent-to-agent communication:

```typescript
tracer.recordAgentInteraction(
  'coordinator',
  'specialist',
  'task_request',
  eventId,
  correlationId
);
```

Captures:
- Source agent
- Target agent
- Event type
- Event ID
- Correlation ID
- Timestamp

## Correlation IDs

Correlation IDs are the key to tracing requests through your system. Generate one ID per logical operation and pass it through all related calls:

```typescript
async function handleUserQuery(query: string) {
  const correlationId = crypto.randomUUID();

  console.log(`Starting conversation ${correlationId}`);

  const result = await broker.generate([Message.user(query)], tools, {
    correlationId,
  });

  // Find all events for this conversation
  const events = tracer.getEvents({
    filterFunc: (e) => e.correlationId === correlationId,
  });

  console.log(`\nConversation trace (${events.length} events):`);
  events.forEach((event) => console.log(event.printableSummary()));

  return result;
}
```

## Querying Events

### Get All Events

```typescript
const allEvents = tracer.getEvents();
```

### Filter by Event Type

```typescript
import { LLMCallTracerEvent, ToolCallTracerEvent } from 'mojentic';

// Get all LLM calls
const llmCalls = tracer.getEvents({ eventType: LLMCallTracerEvent });

// Get all tool calls
const toolCalls = tracer.getEvents({ eventType: ToolCallTracerEvent });
```

### Filter by Time Range

```typescript
const now = Date.now();
const oneMinuteAgo = now - 60000;

const recentEvents = tracer.getEvents({
  startTime: oneMinuteAgo,
  endTime: now,
});
```

### Custom Filters

```typescript
// Find events by correlation ID
const conversationEvents = tracer.getEvents({
  filterFunc: (e) => e.correlationId === 'abc-123',
});

// Find LLM calls with high temperature
const creativePrompts = tracer.getEvents({
  eventType: LLMCallTracerEvent,
  filterFunc: (e) => (e as LLMCallTracerEvent).temperature > 0.8,
});

// Find slow tool calls
const slowTools = tracer.getEvents({
  eventType: ToolCallTracerEvent,
  filterFunc: (e) => {
    const toolEvent = e as ToolCallTracerEvent;
    return toolEvent.callDurationMs && toolEvent.callDurationMs > 100;
  },
});
```

### Get Last N Events

```typescript
// Get last 10 events of any type
const last10 = tracer.getLastNTracerEvents(10);

// Get last 5 LLM responses
const last5Responses = tracer.getLastNTracerEvents(5, LLMResponseTracerEvent);
```

### Combined Filters

```typescript
// Find recent LLM calls for a specific conversation
const recentConversationCalls = tracer.getEvents({
  eventType: LLMCallTracerEvent,
  startTime: Date.now() - 300000, // Last 5 minutes
  filterFunc: (e) => e.correlationId === myCorrelationId,
});
```

## Integration

### With LLM Broker

When you pass a tracer to the LLM broker, it automatically records calls and responses:

```typescript
const tracer = new TracerSystem();
const broker = new LlmBroker('gpt-4', gateway, tracer);

// Broker records LLM calls, tool executions, and responses
await broker.generate([Message.user('Hello')], [dateTool]);
```

### With Tools

Tools can accept a tracer to record their executions:

```typescript
class CustomTool extends BaseTool {
  constructor(private tracer?: TracerSystem) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const startTime = Date.now();
    const correlationId = args.correlationId as string | undefined;

    try {
      const result = await this.doWork(args);

      if (this.tracer) {
        this.tracer.recordToolCall(
          this.name(),
          args,
          result,
          'CustomTool',
          Date.now() - startTime,
          correlationId
        );
      }

      return Ok(result);
    } catch (error) {
      if (this.tracer) {
        this.tracer.recordToolCall(
          this.name(),
          args,
          { error: error.message },
          'CustomTool',
          Date.now() - startTime,
          correlationId
        );
      }
      throw error;
    }
  }
}
```

### Event Callbacks

React to events as they're recorded:

```typescript
const eventStore = new EventStore((event) => {
  console.log(`New event: ${event.constructor.name}`);

  // Send to logging service
  if (event instanceof LLMCallTracerEvent) {
    logService.logLLMCall({
      model: event.model,
      timestamp: event.timestamp,
      correlationId: event.correlationId,
    });
  }
});

const tracer = new TracerSystem(eventStore);
```

## Best Practices

### 1. Generate Correlation IDs at Entry Points

```typescript
// Good: Generate at the entry point
app.post('/chat', async (req, res) => {
  const correlationId = crypto.randomUUID();
  const result = await handleChat(req.body.message, correlationId);
  res.json({ result, correlationId });
});

// Bad: Generate deep in the call stack
function handleChat(message) {
  const correlationId = crypto.randomUUID(); // Too late!
  // ...
}
```

### 2. Include Correlation ID in All Related Operations

```typescript
async function processWithTools(query: string, correlationId: string) {
  // Pass correlationId to broker
  const llmResult = await broker.generate([Message.user(query)], tools, {
    correlationId,
  });

  // Pass correlationId to tools
  const toolResult = await tool.run({ ...args, correlationId });

  return llmResult;
}
```

### 3. Use the Null Tracer for Production When Appropriate

```typescript
const tracer =
  process.env.ENABLE_TRACING === 'true' ? new TracerSystem() : nullTracer;
```

### 4. Clean Up Old Events Periodically

```typescript
// Clear events older than 1 hour
setInterval(
  () => {
    const oneHourAgo = Date.now() - 3600000;
    const oldEvents = tracer.getEvents({ endTime: oneHourAgo });

    // Archive old events to persistent storage if needed
    archiveEvents(oldEvents);

    // Clear the tracer
    tracer.clear();
  },
  60000
); // Every minute
```

### 5. Use Event Summaries for Debugging

```typescript
try {
  await broker.generate([Message.user(query)]);
} catch (error) {
  console.error('Error during generation:');

  // Show recent events for debugging
  const recent = tracer.getLastNTracerEvents(10);
  recent.forEach((event) => console.log(event.printableSummary()));

  throw error;
}
```

### 6. Analyze Tool Performance

```typescript
function analyzeToolPerformance() {
  const toolCalls = tracer.getEvents({ eventType: ToolCallTracerEvent });

  const stats = {};
  toolCalls.forEach((event) => {
    const toolEvent = event as ToolCallTracerEvent;
    if (!stats[toolEvent.toolName]) {
      stats[toolEvent.toolName] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
      };
    }

    stats[toolEvent.toolName].count++;
    if (toolEvent.callDurationMs) {
      stats[toolEvent.toolName].totalDuration += toolEvent.callDurationMs;
    }
  });

  // Calculate averages
  Object.keys(stats).forEach((toolName) => {
    stats[toolName].avgDuration = stats[toolName].totalDuration / stats[toolName].count;
  });

  console.table(stats);
}
```

## API Reference

### TracerSystem

```typescript
class TracerSystem {
  constructor(eventStore?: EventStore, enabled?: boolean);

  // Properties
  enabled: boolean;

  // Recording methods
  recordEvent(event: TracerEvent): void;
  recordLlmCall(
    model: string,
    messages: unknown[],
    temperature?: number,
    tools?: Record<string, unknown>[],
    correlationId?: string,
    source?: string
  ): void;
  recordLlmResponse(
    model: string,
    content: string,
    toolCalls?: ToolCall[],
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ): void;
  recordToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    caller?: string,
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ): void;
  recordAgentInteraction(
    fromAgent: string,
    toAgent: string,
    eventType: string,
    eventId?: string,
    correlationId?: string,
    source?: string
  ): void;

  // Query methods
  getEvents(options?: FilterOptions): TracerEvent[];
  getLastNTracerEvents(n: number, eventType?: EventType): TracerEvent[];

  // Control methods
  enable(): void;
  disable(): void;
  clear(): void;
}
```

### EventStore

```typescript
interface FilterOptions {
  eventType?: EventType;
  startTime?: number;
  endTime?: number;
  filterFunc?: (event: TracerEvent) => boolean;
}

class EventStore {
  constructor(onStoreCallback?: (event: TracerEvent) => void);

  store(event: TracerEvent): void;
  getEvents(options?: FilterOptions): TracerEvent[];
  getLastNEvents(n: number, eventType?: EventType): TracerEvent[];
  clear(): void;
}
```

### TracerEvent

```typescript
abstract class TracerEvent {
  readonly timestamp: number;
  readonly correlationId: string;
  readonly source?: string;

  printableSummary(): string;
}
```

### Event Types

```typescript
class LLMCallTracerEvent extends TracerEvent {
  model: string;
  messages: unknown[];
  temperature: number;
  tools?: Record<string, unknown>[];
}

class LLMResponseTracerEvent extends TracerEvent {
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  callDurationMs?: number;
}

class ToolCallTracerEvent extends TracerEvent {
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  caller?: string;
  callDurationMs?: number;
}

class AgentInteractionTracerEvent extends TracerEvent {
  fromAgent: string;
  toAgent: string;
  eventType: string;
  eventId?: string;
}
```

### NullTracer

```typescript
class NullTracer {
  // Implements same interface as TracerSystem
  // All methods are no-ops
  // All queries return empty arrays
}

// Singleton instance
const nullTracer: NullTracer;
```

## Examples

See [examples/tracer-demo.ts](../examples/tracer-demo.ts) for a complete interactive demonstration of the tracer system.

## Next Steps

- Learn about [Agent Systems](./agents.md) for multi-agent tracing
- Explore [Tool Development](./tools.md) for integrating tracing into custom tools
- See [Best Practices](./best-practices.md) for production deployment strategies
