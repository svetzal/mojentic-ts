/**
 * Tests for SimpleRecursiveAgent
 */

import {
  SimpleRecursiveAgent,
  EventEmitter,
  GoalState,
  GoalSubmittedEvent,
  IterationCompletedEvent,
  GoalAchievedEvent,
  GoalFailedEvent,
} from '../simple-recursive-agent';
import { LlmBroker } from '../../llm/broker';
import { LlmGateway } from '../../llm/gateway';
import { LlmTool } from '../../llm/tools/tool';
import { Ok } from '../../error';
import { MessageRole } from '../../llm/models';

// Mock gateway that returns predefined responses
class MockGateway implements LlmGateway {
  private responses: string[];
  private currentIndex: number = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generate() {
    const response = this.responses[this.currentIndex] || 'DONE';
    this.currentIndex++;
    return Ok({
      content: response,
      role: MessageRole.Assistant,
      done: true,
    });
  }

  async *generateStream() {
    yield Ok({
      content: 'Mock stream',
      role: MessageRole.Assistant,
      done: true,
    });
  }

  async listModels() {
    return Ok(['mock-model']);
  }

  async calculateEmbeddings() {
    return Ok([0.1, 0.2, 0.3]);
  }

  reset() {
    this.currentIndex = 0;
  }
}

// Mock tool for testing
class MockTool implements LlmTool {
  async run() {
    return Ok({ result: 'mock result' });
  }

  descriptor() {
    return {
      type: 'function' as const,
      function: {
        name: 'mock_tool',
        description: 'A mock tool for testing',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    };
  }

  name() {
    return 'mock_tool';
  }

  matches(name: string): boolean {
    return this.name() === name;
  }
}

describe('EventEmitter', () => {
  it('should subscribe and emit events', () => {
    const emitter = new EventEmitter();
    const mockHandler = jest.fn();

    emitter.subscribe('goal-submitted', mockHandler);

    const state: GoalState = {
      goal: 'test goal',
      iteration: 0,
      maxIterations: 5,
      solution: null,
      isComplete: false,
    };

    const event: GoalSubmittedEvent = { type: 'goal-submitted', state };
    emitter.emit(event);

    expect(mockHandler).toHaveBeenCalledWith(event);
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe from events', () => {
    const emitter = new EventEmitter();
    const mockHandler = jest.fn();

    const unsubscribe = emitter.subscribe('goal-submitted', mockHandler);

    const state: GoalState = {
      goal: 'test goal',
      iteration: 0,
      maxIterations: 5,
      solution: null,
      isComplete: false,
    };

    const event: GoalSubmittedEvent = { type: 'goal-submitted', state };

    // Emit before unsubscribe
    emitter.emit(event);
    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Unsubscribe and emit again
    unsubscribe();
    emitter.emit(event);
    expect(mockHandler).toHaveBeenCalledTimes(1); // Should still be 1
  });

  it('should handle async event handlers', async () => {
    const emitter = new EventEmitter();
    let asyncHandlerCalled = false;

    const asyncHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncHandlerCalled = true;
    };

    emitter.subscribe('goal-submitted', asyncHandler);

    const state: GoalState = {
      goal: 'test goal',
      iteration: 0,
      maxIterations: 5,
      solution: null,
      isComplete: false,
    };

    emitter.emit({ type: 'goal-submitted', state });

    // Wait for async handler to complete
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asyncHandlerCalled).toBe(true);
  });

  it('should handle multiple subscribers', () => {
    const emitter = new EventEmitter();
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.subscribe('goal-achieved', handler1);
    emitter.subscribe('goal-achieved', handler2);

    const state: GoalState = {
      goal: 'test goal',
      iteration: 1,
      maxIterations: 5,
      solution: 'test solution',
      isComplete: true,
    };

    const event: GoalAchievedEvent = { type: 'goal-achieved', state };
    emitter.emit(event);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
  });
});

describe('SimpleRecursiveAgent', () => {
  let gateway: MockGateway;
  let broker: LlmBroker;

  beforeEach(() => {
    gateway = new MockGateway(['DONE']);
    broker = new LlmBroker('mock-model', gateway);
  });

  it('should solve a problem successfully', async () => {
    const agent = new SimpleRecursiveAgent(broker);
    const solution = await agent.solve('test problem');

    expect(solution).toContain('DONE');
  });

  it('should emit goal-submitted event', async () => {
    const agent = new SimpleRecursiveAgent(broker);
    const mockHandler = jest.fn();

    agent.emitter.subscribe('goal-submitted', mockHandler);

    await agent.solve('test problem');

    expect(mockHandler).toHaveBeenCalled();
    const event = mockHandler.mock.calls[0][0] as GoalSubmittedEvent;
    expect(event.state.goal).toBe('test problem');
  });

  it('should emit iteration-completed event', async () => {
    const agent = new SimpleRecursiveAgent(broker);
    const mockHandler = jest.fn();

    agent.emitter.subscribe('iteration-completed', mockHandler);

    await agent.solve('test problem');

    expect(mockHandler).toHaveBeenCalled();
    const event = mockHandler.mock.calls[0][0] as IterationCompletedEvent;
    expect(event.state.iteration).toBe(1);
    expect(event.response).toBeTruthy();
  });

  it('should emit goal-achieved event on success', async () => {
    const agent = new SimpleRecursiveAgent(broker);
    const mockHandler = jest.fn();

    agent.emitter.subscribe('goal-achieved', mockHandler);

    await agent.solve('test problem');

    expect(mockHandler).toHaveBeenCalled();
    const event = mockHandler.mock.calls[0][0] as GoalAchievedEvent;
    expect(event.state.isComplete).toBe(true);
    expect(event.state.solution).toBeTruthy();
  });

  it('should emit goal-failed event on FAIL', async () => {
    gateway = new MockGateway(['FAIL']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker);
    const mockHandler = jest.fn();

    agent.emitter.subscribe('goal-failed', mockHandler);

    const solution = await agent.solve('impossible problem');

    expect(mockHandler).toHaveBeenCalled();
    const event = mockHandler.mock.calls[0][0] as GoalFailedEvent;
    expect(event.state.isComplete).toBe(true);
    expect(solution).toContain('Failed to solve');
  });

  it('should handle multiple iterations', async () => {
    gateway = new MockGateway(['working on it', 'still working', 'DONE']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker);
    const iterationHandler = jest.fn();

    agent.emitter.subscribe('iteration-completed', iterationHandler);

    await agent.solve('complex problem');

    expect(iterationHandler).toHaveBeenCalledTimes(3);
  });

  it('should stop at maxIterations', async () => {
    gateway = new MockGateway([
      'iteration 1',
      'iteration 2',
      'iteration 3',
      'iteration 4',
      'iteration 5',
    ]);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker, [], 3);

    const solution = await agent.solve('problem');

    expect(solution).toContain('Best solution after 3 iterations');
  });

  it('should work with tools', async () => {
    const agent = new SimpleRecursiveAgent(broker, [new MockTool()]);
    const solution = await agent.solve('test problem with tools');

    expect(solution).toContain('DONE');
  });

  it('should use custom system prompt', async () => {
    const customPrompt = 'You are a custom assistant';
    const agent = new SimpleRecursiveAgent(broker, [], 5, customPrompt);
    const solution = await agent.solve('test problem');

    expect(solution).toBeTruthy();
  });

  it('should handle timeout properly', async () => {
    // Create a gateway that never responds with DONE or FAIL
    gateway = new MockGateway(['working', 'working', 'working']);
    broker = new LlmBroker('mock-model', gateway);

    // Create agent with very low max iterations to trigger completion
    const agent = new SimpleRecursiveAgent(broker, [], 2);

    const solution = await agent.solve('problem');

    // Should complete after max iterations
    expect(solution).toContain('Best solution after 2 iterations');
  });

  it('should dispose resources properly', async () => {
    const agent = new SimpleRecursiveAgent(broker);
    await agent.solve('test problem');

    // Should not throw
    expect(() => agent.dispose()).not.toThrow();
  });

  it('should track iteration count correctly', async () => {
    gateway = new MockGateway(['step 1', 'step 2', 'DONE']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker);
    const states: GoalState[] = [];

    agent.emitter.subscribe('iteration-completed', (event) => {
      states.push({ ...event.state });
    });

    await agent.solve('problem');

    expect(states).toHaveLength(3);
    expect(states[0].iteration).toBe(1);
    expect(states[1].iteration).toBe(2);
    expect(states[2].iteration).toBe(3);
  });

  it('should detect DONE case-insensitively', async () => {
    gateway = new MockGateway(['done']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker);

    const solution = await agent.solve('problem');

    expect(solution).toContain('done');
  });

  it('should detect FAIL case-insensitively', async () => {
    gateway = new MockGateway(['fail']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker);

    const solution = await agent.solve('problem');

    expect(solution).toContain('Failed to solve');
  });

  it('should preserve goal state across iterations', async () => {
    gateway = new MockGateway(['working', 'DONE']);
    broker = new LlmBroker('mock-model', gateway);
    const agent = new SimpleRecursiveAgent(broker, [], 5);
    const goal = 'test goal persistence';

    agent.emitter.subscribe('iteration-completed', (event) => {
      expect(event.state.goal).toBe(goal);
      expect(event.state.maxIterations).toBe(5);
    });

    await agent.solve(goal);
  });
});
