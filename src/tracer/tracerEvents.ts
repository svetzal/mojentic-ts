/**
 * Tracer event types for tracking system interactions.
 *
 * Tracer events are used to track system interactions for observability purposes.
 * They are distinct from regular events which are used for agent communication.
 */

import { randomUUID } from 'crypto';
import { ToolCall } from '../llm/models';

/**
 * Type alias for TracerEvent constructor functions.
 * Uses abstract new to indicate these are class constructors that can be instantiated.
 * The never[] parameter list indicates we don't care about the specific constructor arguments
 * when using this type for filtering/type-checking purposes.
 */
export type TracerEventConstructor = abstract new (...args: never[]) => TracerEvent;

/**
 * Base class for all tracer-specific events.
 *
 * @example
 * ```typescript
 * const event = new LLMCallTracerEvent(
 *   'gpt-4',
 *   [{ role: 'user', content: 'Hello' }],
 *   0.7,
 *   undefined,
 *   'my-correlation-id'
 * );
 * console.log(event.printableSummary());
 * ```
 */
export abstract class TracerEvent {
  /**
   * Timestamp when the event occurred (milliseconds since epoch)
   */
  readonly timestamp: number;

  /**
   * UUID string that is copied from cause-to-effect for tracing events
   */
  readonly correlationId: string;

  /**
   * Source of the event (optional, for context)
   */
  readonly source?: string;

  /**
   * Creates a new tracer event.
   *
   * @param timestamp - Timestamp when the event occurred
   * @param correlationId - UUID for tracing related events
   * @param source - Optional source identifier
   */
  constructor(timestamp: number, correlationId: string, source?: string) {
    this.timestamp = timestamp;
    this.correlationId = correlationId;
    this.source = source;
  }

  /**
   * Set the timestamp for testing purposes only.
   * This method allows tests to manipulate timestamps without type casting.
   *
   * @param timestamp - The timestamp to set (milliseconds since epoch)
   * @throws Error if called outside of test environment
   *
   * @internal This method is only for testing and should not be used in production code.
   */
  setTimestampForTesting(timestamp: number): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('setTimestampForTesting can only be called in test environment');
    }
    // Using Object.defineProperty to modify the readonly property
    Object.defineProperty(this, 'timestamp', {
      value: timestamp,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Return a formatted string summary of the event.
   *
   * @returns A formatted string with the event information
   */
  printableSummary(): string {
    const eventTime = new Date(this.timestamp).toTimeString().split(' ')[0];
    const ms = String(this.timestamp % 1000).padStart(3, '0');
    return `[${eventTime}.${ms}] ${this.constructor.name} (correlation_id: ${this.correlationId})`;
  }
}

/**
 * Records when an LLM is called with specific messages.
 *
 * @example
 * ```typescript
 * const event = new LLMCallTracerEvent(
 *   'gpt-4',
 *   [Message.user('Hello')],
 *   0.7,
 *   [dateTool.descriptor()],
 *   'corr-123'
 * );
 * ```
 */
export class LLMCallTracerEvent extends TracerEvent {
  /**
   * The LLM model that was used
   */
  readonly model: string;

  /**
   * The messages sent to the LLM
   */
  readonly messages: unknown[];

  /**
   * The temperature setting used for the call
   */
  readonly temperature: number;

  /**
   * The tools available to the LLM, if any
   */
  readonly tools?: Record<string, unknown>[];

  constructor(
    model: string,
    messages: unknown[],
    temperature: number = 1.0,
    tools?: Record<string, unknown>[],
    correlationId?: string,
    source?: string
  ) {
    super(Date.now(), correlationId || randomUUID(), source);
    this.model = model;
    this.messages = messages;
    this.temperature = temperature;
    this.tools = tools;
  }

  printableSummary(): string {
    const baseSummary = super.printableSummary();
    let summary = `${baseSummary}\n   Model: ${this.model}`;

    if (this.messages.length > 0) {
      const msgCount = this.messages.length;
      summary += `\n   Messages: ${msgCount} message${msgCount !== 1 ? 's' : ''}`;
    }

    if (this.temperature !== 1.0) {
      summary += `\n   Temperature: ${this.temperature}`;
    }

    if (this.tools && this.tools.length > 0) {
      const toolNames = this.tools
        .map((t) => (t.function as { name?: string })?.name || 'unknown')
        .join(', ');
      summary += `\n   Available Tools: ${toolNames}`;
    }

    return summary;
  }
}

/**
 * Records when an LLM responds to a call.
 *
 * @example
 * ```typescript
 * const event = new LLMResponseTracerEvent(
 *   'gpt-4',
 *   'Hello! How can I help?',
 *   undefined,
 *   150.5,
 *   'corr-123'
 * );
 * ```
 */
export class LLMResponseTracerEvent extends TracerEvent {
  /**
   * The LLM model that was used
   */
  readonly model: string;

  /**
   * The content of the LLM response
   */
  readonly content: string;

  /**
   * Any tool calls made by the LLM
   */
  readonly toolCalls?: ToolCall[];

  /**
   * Duration of the LLM call in milliseconds
   */
  readonly callDurationMs?: number;

  constructor(
    model: string,
    content: string,
    toolCalls?: ToolCall[],
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ) {
    super(Date.now(), correlationId || randomUUID(), source);
    this.model = model;
    this.content = content;
    this.toolCalls = toolCalls;
    this.callDurationMs = callDurationMs;
  }

  printableSummary(): string {
    const baseSummary = super.printableSummary();
    let summary = `${baseSummary}\n   Model: ${this.model}`;

    if (this.content) {
      const contentPreview =
        this.content.length > 100 ? this.content.substring(0, 100) + '...' : this.content;
      summary += `\n   Content: ${contentPreview}`;
    }

    if (this.toolCalls && this.toolCalls.length > 0) {
      const toolCount = this.toolCalls.length;
      summary += `\n   Tool Calls: ${toolCount} call${toolCount !== 1 ? 's' : ''}`;
    }

    if (this.callDurationMs !== undefined) {
      summary += `\n   Duration: ${this.callDurationMs.toFixed(2)}ms`;
    }

    return summary;
  }
}

/**
 * Records when a tool is called during agent execution.
 *
 * @example
 * ```typescript
 * const event = new ToolCallTracerEvent(
 *   'resolve_date',
 *   { date_string: 'tomorrow' },
 *   { resolved: '2025-11-16' },
 *   'my-agent',
 *   25.3,
 *   'corr-123'
 * );
 * ```
 */
export class ToolCallTracerEvent extends TracerEvent {
  /**
   * Name of the tool that was called
   */
  readonly toolName: string;

  /**
   * Arguments provided to the tool
   */
  readonly arguments: Record<string, unknown>;

  /**
   * Result returned by the tool
   */
  readonly result: unknown;

  /**
   * Name of the agent or component that called the tool
   */
  readonly caller?: string;

  /**
   * Duration of the tool call in milliseconds
   */
  readonly callDurationMs?: number;

  constructor(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    caller?: string,
    callDurationMs?: number,
    correlationId?: string,
    source?: string
  ) {
    super(Date.now(), correlationId || randomUUID(), source);
    this.toolName = toolName;
    this.arguments = args;
    this.result = result;
    this.caller = caller;
    this.callDurationMs = callDurationMs;
  }

  printableSummary(): string {
    const baseSummary = super.printableSummary();
    let summary = `${baseSummary}\n   Tool: ${this.toolName}`;

    if (Object.keys(this.arguments).length > 0) {
      summary += `\n   Arguments: ${JSON.stringify(this.arguments)}`;
    }

    if (this.result !== undefined) {
      const resultStr = JSON.stringify(this.result);
      const resultPreview =
        resultStr.length > 100 ? resultStr.substring(0, 100) + '...' : resultStr;
      summary += `\n   Result: ${resultPreview}`;
    }

    if (this.caller) {
      summary += `\n   Caller: ${this.caller}`;
    }

    if (this.callDurationMs !== undefined) {
      summary += `\n   Duration: ${this.callDurationMs.toFixed(2)}ms`;
    }

    return summary;
  }
}

/**
 * Records interactions between agents.
 *
 * @example
 * ```typescript
 * const event = new AgentInteractionTracerEvent(
 *   'coordinator',
 *   'specialist',
 *   'task_request',
 *   'event-456',
 *   'corr-123'
 * );
 * ```
 */
export class AgentInteractionTracerEvent extends TracerEvent {
  /**
   * Name of the agent sending the event
   */
  readonly fromAgent: string;

  /**
   * Name of the agent receiving the event
   */
  readonly toAgent: string;

  /**
   * Type of event being processed
   */
  readonly eventType: string;

  /**
   * Unique identifier for the event
   */
  readonly eventId?: string;

  constructor(
    fromAgent: string,
    toAgent: string,
    eventType: string,
    eventId?: string,
    correlationId?: string,
    source?: string
  ) {
    super(Date.now(), correlationId || randomUUID(), source);
    this.fromAgent = fromAgent;
    this.toAgent = toAgent;
    this.eventType = eventType;
    this.eventId = eventId;
  }

  printableSummary(): string {
    const baseSummary = super.printableSummary();
    let summary = `${baseSummary}\n   From: ${this.fromAgent} → To: ${this.toAgent}`;
    summary += `\n   Event Type: ${this.eventType}`;

    if (this.eventId) {
      summary += `\n   Event ID: ${this.eventId}`;
    }

    return summary;
  }
}
