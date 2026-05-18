/**
 * Tool system for LLM function calling
 */

import { Result } from '../../error';

/**
 * JSON Schema definition for tool parameters
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Function descriptor for tool calling
 */
export interface FunctionDescriptor {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/**
 * Tool descriptor for LLM
 */
export interface ToolDescriptor {
  type: 'function';
  function: FunctionDescriptor;
}

/**
 * Arguments passed to a tool
 */
export type ToolArgs = Record<string, unknown>;

/**
 * Result of a tool execution
 */
export type ToolResult = Record<string, unknown> | string | number | boolean | null;

/**
 * Optional context passed to {@link LlmTool.run} by runners and brokers.
 *
 * The `signal` field is honoured by long-running tools that opt in to
 * cancellation. Tools that ignore the context continue to work unchanged.
 */
export interface ToolRunCtx {
  /** AbortSignal that fires when the broker or runner cancels the batch. */
  signal?: AbortSignal;
}

/**
 * Interface for LLM tools
 */
export interface LlmTool {
  /**
   * Execute the tool with the given arguments.
   *
   * The optional `ctx` parameter carries cancellation information. Tools may
   * ignore it for back-compat; tools that perform long-running work should
   * observe `ctx.signal` so that {@link ParallelToolRunner} or the
   * realtime broker can hard-cancel them on interruption.
   */
  run(args: ToolArgs, ctx?: ToolRunCtx): Promise<Result<ToolResult, Error>>;

  /**
   * Get the tool descriptor for LLM
   */
  descriptor(): ToolDescriptor;

  /**
   * Get the tool name
   */
  name(): string;

  /**
   * Check if tool name matches given name
   */
  matches(name: string): boolean;
}

/**
 * Abstract base class for tools
 */
export abstract class BaseTool implements LlmTool {
  abstract run(args: ToolArgs, ctx?: ToolRunCtx): Promise<Result<ToolResult, Error>>;
  abstract descriptor(): ToolDescriptor;

  name(): string {
    return this.descriptor().function.name;
  }

  matches(name: string): boolean {
    return this.name() === name;
  }
}
