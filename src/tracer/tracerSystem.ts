/**
 * TracerSystem module for coordinating tracer events.
 *
 * This provides a central system for recording, filtering, and querying tracer events.
 */

import { EventStore, FilterOptions } from './eventStore';
import {
  TracerEvent,
  TracerEventConstructor,
  LLMCallTracerEvent,
  LLMResponseTracerEvent,
  ToolCallTracerEvent,
  AgentInteractionTracerEvent,
} from './tracerEvents';
import { ToolCall } from '../llm/models';

/**
 * Central system for capturing and querying tracer events.
 *
 * The TracerSystem is responsible for recording events related to LLM calls,
 * tool usage, and agent interactions, providing a way to trace through the
 * major events of the system.
 *
 * @example
 * ```typescript
 * const tracer = new TracerSystem();
 *
 * tracer.recordLlmCall('gpt-4', [Message.user('Hello')], 0.7, undefined, 'corr-123');
 * tracer.recordLlmResponse('gpt-4', 'Hi there!', undefined, 150, 'corr-123');
 *
 * const events = tracer.getEvents();
 * console.log(`Recorded ${events.length} events`);
 * ```
 */
export class TracerSystem {
  private eventStore: EventStore;
  private _enabled: boolean;

  /**
   * Initialize the tracer system.
   *
   * @param eventStore - The event store to use for storing events. If not provided, a new EventStore will be created.
   * @param enabled - Whether the tracer system is enabled. If false, no events will be recorded.
   */
  constructor(eventStore?: EventStore, enabled: boolean = true) {
    this.eventStore = eventStore || new EventStore();
    this._enabled = enabled;
  }

  /**
   * Get whether the tracer system is enabled.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Record a tracer event in the event store.
   *
   * @param event - The tracer event to record
   */
  recordEvent(event: TracerEvent): void {
    if (!this._enabled) {
      return;
    }

    this.eventStore.store(event);
  }

  /**
   * Record an LLM call event.
   *
   * @param model - The name of the LLM model being called
   * @param messages - The messages sent to the LLM
   * @param temperature - The temperature setting for the LLM call
   * @param tools - The tools available to the LLM, if any
   * @param correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param source - The source of the event
   */
  recordLlmCall(
    model: string,
    messages: unknown[],
    temperature: number = 1.0,
    tools?: Record<string, unknown>[],
    correlationId?: string,
    source?: string
  ): void {
    if (!this._enabled) {
      return;
    }

    const event = new LLMCallTracerEvent(
      model,
      messages,
      temperature,
      tools,
      correlationId,
      source
    );
    this.eventStore.store(event);
  }

  /**
   * Record an LLM response event.
   *
   * @param model - The name of the LLM model that responded
   * @param content - The content of the LLM response
   * @param toolCalls - Any tool calls made by the LLM in its response
   * @param callDurationMs - The duration of the LLM call in milliseconds
   * @param correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param source - The source of the event
   */
  recordLlmResponse(
    model: string,
    content: string,
    toolCalls?: ToolCall[],
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ): void {
    if (!this._enabled) {
      return;
    }

    const event = new LLMResponseTracerEvent(
      model,
      content,
      toolCalls,
      callDurationMs,
      correlationId,
      source
    );
    this.eventStore.store(event);
  }

  /**
   * Record a tool call event.
   *
   * @param toolName - The name of the tool being called
   * @param args - The arguments provided to the tool
   * @param result - The result returned by the tool
   * @param caller - The name of the agent or component calling the tool
   * @param callDurationMs - The duration of the tool call in milliseconds
   * @param correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param source - The source of the event
   */
  recordToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    caller?: string,
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ): void {
    if (!this._enabled) {
      return;
    }

    const event = new ToolCallTracerEvent(
      toolName,
      args,
      result,
      caller,
      callDurationMs,
      correlationId,
      source
    );
    this.eventStore.store(event);
  }

  /**
   * Record an agent interaction event.
   *
   * @param fromAgent - The name of the agent sending the event
   * @param toAgent - The name of the agent receiving the event
   * @param eventType - The type of event being processed
   * @param eventId - A unique identifier for the event
   * @param correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param source - The source of the event
   */
  recordAgentInteraction(
    fromAgent: string,
    toAgent: string,
    eventType: string,
    eventId?: string,
    correlationId?: string,
    source?: string
  ): void {
    if (!this._enabled) {
      return;
    }

    const event = new AgentInteractionTracerEvent(
      fromAgent,
      toAgent,
      eventType,
      eventId,
      correlationId,
      source
    );
    this.eventStore.store(event);
  }

  /**
   * Get tracer events from the store, optionally filtered.
   *
   * This is a convenience wrapper around the EventStore's getEvents method,
   * specifically for tracer events.
   *
   * @param options - Filter options for querying events
   * @returns Events that match the filter criteria
   *
   * @example
   * ```typescript
   * // Get all LLM call events
   * const llmCalls = tracer.getEvents({ eventType: LLMCallTracerEvent });
   *
   * // Get events in a time range
   * const recent = tracer.getEvents({
   *   startTime: Date.now() - 60000,
   *   endTime: Date.now()
   * });
   *
   * // Get events with custom filter
   * const filtered = tracer.getEvents({
   *   filterFunc: (e) => e.correlationId === 'my-id'
   * });
   * ```
   */
  getEvents(options: FilterOptions = {}): TracerEvent[] {
    return this.eventStore.getEvents(options);
  }

  /**
   * Get the last N tracer events, optionally filtered by type.
   *
   * @param n - Number of events to return
   * @param eventType - Optional event type to filter by
   * @returns The last N tracer events that match the filter criteria
   *
   * @example
   * ```typescript
   * // Get last 10 events
   * const last10 = tracer.getLastNTracerEvents(10);
   *
   * // Get last 5 LLM response events
   * const last5 = tracer.getLastNTracerEvents(5, LLMResponseTracerEvent);
   * ```
   */
  getLastNTracerEvents(n: number, eventType?: TracerEventConstructor): TracerEvent[] {
    return this.eventStore.getLastNEvents(n, eventType);
  }

  /**
   * Clear all events from the event store.
   */
  clear(): void {
    this.eventStore.clear();
  }

  /**
   * Enable the tracer system.
   */
  enable(): void {
    this._enabled = true;
  }

  /**
   * Disable the tracer system.
   */
  disable(): void {
    this._enabled = false;
  }
}
