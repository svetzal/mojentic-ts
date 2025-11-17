/**
 * Event system for agent communication
 */

/**
 * Base event class for agent communication.
 * Events are the primary mechanism for agents to communicate with each other.
 */
export interface Event {
  /** The type/class of the agent that created this event */
  source: string;
  /** Unique identifier linking related events in a conversation or workflow */
  correlationId?: string;
}

/**
 * Special event that signals the dispatcher to stop processing
 */
export interface TerminateEvent extends Event {
  type: 'terminate';
}

/**
 * Type guard to check if an event is a TerminateEvent
 */
export function isTerminateEvent(event: Event): event is TerminateEvent {
  return (event as TerminateEvent).type === 'terminate';
}
