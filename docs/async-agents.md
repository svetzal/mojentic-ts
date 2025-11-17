# Async Agent System

The async agent system provides a framework for building event-driven LLM workflows where multiple agents can process events concurrently and communicate through typed events.

## Core Concepts

### Events

Events are the primary communication mechanism between agents. Each event has:
- `source`: The agent that created the event
- `correlationId`: Links related events in a workflow

```typescript
interface QuestionEvent extends Event {
  type: 'QuestionEvent';
  question: string;
}
```

### BaseAsyncAgent

The fundamental interface that all async agents implement:

```typescript
interface BaseAsyncAgent {
  receiveEventAsync(event: Event): Promise<Result<Event[], Error>>;
}
```

Agents receive events and can produce zero or more new events in response.

### AsyncLlmAgent

Base class for agents that use an LLM to generate responses:

```typescript
class FactCheckerAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour: 'You are a fact-checking assistant.',
      responseModel: factCheckSchema,
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (isQuestionEvent(event)) {
      const result = await this.generateResponse<FactCheckResponse>(
        `Check facts about: ${event.question}`
      );

      if (isOk(result)) {
        return Ok([{
          type: 'FactCheckEvent',
          facts: result.value.facts
        }]);
      }
    }
    return Ok([]);
  }
}
```

Features:
- Automatic LLM integration
- Structured output support via JSON schema
- Tool support
- Error handling

### AsyncAggregatorAgent

Base class for agents that collect multiple events before processing:

```typescript
class FinalAnswerAgent extends AsyncAggregatorAgent {
  constructor() {
    super(['FactCheckEvent', 'AnswerEvent']);
  }

  async processEvents(events: Event[]): Promise<Result<Event[], Error>> {
    const facts = events.find(e => e.type === 'FactCheckEvent');
    const answer = events.find(e => e.type === 'AnswerEvent');

    return Ok([{
      type: 'FinalAnswerEvent',
      answer: answer.answer,
      facts: facts.facts,
    }]);
  }
}
```

The aggregator:
- Accumulates events by `correlationId`
- Waits for all required event types
- Calls `processEvents` when complete
- Supports timeouts

### Router

Routes events to registered agents based on event type:

```typescript
const router = new Router();
router.addRoute('QuestionEvent', factCheckerAgent);
router.addRoute('QuestionEvent', answerGeneratorAgent);
router.addRoute('FactCheckEvent', finalAnswerAgent);
router.addRoute('AnswerEvent', finalAnswerAgent);
```

Multiple agents can subscribe to the same event type for parallel processing.

### AsyncDispatcher

Manages the event processing loop:

```typescript
const dispatcher = new AsyncDispatcher(router);
await dispatcher.start();

// Dispatch events
dispatcher.dispatch(questionEvent);

// Wait for processing to complete
await dispatcher.waitForEmptyQueue(5000);

await dispatcher.stop();
```

The dispatcher:
- Runs a background event processing loop
- Routes events through the router
- Automatically dispatches events produced by agents
- Supports graceful shutdown
- Handles `TerminateEvent` for automatic stopping

## Example Workflow

Here's a complete example that demonstrates parallel LLM processing with aggregation:

```typescript
import {
  Event,
  AsyncLlmAgent,
  AsyncAggregatorAgent,
  AsyncDispatcher,
  Router,
} from 'mojentic';
import { LlmBroker, OllamaGateway } from 'mojentic';

// 1. Define events
interface QuestionEvent extends Event {
  type: 'QuestionEvent';
  question: string;
}

interface FactCheckEvent extends Event {
  type: 'FactCheckEvent';
  facts: string[];
}

interface AnswerEvent extends Event {
  type: 'AnswerEvent';
  answer: string;
  confidence: number;
}

interface FinalAnswerEvent extends Event {
  type: 'FinalAnswerEvent';
  answer: string;
  facts: string[];
  confidence: number;
}

// 2. Define agents
class FactCheckerAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour: 'You are a fact-checking assistant.',
      responseModel: {
        type: 'object',
        properties: {
          facts: { type: 'array', items: { type: 'string' } }
        },
        required: ['facts'],
      },
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (isQuestionEvent(event)) {
      const result = await this.generateResponse<{facts: string[]}>(
        `Provide facts about: ${event.question}`
      );

      if (isOk(result)) {
        return Ok([{
          type: 'FactCheckEvent',
          source: 'FactCheckerAgent',
          correlationId: event.correlationId,
          facts: result.value.facts,
        } as FactCheckEvent]);
      }
    }
    return Ok([]);
  }
}

class AnswerGeneratorAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour: 'You provide accurate answers to questions.',
      responseModel: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          confidence: { type: 'number' }
        },
        required: ['answer', 'confidence'],
      },
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (isQuestionEvent(event)) {
      const result = await this.generateResponse<{answer: string, confidence: number}>(
        `Answer this question: ${event.question}`
      );

      if (isOk(result)) {
        return Ok([{
          type: 'AnswerEvent',
          source: 'AnswerGeneratorAgent',
          correlationId: event.correlationId,
          answer: result.value.answer,
          confidence: result.value.confidence,
        } as AnswerEvent]);
      }
    }
    return Ok([]);
  }
}

class FinalAnswerAgent extends AsyncAggregatorAgent {
  private finalAnswers = new Map<string, FinalAnswerEvent>();

  constructor() {
    super(['FactCheckEvent', 'AnswerEvent']);
  }

  async processEvents(events: Event[]): Promise<Result<Event[], Error>> {
    const facts = events.find(e => e.type === 'FactCheckEvent') as FactCheckEvent;
    const answer = events.find(e => e.type === 'AnswerEvent') as AnswerEvent;

    const finalAnswer: FinalAnswerEvent = {
      type: 'FinalAnswerEvent',
      source: 'FinalAnswerAgent',
      correlationId: facts.correlationId,
      answer: answer.answer,
      facts: facts.facts,
      confidence: answer.confidence,
    };

    if (finalAnswer.correlationId) {
      this.finalAnswers.set(finalAnswer.correlationId, finalAnswer);
    }

    return Ok([finalAnswer]);
  }

  async getFinalAnswer(correlationId: string, timeout = 30000) {
    await this.waitForEvents(correlationId, timeout);
    return this.finalAnswers.get(correlationId);
  }
}

// 3. Set up the system
async function main() {
  const gateway = new OllamaGateway('http://localhost:11434');
  const broker = new LlmBroker('qwen3:30b', gateway);

  const factChecker = new FactCheckerAgent(broker);
  const answerGenerator = new AnswerGeneratorAgent(broker);
  const finalAnswerAgent = new FinalAnswerAgent();

  const router = new Router();
  router.addRoute('QuestionEvent', factChecker);
  router.addRoute('QuestionEvent', answerGenerator);
  router.addRoute('FactCheckEvent', finalAnswerAgent);
  router.addRoute('AnswerEvent', finalAnswerAgent);

  const dispatcher = new AsyncDispatcher(router);
  await dispatcher.start();

  // 4. Process a question
  const question: QuestionEvent = {
    type: 'QuestionEvent',
    source: 'UserInput',
    correlationId: 'q-001',
    question: 'What is the capital of France?',
  };

  dispatcher.dispatch(question);

  const finalAnswer = await finalAnswerAgent.getFinalAnswer('q-001', 30000);

  console.log('Answer:', finalAnswer?.answer);
  console.log('Facts:', finalAnswer?.facts);
  console.log('Confidence:', finalAnswer?.confidence);

  await dispatcher.stop();
}
```

## Workflow Patterns

### Parallel Processing

Multiple agents can process the same event type simultaneously:

```typescript
router.addRoute('QuestionEvent', factCheckerAgent);
router.addRoute('QuestionEvent', answerGeneratorAgent);
// Both agents process QuestionEvent in parallel
```

### Sequential Processing

Chain events by having agents produce events that other agents consume:

```typescript
// Agent A produces Event1
// Agent B consumes Event1, produces Event2
// Agent C consumes Event2
```

### Fan-In Aggregation

Use `AsyncAggregatorAgent` to wait for multiple parallel operations:

```typescript
class AggregatorAgent extends AsyncAggregatorAgent {
  constructor() {
    super(['EventType1', 'EventType2', 'EventType3']);
  }

  async processEvents(events: Event[]) {
    // All three event types have arrived
    // Process them together
  }
}
```

### Conditional Routing

Agents can inspect events and conditionally produce different event types:

```typescript
async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
  if (condition1) {
    return Ok([eventA]);
  } else if (condition2) {
    return Ok([eventB]);
  }
  return Ok([]);
}
```

## Best Practices

### Type Guards

Use type guards for type-safe event handling:

```typescript
function isQuestionEvent(event: Event): event is QuestionEvent {
  return (event as QuestionEvent).type === 'QuestionEvent';
}
```

### Correlation IDs

Always preserve correlation IDs when creating new events:

```typescript
return Ok([{
  type: 'ResponseEvent',
  source: 'MyAgent',
  correlationId: event.correlationId, // Preserve this!
  data: result,
}]);
```

### Error Handling

Handle errors gracefully and return empty arrays:

```typescript
const result = await this.generateResponse(prompt);
if (!isOk(result)) {
  console.error('LLM error:', result.error);
  return Ok([]); // Don't propagate errors, just stop processing
}
```

### Timeouts

Always specify timeouts for aggregation:

```typescript
const result = await this.waitForEvents(correlationId, 30000);
if (!isOk(result)) {
  console.error('Timeout waiting for events');
}
```

### Graceful Shutdown

Stop the dispatcher to ensure all processing completes:

```typescript
try {
  await dispatcher.start();
  // Process events...
} finally {
  await dispatcher.stop();
}
```

## Testing

Test agents in isolation:

```typescript
test('FactCheckerAgent processes questions', async () => {
  const mockBroker = createMockBroker();
  const agent = new FactCheckerAgent(mockBroker);

  const event: QuestionEvent = {
    type: 'QuestionEvent',
    source: 'Test',
    question: 'Test question?',
  };

  const result = await agent.receiveEventAsync(event);

  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value).toHaveLength(1);
    expect(result.value[0].type).toBe('FactCheckEvent');
  }
});
```

Test the full workflow:

```typescript
test('Complete question-answer workflow', async () => {
  const router = new Router();
  // Register agents...

  const dispatcher = new AsyncDispatcher(router);
  await dispatcher.start();

  dispatcher.dispatch(questionEvent);

  await dispatcher.waitForEmptyQueue(5000);
  await dispatcher.stop();

  // Assert final state
});
```

## Performance Considerations

- The dispatcher processes events in batches (default: 5 per iteration)
- Adjust batch size for your workload: `new AsyncDispatcher(router, 10)`
- Aggregators maintain state per correlation ID - clean up old entries
- LLM calls are the primary bottleneck - parallelize when possible

## See Also

- [LLM Broker](./llm-broker.md) - Core LLM integration
- [Structured Output](./structured-output.md) - JSON schema responses
- [Tool Usage](./tool-usage.md) - LLM tool calling
