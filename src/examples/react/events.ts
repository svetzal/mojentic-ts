/**
 * Event definitions for the ReAct pattern.
 *
 * This module defines all event types used to coordinate the ReAct loop,
 * including thinking, decisioning, tool calls, completion, and failure events.
 */

import { Event } from '../../agents/event';
import { CurrentContext, NextAction } from './models';
import { LlmTool } from '../../llm/tools';

/**
 * Event to trigger the thinking/planning phase.
 *
 * This event initiates the planning process where the agent creates
 * or refines a plan for answering the user's query.
 */
export interface InvokeThinking extends Event {
  type: 'InvokeThinking';
  /** The current context as we work through our response */
  context: CurrentContext;
}

/**
 * Event to trigger the decision-making phase.
 *
 * This event initiates the decision process where the agent evaluates
 * the current plan and history to decide on the next action.
 */
export interface InvokeDecisioning extends Event {
  type: 'InvokeDecisioning';
  /** The current context as we work through our response */
  context: CurrentContext;
}

/**
 * Event to trigger a tool invocation.
 *
 * This event carries the information needed to execute a specific tool
 * with given arguments, along with the reasoning behind the decision.
 */
export interface InvokeToolCall extends Event {
  type: 'InvokeToolCall';
  /** The current context as we work through our response */
  context: CurrentContext;
  /** The reasoning behind the decision */
  thought: string;
  /** The next action type */
  action: NextAction;
  /** The tool instance to invoke */
  tool: LlmTool;
  /** Arguments to pass to the tool */
  toolArguments: Record<string, unknown>;
}

/**
 * Event to trigger the completion and summarization phase.
 *
 * This event indicates that the agent has gathered sufficient information
 * to answer the user's query and should generate a final response.
 */
export interface FinishAndSummarize extends Event {
  type: 'FinishAndSummarize';
  /** The current context as we work through our response */
  context: CurrentContext;
  /** The reasoning behind the decision */
  thought: string;
}

/**
 * Event to signal a failure in the ReAct loop.
 *
 * This event captures errors or unrecoverable situations that prevent
 * the agent from continuing to process the user's query.
 */
export interface FailureOccurred extends Event {
  type: 'FailureOccurred';
  /** The current context as we work through our response */
  context: CurrentContext;
  /** The reason for the failure */
  reason: string;
}
