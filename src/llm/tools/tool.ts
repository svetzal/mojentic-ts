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
 * Interface for LLM tools
 */
export interface LlmTool {
  /**
   * Execute the tool with the given arguments
   */
  run(args: ToolArgs): Promise<Result<ToolResult, Error>>;

  /**
   * Get the tool descriptor for LLM
   */
  descriptor(): ToolDescriptor;

  /**
   * Get the tool name
   */
  name(): string;
}

/**
 * Abstract base class for tools
 */
export abstract class BaseTool implements LlmTool {
  abstract run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  abstract descriptor(): ToolDescriptor;

  name(): string {
    return this.descriptor().function.name;
  }
}
