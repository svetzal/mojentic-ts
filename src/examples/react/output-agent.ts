/**
 * Simple output agent for displaying events in the ReAct pattern.
 *
 * This agent logs event information for debugging and monitoring purposes.
 */

import { BaseAsyncAgent } from '../../agents/base-async-agent';
import { Event } from '../../agents/event';
import { Result, Ok } from '../../error';

/**
 * Agent responsible for outputting event information.
 *
 * This agent receives all events and logs them for monitoring the ReAct workflow.
 */
export class OutputAgent implements BaseAsyncAgent {
  /**
   * Process an event and log its information.
   *
   * @param event - The event to process
   * @returns Empty array (this agent doesn't produce new events)
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    console.log(`\n[Event: ${event.type}] Source: ${event.source}`);
    return Ok([]);
  }
}
