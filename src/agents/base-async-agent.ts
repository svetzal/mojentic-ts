/**
 * Base interface for asynchronous agents
 */

import { Event } from './event';
import { Result } from '../error';

/**
 * Base interface that all async agents must implement.
 *
 * Agents process events and optionally produce new events in response.
 * All processing is asynchronous, allowing agents to perform I/O operations
 * like LLM calls without blocking.
 *
 * @example
 * ```typescript
 * class MyAgent implements BaseAsyncAgent {
 *   async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
 *     if (isQuestionEvent(event)) {
 *       const answer = await this.processQuestion(event.question);
 *       return Ok([new AnswerEvent({ answer })]);
 *     }
 *     return Ok([]);
 *   }
 * }
 * ```
 */
export interface BaseAsyncAgent {
  /**
   * Process an incoming event and optionally produce new events.
   *
   * This method is called by the dispatcher when an event is routed to this agent.
   * The agent can perform asynchronous operations (LLM calls, database queries, etc.)
   * and return new events to continue the workflow.
   *
   * Returning an empty array means the event was processed but produced no follow-up events.
   * Returning an error Result indicates processing failure.
   *
   * @param event - The event to process
   * @returns Result containing array of new events to dispatch, or an error
   */
  receiveEventAsync(event: Event): Promise<Result<Event[], Error>>;
}
