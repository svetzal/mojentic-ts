/**
 * NullTracer implementation to eliminate conditional checks in the code.
 *
 * This module provides a NullTracer that implements the same interface as TracerSystem
 * but performs no operations, following the Null Object Pattern.
 */

import { TracerEvent, TracerEventConstructor } from './tracerEvents';
import { ToolCall } from '../llm/models';
import { FilterOptions } from './eventStore';

/**
 * A no-op implementation of TracerSystem that silently discards all tracing operations.
 *
 * This class follows the Null Object Pattern to eliminate conditional checks in client code.
 * All record methods are overridden to do nothing, and all query methods return empty results.
 *
 * @example
 * ```typescript
 * import { nullTracer } from './tracer';
 *
 * // Use nullTracer when you don't want any tracing
 * const broker = new LlmBroker('gpt-4', gateway, nullTracer);
 *
 * // All tracer methods are no-ops
 * nullTracer.recordLlmCall('gpt-4', [], 0.7);
 * console.log(nullTracer.getEvents()); // []
 * ```
 */
export class NullTracer {
  /**
   * Always false for NullTracer
   */
  readonly enabled: boolean = false;

  /**
   * Always undefined for NullTracer
   */
  readonly eventStore = undefined;

  /**
   * Do nothing implementation of recordEvent.
   *
   * @param _event - The tracer event to record (will be ignored)
   */
  recordEvent(_event: TracerEvent): void {
    // Do nothing
  }

  /**
   * Do nothing implementation of recordLlmCall.
   *
   * @param _model - The name of the LLM model being called
   * @param _messages - The messages sent to the LLM
   * @param _temperature - The temperature setting for the LLM call
   * @param _tools - The tools available to the LLM, if any
   * @param _correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param _source - The source of the event
   */
  recordLlmCall(
    _model: string,
    _messages: unknown[],
    _temperature?: number,
    _tools?: Record<string, unknown>[],
    _correlationId?: string,
    _source?: string
  ): void {
    // Do nothing
  }

  /**
   * Do nothing implementation of recordLlmResponse.
   *
   * @param _model - The name of the LLM model that responded
   * @param _content - The content of the LLM response
   * @param _toolCalls - Any tool calls made by the LLM in its response
   * @param _callDurationMs - The duration of the LLM call in milliseconds
   * @param _correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param _source - The source of the event
   */
  recordLlmResponse(
    _model: string,
    _content: string,
    _toolCalls?: ToolCall[],
    _callDurationMs?: number,
    _correlationId?: string,
    _source?: string
  ): void {
    // Do nothing
  }

  /**
   * Do nothing implementation of recordToolCall.
   *
   * @param _toolName - The name of the tool being called
   * @param _args - The arguments provided to the tool
   * @param _result - The result returned by the tool
   * @param _caller - The name of the agent or component calling the tool
   * @param _callDurationMs - The duration of the tool call in milliseconds
   * @param _correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param _source - The source of the event
   */
  recordToolCall(
    _toolName: string,
    _args: Record<string, unknown>,
    _result: unknown,
    _caller?: string,
    _callDurationMs?: number,
    _correlationId?: string,
    _source?: string
  ): void {
    // Do nothing
  }

  /**
   * Do nothing implementation of recordAgentInteraction.
   *
   * @param _fromAgent - The name of the agent sending the event
   * @param _toAgent - The name of the agent receiving the event
   * @param _eventType - The type of event being processed
   * @param _eventId - A unique identifier for the event
   * @param _correlationId - UUID string that is copied from cause-to-effect for tracing events
   * @param _source - The source of the event
   */
  recordAgentInteraction(
    _fromAgent: string,
    _toAgent: string,
    _eventType: string,
    _eventId?: string,
    _correlationId?: string,
    _source?: string
  ): void {
    // Do nothing
  }

  /**
   * Return an empty array for any getEvents request.
   *
   * @param _options - Filter options (ignored)
   * @returns An empty array
   */
  getEvents(_options?: FilterOptions): TracerEvent[] {
    return [];
  }

  /**
   * Return an empty array for any getLastNTracerEvents request.
   *
   * @param _n - Number of events to return (ignored)
   * @param _eventType - Optional event type to filter by (ignored)
   * @returns An empty array
   */
  getLastNTracerEvents(_n: number, _eventType?: TracerEventConstructor): TracerEvent[] {
    return [];
  }

  /**
   * Do nothing implementation of clear method.
   */
  clear(): void {
    // Do nothing
  }

  /**
   * No-op method for interface compatibility.
   */
  enable(): void {
    // Do nothing
  }

  /**
   * No-op method for interface compatibility.
   */
  disable(): void {
    // Do nothing
  }
}

/**
 * Singleton null tracer instance for convenient use across the application.
 *
 * @example
 * ```typescript
 * import { nullTracer } from './tracer';
 *
 * const broker = new LlmBroker('gpt-4', gateway, nullTracer);
 * ```
 */
export const nullTracer = new NullTracer();
