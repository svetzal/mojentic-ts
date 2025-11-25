/**
 * Decision-making agent for the ReAct pattern.
 *
 * This agent evaluates the current context and decides on the next action to take.
 */

import { BaseAsyncAgent } from '../../agents/base-async-agent';
import { Event } from '../../agents/event';
import { Result, Ok } from '../../error';
import { LlmBroker } from '../../llm/broker';
import { Message } from '../../llm/models';
import { DateResolverTool } from '../../llm/tools/date-resolver';
import {
  InvokeDecisioning,
  InvokeThinking,
  InvokeToolCall,
  FinishAndSummarize,
  FailureOccurred,
} from './events';
import { NextAction } from './models';
import { formatCurrentContext, formatAvailableTools } from './formatters';
import { LlmTool } from '../../llm/tools';

/**
 * Structured response from the decisioning agent.
 */
interface DecisionResponse {
  /** The reasoning behind the decision */
  thought: string;
  /** What should happen next: PLAN, ACT, or FINISH */
  nextAction: NextAction;
  /** Name of tool to use if nextAction is ACT */
  toolName?: string;
  /** Arguments for the tool if nextAction is ACT */
  toolArguments?: Record<string, unknown>;
}

/**
 * Agent responsible for deciding the next action in the ReAct loop.
 *
 * This agent evaluates the current context, plan, and history to determine
 * whether to continue planning, take an action, or finish and summarize.
 */
export class DecisioningAgent implements BaseAsyncAgent {
  private static readonly MAX_ITERATIONS = 10;
  private readonly tools: LlmTool[];

  /**
   * Initialize the decisioning agent.
   *
   * @param llm - The LLM broker to use for generating decisions
   */
  constructor(private readonly llm: LlmBroker) {
    this.tools = [new DateResolverTool()];
  }

  /**
   * Process a decisioning event and determine the next action.
   *
   * @param event - The decisioning event containing current context
   * @returns Result containing one of: InvokeToolCall, FinishAndSummarize, InvokeThinking, or FailureOccurred event
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type !== 'InvokeDecisioning') {
      return Ok([]);
    }

    const decisioningEvent = event as InvokeDecisioning;

    // Check iteration limit
    if (decisioningEvent.context.iteration >= DecisioningAgent.MAX_ITERATIONS) {
      return Ok([
        {
          type: 'FailureOccurred',
          source: 'DecisioningAgent',
          context: decisioningEvent.context,
          reason: `Maximum iterations (${DecisioningAgent.MAX_ITERATIONS}) exceeded`,
          correlationId: event.correlationId,
        } as FailureOccurred,
      ]);
    }

    // Increment iteration counter
    decisioningEvent.context.iteration += 1;

    const prompt = this.buildPrompt(decisioningEvent);
    console.log(this.formatBlock(prompt));

    try {
      // Define schema for DecisionResponse
      const schema = {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'The reasoning behind the decision',
          },
          nextAction: {
            type: 'string',
            description: 'What should happen next: PLAN, ACT, or FINISH',
            enum: ['PLAN', 'ACT', 'FINISH'],
          },
          toolName: {
            type: 'string',
            description: 'Name of tool to use if nextAction is ACT',
          },
          toolArguments: {
            type: 'object',
            description:
              'Arguments for the tool if nextAction is ACT. IMPORTANT: Use the exact parameter names from the tool descriptor. For resolve_date, use "date_string" not "relative_date_found".',
          },
        },
        required: ['thought', 'nextAction'],
      };

      const result = await this.llm.generateObject<DecisionResponse>([Message.user(prompt)], schema);

      if (!result.ok) {
        return Ok([
          {
            type: 'FailureOccurred',
            source: 'DecisioningAgent',
            context: decisioningEvent.context,
            reason: `Error during decision making: ${result.error.message}`,
            correlationId: event.correlationId,
          } as FailureOccurred,
        ]);
      }

      const decision = result.value;
      console.log(this.formatBlock(`Decision: ${JSON.stringify(decision, null, 2)}`));

      // Route based on decision
      if (decision.nextAction === NextAction.FINISH) {
        return Ok([
          {
            type: 'FinishAndSummarize',
            source: 'DecisioningAgent',
            context: decisioningEvent.context,
            thought: decision.thought,
            correlationId: event.correlationId,
          } as FinishAndSummarize,
        ]);
      }

      if (decision.nextAction === NextAction.ACT) {
        if (!decision.toolName) {
          return Ok([
            {
              type: 'FailureOccurred',
              source: 'DecisioningAgent',
              context: decisioningEvent.context,
              reason: 'ACT decision made but no tool specified',
              correlationId: event.correlationId,
            } as FailureOccurred,
          ]);
        }

        // Find the requested tool
        const tool = this.tools.find(
          (t) => t.descriptor().function.name === decision.toolName
        );

        if (!tool) {
          return Ok([
            {
              type: 'FailureOccurred',
              source: 'DecisioningAgent',
              context: decisioningEvent.context,
              reason: `Tool '${decision.toolName}' not found`,
              correlationId: event.correlationId,
            } as FailureOccurred,
          ]);
        }

        return Ok([
          {
            type: 'InvokeToolCall',
            source: 'DecisioningAgent',
            context: decisioningEvent.context,
            thought: decision.thought,
            action: NextAction.ACT,
            tool,
            toolArguments: decision.toolArguments || {},
            correlationId: event.correlationId,
          } as InvokeToolCall,
        ]);
      }

      // PLAN action - go back to thinking
      return Ok([
        {
          type: 'InvokeThinking',
          source: 'DecisioningAgent',
          context: decisioningEvent.context,
          correlationId: event.correlationId,
        } as InvokeThinking,
      ]);
    } catch (error) {
      return Ok([
        {
          type: 'FailureOccurred',
          source: 'DecisioningAgent',
          context: decisioningEvent.context,
          reason: `Error during decision making: ${error instanceof Error ? error.message : String(error)}`,
          correlationId: event.correlationId,
        } as FailureOccurred,
      ]);
    }
  }

  /**
   * Generate the prompt for the decision-making LLM.
   *
   * @param event - The decisioning event containing current context
   * @returns The formatted prompt string
   */
  private buildPrompt(event: InvokeDecisioning): string {
    return `You are to solve a problem by reasoning and acting on the information you have. Here is the current context:

${formatCurrentContext(event.context)}
${formatAvailableTools(this.tools)}

Your Instructions:
Review the current plan and history. Decide what to do next:

1. PLAN - If the plan is incomplete or needs refinement
2. ACT - If you should take an action using one of the available tools
3. FINISH - If you have enough information to answer the user's query

If you choose ACT, specify which tool to use and what arguments to pass.
Think carefully about whether each step in the plan has been completed.`;
  }

  /**
   * Format a text block with separators for visual clarity.
   *
   * @param text - The text to format
   * @returns Formatted text with separator lines
   */
  private formatBlock(text: string): string {
    return `\n${'='.repeat(80)}\n${text}\n${'='.repeat(80)}\n`;
  }
}
