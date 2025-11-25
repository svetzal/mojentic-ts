/**
 * A simple declarative agent implementation that leverages events and async patterns.
 * This implementation provides a declarative approach to problem-solving with LLMs.
 */

import { LlmBroker } from '../llm/broker';
import { ChatSession } from '../llm/chat-session';
import { LlmTool } from '../llm/tools/tool';
import { TimeoutError } from '../error';

/**
 * Represents the state of a problem-solving process.
 */
export interface GoalState {
  /** The problem or goal to solve */
  goal: string;
  /** Current iteration count */
  iteration: number;
  /** Maximum allowed iterations */
  maxIterations: number;
  /** The solution, if found */
  solution: string | null;
  /** Whether the problem-solving process is complete */
  isComplete: boolean;
}

/**
 * Base class for solver events.
 */
export interface SolverEvent {
  /** Current state of the problem-solving process */
  state: GoalState;
}

/**
 * Event triggered when a goal is submitted for solving.
 */
export interface GoalSubmittedEvent extends SolverEvent {
  type: 'goal-submitted';
}

/**
 * Event triggered when an iteration of the problem-solving process is completed.
 */
export interface IterationCompletedEvent extends SolverEvent {
  type: 'iteration-completed';
  /** The response from the LLM for this iteration */
  response: string;
}

/**
 * Event triggered when a goal is successfully achieved.
 */
export interface GoalAchievedEvent extends SolverEvent {
  type: 'goal-achieved';
}

/**
 * Event triggered when a goal cannot be solved.
 */
export interface GoalFailedEvent extends SolverEvent {
  type: 'goal-failed';
}

/**
 * Event triggered when the problem-solving process times out.
 */
export interface TimeoutEvent extends SolverEvent {
  type: 'timeout';
}

/**
 * Union type of all solver events
 */
export type AnySolverEvent =
  | GoalSubmittedEvent
  | IterationCompletedEvent
  | GoalAchievedEvent
  | GoalFailedEvent
  | TimeoutEvent;

/**
 * Event handler function type
 */
type EventHandler<T extends AnySolverEvent> = (event: T) => void | Promise<void>;

/**
 * Unsubscribe function returned by subscribe
 */
type UnsubscribeFn = () => void;

/**
 * A simple event emitter that allows subscribing to and emitting events.
 */
export class EventEmitter {
  private subscribers: Map<string, EventHandler<AnySolverEvent>[]> = new Map();

  /**
   * Subscribe to an event type.
   *
   * @param eventType - The type of event to subscribe to
   * @param callback - The callback function to be called when an event of the specified type is emitted
   * @returns A function that can be called to unsubscribe from the event
   */
  subscribe<T extends AnySolverEvent>(
    eventType: T['type'],
    callback: EventHandler<T>
  ): UnsubscribeFn {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    const handlers = this.subscribers.get(eventType);
    if (!handlers) {
      throw new Error(`Failed to get handlers for event type: ${eventType}`);
    }

    handlers.push(callback as EventHandler<AnySolverEvent>);

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(callback as EventHandler<AnySolverEvent>);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Emit an event to all subscribers.
   *
   * @param event - The event to emit to subscribers
   */
  emit(event: AnySolverEvent): void {
    const handlers = this.subscribers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        const result = handler(event);
        // If the handler returns a promise, schedule it without blocking
        if (result instanceof Promise) {
          // Handle promise rejection to prevent unhandled promise rejections
          result.catch((error) => {
            console.error('Error in event handler:', error);
          });
        }
      }
    }
  }
}

/**
 * An agent that recursively attempts to solve a problem using available tools.
 *
 * This agent uses an event-driven approach to manage the problem-solving process.
 * It will continue attempting to solve the problem until it either succeeds,
 * fails explicitly, or reaches the maximum number of iterations.
 *
 * @example
 * ```typescript
 * const broker = new LlmBroker('qwen3:32b', new OllamaGateway());
 * const agent = new SimpleRecursiveAgent(broker, [new DateResolverTool()], 5);
 *
 * agent.emitter.subscribe('iteration-completed', (event) => {
 *   console.log(`Iteration ${event.state.iteration}: ${event.response}`);
 * });
 *
 * const solution = await agent.solve('What day is next Friday?');
 * console.log(solution);
 * ```
 */
export class SimpleRecursiveAgent {
  /** The event emitter used to manage events */
  readonly emitter: EventEmitter;

  private readonly maxIterations: number;
  private readonly availableTools: LlmTool[];
  private readonly chat: ChatSession;

  /**
   * Initialize the SimpleRecursiveAgent.
   *
   * @param llm - The language model broker to use for generating responses
   * @param availableTools - List of tools that can be used to solve the problem
   * @param maxIterations - The maximum number of iterations to perform (default: 5)
   * @param systemPrompt - Optional custom system prompt
   */
  constructor(
    llm: LlmBroker,
    availableTools: LlmTool[] = [],
    maxIterations: number = 5,
    systemPrompt?: string
  ) {
    this.maxIterations = maxIterations;
    this.availableTools = availableTools;
    this.emitter = new EventEmitter();

    // Initialize the chat session
    this.chat = new ChatSession(llm, {
      systemPrompt:
        systemPrompt ||
        'You are a problem-solving assistant that can solve complex problems step by step. ' +
          'You analyze problems, break them down into smaller parts, and solve them systematically. ' +
          'If you cannot solve a problem completely in one step, you make progress and identify what to do next.',
      tools: this.availableTools,
    });

    // Set up event handlers
    this.emitter.subscribe('goal-submitted', this.handleProblemSubmitted.bind(this));
    this.emitter.subscribe('iteration-completed', this.handleIterationCompleted.bind(this));
  }

  /**
   * Solve a problem asynchronously.
   *
   * @param problem - The problem to solve
   * @returns The solution to the problem
   * @throws {TimeoutError} If the solution cannot be found within 300 seconds
   *
   * @example
   * ```typescript
   * const solution = await agent.solve('Calculate the factorial of 5');
   * console.log(solution);
   * ```
   */
  async solve(problem: string): Promise<string> {
    // Create a promise that resolves when the solution is ready
    let resolveSolution: (value: string) => void;
    const solutionPromise = new Promise<string>((resolve) => {
      resolveSolution = resolve;
    });

    // Create the initial problem state
    const state: GoalState = {
      goal: problem,
      iteration: 0,
      maxIterations: this.maxIterations,
      solution: null,
      isComplete: false,
    };

    // Define handlers for completion events
    const handleSolutionEvent = (event: GoalAchievedEvent | GoalFailedEvent | TimeoutEvent) => {
      if (event.state.solution !== null) {
        resolveSolution(event.state.solution);
      }
    };

    // Subscribe to completion events
    const unsubscribeAchieved = this.emitter.subscribe('goal-achieved', handleSolutionEvent);
    const unsubscribeFailed = this.emitter.subscribe('goal-failed', handleSolutionEvent);
    const unsubscribeTimeout = this.emitter.subscribe('timeout', handleSolutionEvent);

    // Start the solving process
    this.emitter.emit({ type: 'goal-submitted', state });

    // Wait for the solution or timeout
    try {
      const solution = await this.raceWithTimeout(solutionPromise, 300000, state); // 300 seconds = 5 minutes
      return solution;
    } finally {
      // Clean up subscriptions
      unsubscribeAchieved();
      unsubscribeFailed();
      unsubscribeTimeout();
    }
  }

  /**
   * Race a promise with a timeout.
   *
   * @param promise - The promise to race
   * @param timeoutMs - Timeout in milliseconds
   * @param state - Current goal state for timeout event
   * @returns The result of the promise or throws TimeoutError
   */
  private async raceWithTimeout(
    promise: Promise<string>,
    timeoutMs: number,
    state: GoalState
  ): Promise<string> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const timeoutMessage = `Timeout: Could not solve the problem within ${timeoutMs / 1000} seconds.`;
        state.solution = timeoutMessage;
        state.isComplete = true;
        this.emitter.emit({ type: 'timeout', state });
        reject(new TimeoutError(timeoutMessage));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Handle a problem submitted event.
   *
   * @param event - The problem submitted event to handle
   */
  private async handleProblemSubmitted(event: GoalSubmittedEvent): Promise<void> {
    // Start the first iteration
    await this.processIteration(event.state);
  }

  /**
   * Handle an iteration completed event.
   *
   * @param event - The iteration completed event to handle
   */
  private async handleIterationCompleted(event: IterationCompletedEvent): Promise<void> {
    const state = event.state;
    const response = event.response;

    // Check if the task failed or succeeded
    if (response.toLowerCase().includes('fail')) {
      state.solution = `Failed to solve after ${state.iteration} iterations:\n${response}`;
      state.isComplete = true;
      this.emitter.emit({ type: 'goal-failed', state });
      return;
    } else if (response.toLowerCase().includes('done')) {
      state.solution = response;
      state.isComplete = true;
      this.emitter.emit({ type: 'goal-achieved', state });
      return;
    }

    // Check if we've reached the maximum number of iterations
    if (state.iteration >= state.maxIterations) {
      state.solution = `Best solution after ${state.maxIterations} iterations:\n${response}`;
      state.isComplete = true;
      this.emitter.emit({ type: 'goal-achieved', state });
      return;
    }

    // If the problem is not solved and we haven't reached maxIterations, continue with next iteration
    // Schedule the next iteration asynchronously to allow all event handlers to complete first
    await Promise.resolve().then(() => this.processIteration(state));
  }

  /**
   * Process a single iteration of the problem-solving process.
   *
   * @param state - The current state of the problem-solving process
   */
  private async processIteration(state: GoalState): Promise<void> {
    // Increment the iteration counter
    state.iteration += 1;

    // Create a prompt for the LLM
    const prompt = `
Given the user request:
${state.goal}

Use the tools at your disposal to act on their request.
You may wish to create a step-by-step plan for more complicated requests.

If you cannot provide an answer, say only "FAIL".
If you have the answer, say only "DONE".
`;

    // Generate a response using the LLM
    const response = await this.generate(prompt);

    // Emit an event with the response
    this.emitter.emit({ type: 'iteration-completed', state, response });
  }

  /**
   * Generate a response using the ChatSession.
   *
   * @param prompt - The prompt to send to the ChatSession
   * @returns The generated response
   */
  private async generate(prompt: string): Promise<string> {
    return await this.chat.send(prompt);
  }

  /**
   * Clean up resources when done with the agent.
   */
  dispose(): void {
    this.chat.dispose();
  }
}
