/**
 * Event store for capturing and querying tracer events.
 */

import { TracerEvent, TracerEventConstructor } from './tracerEvents';

/**
 * Filter options for querying events.
 */
export interface FilterOptions {
  /**
   * Filter events by this specific event type
   */
  eventType?: TracerEventConstructor;

  /**
   * Include events with timestamp >= startTime
   */
  startTime?: number;

  /**
   * Include events with timestamp <= endTime
   */
  endTime?: number;

  /**
   * Custom filter function to apply to events
   */
  filterFunc?: (event: TracerEvent) => boolean;
}

/**
 * Store for capturing and querying events, particularly useful for tracer events.
 *
 * @example
 * ```typescript
 * const store = new EventStore((event) => {
 *   console.log('Event stored:', event.constructor.name);
 * });
 *
 * store.store(new LLMCallTracerEvent('gpt-4', [], 0.7));
 * const events = store.getEvents();
 * ```
 */
export class EventStore {
  private events: TracerEvent[] = [];
  private onStoreCallback?: (event: TracerEvent) => void;

  /**
   * Initialize an EventStore.
   *
   * @param onStoreCallback - A callback function that will be called whenever an event is stored.
   *                         The callback receives the stored event as its argument.
   */
  constructor(onStoreCallback?: (event: TracerEvent) => void) {
    this.onStoreCallback = onStoreCallback;
  }

  /**
   * Store an event in the event store.
   *
   * @param event - The event to store
   */
  store(event: TracerEvent): void {
    this.events.push(event);

    // Call the callback if it exists
    if (this.onStoreCallback) {
      this.onStoreCallback(event);
    }
  }

  /**
   * Get events from the store, optionally filtered by type, time range, and custom filter function.
   *
   * @param options - Filter options for querying events
   * @returns Events that match the filter criteria
   *
   * @example
   * ```typescript
   * // Get all LLM call events
   * const llmCalls = store.getEvents({ eventType: LLMCallTracerEvent });
   *
   * // Get events in a time range
   * const recent = store.getEvents({
   *   startTime: Date.now() - 60000,
   *   endTime: Date.now()
   * });
   *
   * // Get events with custom filter
   * const filtered = store.getEvents({
   *   filterFunc: (e) => e.correlationId === 'my-id'
   * });
   * ```
   */
  getEvents(options: FilterOptions = {}): TracerEvent[] {
    let result = [...this.events];

    // Filter by event type if specified
    const { eventType } = options;
    if (eventType) {
      result = result.filter((e) => e instanceof eventType);
    }

    // Filter by time range
    const { startTime } = options;
    if (startTime !== undefined) {
      result = result.filter((e) => e.timestamp >= startTime);
    }

    const { endTime } = options;
    if (endTime !== undefined) {
      result = result.filter((e) => e.timestamp <= endTime);
    }

    // Apply custom filter function if provided
    if (options.filterFunc) {
      result = result.filter(options.filterFunc);
    }

    return result;
  }

  /**
   * Clear all events from the store.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get the last N events, optionally filtered by type.
   *
   * @param n - Number of events to return
   * @param eventType - Optional event type to filter by
   * @returns The last N events that match the filter criteria
   *
   * @example
   * ```typescript
   * // Get last 10 events
   * const last10 = store.getLastNEvents(10);
   *
   * // Get last 5 LLM response events
   * const last5Responses = store.getLastNEvents(5, LLMResponseTracerEvent);
   * ```
   */
  getLastNEvents(n: number, eventType?: TracerEventConstructor): TracerEvent[] {
    let filtered = this.events;

    if (eventType) {
      filtered = filtered.filter((e) => e instanceof eventType);
    }

    return filtered.slice(-n);
  }
}
