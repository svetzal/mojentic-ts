/**
 * Formatting utilities for the ReAct pattern implementation.
 *
 * This module provides helper functions for formatting context and tool information
 * into human-readable strings for LLM prompts.
 */

import { CurrentContext } from './models';
import { LlmTool } from '../../llm/tools';

/**
 * Format the current context into a readable string.
 *
 * @param context - The current context containing query, plan, and history
 * @returns A formatted multi-line string describing the current context
 */
export function formatCurrentContext(context: CurrentContext): string {
  const userQuery = `The user has asked us to answer the following query:\n> ${context.userQuery}\n`;

  let plan = 'You have not yet made a plan.\n';
  if (context.plan.steps.length > 0) {
    plan = 'Current plan:\n';
    plan += context.plan.steps.map((step) => `- ${step}`).join('\n');
    plan += '\n';
  }

  let history = 'No steps have yet been taken.\n';
  if (context.history.length > 0) {
    history = "What's been done so far:\n";
    history += context.history
      .map(
        (step, i) =>
          `${i + 1}.\n    Thought: ${step.thought}\n    Action: ${step.action}\n    Observation: ${step.observation}`
      )
      .join('\n');
    history += '\n';
  }

  return `Current Context:\n${userQuery}${plan}${history}\n`;
}

/**
 * Format the available tools into a readable list.
 *
 * @param tools - A list of tool objects with descriptor methods
 * @returns A formatted string listing available tools and their descriptions
 */
export function formatAvailableTools(tools: LlmTool[]): string {
  let output = '';

  if (tools.length > 0) {
    output += 'Tools available:\n';

    for (const tool of tools) {
      const descriptor = tool.descriptor();
      const funcDescriptor = descriptor.function;

      output += `- ${funcDescriptor.name}: ${funcDescriptor.description}\n`;

      // Add parameter information
      if (funcDescriptor.parameters) {
        const params = funcDescriptor.parameters as Record<string, unknown>;
        if (params.properties) {
          output += '  Parameters:\n';
          const properties = params.properties as Record<string, Record<string, unknown>>;
          const required = (params.required as string[]) || [];

          for (const [paramName, paramInfo] of Object.entries(properties)) {
            const paramDesc = paramInfo.description || '';
            const isRequired = required.includes(paramName);
            const reqStr = isRequired ? ' (required)' : ' (optional)';
            output += `    - ${paramName}${reqStr}: ${paramDesc}\n`;
          }
        }
      }
    }
  }

  return output;
}
