/**
 * Async Dispatcher - Event processing loop for async agent systems
 */

import { Event, isTerminateEvent } from './event';
import { Router } from './router';
import { isOk } from '../error';
import { randomUUID } from 'crypto';

/**
 * Asynchronous event dispatcher with background processing loop.
 *
 * The dispatcher maintains an event queue and continuously routes events
 * to appropriate agents via a Router. Agents process events asynchronously
 * and can produce new events to continue the workflow.
 *
 * The processing loop runs in the background and can be stopped gracefully.
 *
 * @example
 * ```typescript
 * const router = new Router();
 * router.addRoute('QuestionEvent', factCheckerAgent);
 * router.addRoute('QuestionEvent', answerGeneratorAgent);
 *
 * const dispatcher = new AsyncDispatcher(router);
 * await dispatcher.start();
 *
 * dispatcher.dispatch(new QuestionEvent({ question: 'What is TypeScript?' }));
 *
 * await dispatcher.waitForEmptyQueue(5000);
 * await dispatcher.stop();
 * ```
 */
export class AsyncDispatcher {
  private readonly router: Router;
  private readonly eventQueue: Event[] = [];
  private stopFlag: boolean = false;
  private processingLoop?: Promise<void>;
  private readonly batchSize: number;

  /**
   * Create a new async dispatcher.
   *
   * @param router - Router to use for directing events to agents
   * @param batchSize - Number of events to process per iteration (default: 5)
   */
  constructor(router: Router, batchSize: number = 5) {
    this.router = router;
    this.batchSize = batchSize;
  }

  /**
   * Start the background event processing loop.
   *
   * The loop continues until `stop()` is called or a TerminateEvent is processed.
   *
   * @returns Promise that resolves when the loop starts
   */
  async start(): Promise<AsyncDispatcher> {
    this.stopFlag = false;
    this.processingLoop = this.dispatchEventsLoop();
    return this;
  }

  /**
   * Stop the background event processing loop.
   *
   * Waits for the current batch of events to finish processing before stopping.
   *
   * @returns Promise that resolves when processing has stopped
   */
  async stop(): Promise<void> {
    this.stopFlag = true;
    if (this.processingLoop) {
      await this.processingLoop;
      this.processingLoop = undefined;
    }
  }

  /**
   * Add an event to the processing queue.
   *
   * If the event doesn't have a correlation ID, one will be assigned.
   * Events are processed asynchronously by the background loop.
   *
   * @param event - The event to dispatch
   */
  dispatch(event: Event): void {
    if (!event.correlationId) {
      event.correlationId = randomUUID();
    }
    this.eventQueue.push(event);
  }

  /**
   * Wait for the event queue to become empty.
   *
   * Useful for ensuring all events have been processed before proceeding.
   *
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise resolving to true if queue emptied, false if timeout
   */
  async waitForEmptyQueue(timeout?: number): Promise<boolean> {
    const startTime = Date.now();

    while (this.eventQueue.length > 0) {
      if (timeout !== undefined && Date.now() - startTime > timeout) {
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return true;
  }

  /**
   * Background event processing loop.
   *
   * Continuously processes events from the queue in batches, routing them
   * through the router to appropriate agents. Runs until stopped or a
   * TerminateEvent is encountered.
   */
  private async dispatchEventsLoop(): Promise<void> {
    while (!this.stopFlag) {
      // Process up to batchSize events per iteration
      for (let i = 0; i < this.batchSize && this.eventQueue.length > 0; i++) {
        const event = this.eventQueue.shift();
        if (!event) {
          continue;
        }

        // Check for terminate event
        if (isTerminateEvent(event)) {
          this.stopFlag = true;
          break;
        }

        // Route event to agents
        const agents = this.router.getAgents(event);

        // Process through each agent
        for (const agent of agents) {
          try {
            const result = await agent.receiveEventAsync(event);

            if (isOk(result)) {
              // Dispatch any events produced by the agent
              const events = result.value as Event[];
              for (const newEvent of events) {
                this.dispatch(newEvent);
              }
            } else {
              // Log error but continue processing
              console.error(`Agent error processing event:`, result.error);
            }
          } catch (error) {
            console.error(`Unexpected error in agent:`, error);
          }
        }
      }

      // Small delay before next batch
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get the current number of events in the queue.
   *
   * @returns Number of queued events
   */
  getQueueLength(): number {
    return this.eventQueue.length;
  }

  /**
   * Check if the dispatcher is currently running.
   *
   * @returns True if the processing loop is active
   */
  isRunning(): boolean {
    return !this.stopFlag && this.processingLoop !== undefined;
  }
}
