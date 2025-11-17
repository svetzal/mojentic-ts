/**
 * Async Aggregator Agent - Collects and processes multiple related events
 */

import { BaseAsyncAgent } from './base-async-agent';
import { Event } from './event';
import { Result, Ok, Err } from '../error';

/**
 * Resolver function signature for waiting promises
 */
type EventResolver = (events: Event[]) => void;

/**
 * Base class for agents that aggregate multiple events before processing.
 *
 * This agent collects events with the same correlation ID until all required
 * event types have been received, then calls `processEvents` with the complete set.
 *
 * Useful for workflows where multiple agents process parts of a request in parallel,
 * and a final agent combines their results.
 *
 * @example
 * ```typescript
 * class FinalAnswerAgent extends AsyncAggregatorAgent {
 *   constructor() {
 *     super(['FactCheckEvent', 'AnswerEvent']);
 *   }
 *
 *   async processEvents(events: Event[]): Promise<Result<Event[], Error>> {
 *     const facts = events.find(e => e.type === 'FactCheckEvent') as FactCheckEvent;
 *     const answer = events.find(e => e.type === 'AnswerEvent') as AnswerEvent;
 *
 *     return Ok([new FinalAnswerEvent({
 *       answer: answer.answer,
 *       facts: facts.facts
 *     })]);
 *   }
 * }
 * ```
 */
export abstract class AsyncAggregatorAgent implements BaseAsyncAgent {
  /** Map of correlation IDs to accumulated events */
  protected results: Map<string, Event[]> = new Map();

  /** Map of correlation IDs to waiting promise resolvers */
  private waiters: Map<string, EventResolver[]> = new Map();

  /** Event type names that must be collected before processing */
  protected readonly eventTypesNeeded: string[];

  /**
   * Create a new aggregator agent.
   *
   * @param eventTypesNeeded - Array of event type names to wait for
   */
  constructor(eventTypesNeeded: string[]) {
    this.eventTypesNeeded = eventTypesNeeded;
  }

  /**
   * Check if all required event types have been received for a correlation ID.
   *
   * @param correlationId - The correlation ID to check
   * @returns True if all needed event types are present
   */
  private hasAllNeeded(correlationId: string): boolean {
    const events = this.results.get(correlationId) || [];
    const capturedTypes = events.map(
      (e) => (e as Event & { type?: string }).type || e.constructor.name
    );
    return this.eventTypesNeeded.every((needed) => capturedTypes.includes(needed));
  }

  /**
   * Capture an event and check if processing should trigger.
   *
   * @param event - The event to capture
   */
  private captureEvent(event: Event): void {
    const correlationId = event.correlationId;
    if (!correlationId) {
      return;
    }

    const events = this.results.get(correlationId) || [];
    events.push(event);
    this.results.set(correlationId, events);

    // Notify waiters if we have all needed events
    if (this.hasAllNeeded(correlationId)) {
      const resolvers = this.waiters.get(correlationId) || [];
      for (const resolve of resolvers) {
        resolve(events);
      }
      this.waiters.delete(correlationId);
    }
  }

  /**
   * Get and clear the accumulated events for a correlation ID.
   *
   * @param correlationId - The correlation ID
   * @returns Array of events
   */
  private getAndResetResults(correlationId: string): Event[] {
    const events = this.results.get(correlationId) || [];
    this.results.delete(correlationId);
    return events;
  }

  /**
   * Wait for all required events to be received for a correlation ID.
   *
   * This method blocks until all events specified in `eventTypesNeeded` have
   * been received with the given correlation ID, or until the timeout expires.
   *
   * @param correlationId - The correlation ID to wait for
   * @param timeout - Optional timeout in milliseconds
   * @returns Result containing the complete set of events or an error
   */
  async waitForEvents(correlationId: string, timeout?: number): Promise<Result<Event[], Error>> {
    // Check if we already have all events
    if (this.hasAllNeeded(correlationId)) {
      return Ok(this.results.get(correlationId) || []);
    }

    // Create a promise that resolves when all events arrive
    const promise = new Promise<Event[]>((resolve) => {
      const resolvers = this.waiters.get(correlationId) || [];
      resolvers.push(resolve);
      this.waiters.set(correlationId, resolvers);
    });

    // Apply timeout if specified
    if (timeout !== undefined) {
      const timeoutPromise = new Promise<Event[]>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout waiting for events (${timeout}ms)`));
        }, timeout);
      });

      try {
        const events = await Promise.race([promise, timeoutPromise]);
        return Ok(events);
      } catch (error) {
        return Err(error instanceof Error ? error : new Error(String(error)));
      }
    }

    const events = await promise;
    return Ok(events);
  }

  /**
   * Receive and process an event.
   *
   * Events are accumulated until all required types are present, then
   * `processEvents` is called with the complete set.
   *
   * @param event - The event to process
   * @returns Result containing new events to dispatch or an error
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    const correlationId = event.correlationId;
    if (!correlationId) {
      return Err(new Error('Event missing correlation ID'));
    }

    // Capture the event
    this.captureEvent(event);

    // Check if we have all needed events
    if (this.hasAllNeeded(correlationId)) {
      const events = this.getAndResetResults(correlationId);
      return this.processEvents(events);
    }

    // Not ready yet
    return Ok([]);
  }

  /**
   * Process a complete set of aggregated events.
   *
   * This method is called when all required event types have been received
   * for a correlation ID. Subclasses must implement this to define their
   * aggregation logic.
   *
   * @param events - The complete set of events to process
   * @returns Result containing new events to dispatch or an error
   */
  abstract processEvents(events: Event[]): Promise<Result<Event[], Error>>;
}
