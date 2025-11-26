/**
 * Base interface for synchronous agents
 *
 * Synchronous agents implement the `receiveEvent` method to process
 * incoming events and return a list of new events. This is the simplest
 * agent interface, suitable for agents that don't need to perform async
 * operations.
 *
 * For agents that need to perform I/O, LLM calls, or other async operations,
 * use `BaseAsyncAgent` instead.
 *
 * @example
 * ```typescript
 * class MyAgent implements BaseAgent {
 *   receiveEvent(event: Event): Event[] {
 *     // Process event synchronously
 *     return [new MyResponseEvent({ data: process(event) })];
 *   }
 * }
 * ```
 */

import { Event } from './event';

/**
 * Base interface that synchronous agents must implement.
 *
 * Agents process events and optionally produce new events in response.
 * Processing is synchronous, making this suitable for simple transformations
 * and coordination logic that doesn't require async operations.
 *
 * @example
 * ```typescript
 * class TransformAgent implements BaseAgent {
 *   receiveEvent(event: Event): Event[] {
 *     if (isDataEvent(event)) {
 *       const transformed = this.transform(event.data);
 *       return [new TransformedEvent({ data: transformed })];
 *     }
 *     return [];
 *   }
 * }
 * ```
 */
export interface BaseAgent {
  /**
   * Process an incoming event and optionally produce new events.
   *
   * This method is called when an event is routed to this agent.
   * The agent should process the event synchronously and return
   * new events to continue the workflow.
   *
   * Returning an empty array means the event was processed but
   * produced no follow-up events.
   *
   * @param event - The event to process
   * @returns Array of new events to dispatch (can be empty)
   */
  receiveEvent(event: Event): Event[];
}
