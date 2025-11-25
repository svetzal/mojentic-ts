/**
 * Tool execution agent for the ReAct pattern.
 *
 * This agent handles the actual execution of tools and captures the results.
 */

import { BaseAsyncAgent } from '../../agents/base-async-agent';
import { Event } from '../../agents/event';
import { Result, Ok, isOk } from '../../error';
import { InvokeToolCall, InvokeDecisioning, FailureOccurred } from './events';
import { ThoughtActionObservation } from './models';

/**
 * Agent responsible for executing tool calls.
 *
 * This agent receives tool call events, executes the specified tool,
 * and updates the context with the results before continuing to the
 * decisioning phase.
 */
export class ToolCallAgent implements BaseAsyncAgent {
  /**
   * Execute a tool and update the context.
   *
   * @param event - The tool call event containing the tool and arguments
   * @returns Result containing InvokeDecisioning event with updated context, or FailureOccurred on error
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type !== 'InvokeToolCall') {
      return Ok([]);
    }

    const toolCallEvent = event as InvokeToolCall;

    try {
      const tool = toolCallEvent.tool;
      const toolName = tool.descriptor().function.name;
      const args = toolCallEvent.toolArguments;

      console.log(`\nExecuting tool: ${toolName}`);
      console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);

      // Execute the tool
      const result = await tool.run(args);

      if (!isOk(result)) {
        return Ok([
          {
            type: 'FailureOccurred',
            source: 'ToolCallAgent',
            context: toolCallEvent.context,
            reason: `Tool execution failed: ${result.error.message}`,
            correlationId: event.correlationId,
          } as FailureOccurred,
        ]);
      }

      const toolResult = result.value;
      console.log(`Result: ${JSON.stringify(toolResult, null, 2)}`);

      // Extract the text content from the result
      const resultText = JSON.stringify(toolResult);

      // Add to history
      toolCallEvent.context.history.push({
        thought: toolCallEvent.thought,
        action: `Called ${toolName} with ${JSON.stringify(args)}`,
        observation: resultText,
      } as ThoughtActionObservation);

      // Continue to decisioning
      return Ok([
        {
          type: 'InvokeDecisioning',
          source: 'ToolCallAgent',
          context: toolCallEvent.context,
          correlationId: event.correlationId,
        } as InvokeDecisioning,
      ]);
    } catch (error) {
      console.error('Tool execution error:', error);
      return Ok([
        {
          type: 'FailureOccurred',
          source: 'ToolCallAgent',
          context: toolCallEvent.context,
          reason: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
          correlationId: event.correlationId,
        } as FailureOccurred,
      ]);
    }
  }
}
