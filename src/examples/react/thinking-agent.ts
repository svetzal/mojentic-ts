/**
 * Planning agent for the ReAct pattern.
 *
 * This agent creates structured plans for solving user queries.
 */

import { BaseAsyncAgent } from '../../agents/base-async-agent';
import { Event } from '../../agents/event';
import { Result, Ok } from '../../error';
import { LlmBroker } from '../../llm/broker';
import { Message } from '../../llm/models';
import { DateResolverTool } from '../../llm/tools/date-resolver';
import { InvokeThinking, InvokeDecisioning, FailureOccurred } from './events';
import { Plan, ThoughtActionObservation } from './models';
import { formatCurrentContext, formatAvailableTools } from './formatters';
import { LlmTool } from '../../llm/tools';

/**
 * Agent responsible for creating plans in the ReAct loop.
 *
 * This agent analyzes the user query and available tools to create
 * a step-by-step plan for answering the query.
 */
export class ThinkingAgent implements BaseAsyncAgent {
  private readonly tools: LlmTool[];

  /**
   * Initialize the thinking agent.
   *
   * @param llm - The LLM broker to use for generating plans
   */
  constructor(private readonly llm: LlmBroker) {
    this.tools = [new DateResolverTool()];
  }

  /**
   * Process a thinking event and generate a plan.
   *
   * @param event - The thinking event containing current context
   * @returns Result containing InvokeDecisioning event with updated plan, or FailureOccurred on error
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type !== 'InvokeThinking') {
      return Ok([]);
    }

    const thinkingEvent = event as InvokeThinking;

    try {
      const prompt = this.buildPrompt(thinkingEvent);
      console.log(this.formatBlock(prompt));

      // Define schema for Plan object
      const schema = {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: { type: 'string' },
            description:
              'How to answer the query, step by step, each step outlining an action to take',
          },
        },
        required: ['steps'],
      };

      const result = await this.llm.generateObject<Plan>([Message.user(prompt)], schema);

      if (!result.ok) {
        return Ok([
          {
            type: 'FailureOccurred',
            source: 'ThinkingAgent',
            context: thinkingEvent.context,
            reason: `Error during planning: ${result.error.message}`,
            correlationId: event.correlationId,
          } as FailureOccurred,
        ]);
      }

      const plan = result.value;
      console.log(this.formatBlock(JSON.stringify(plan, null, 2)));

      // Update context with new plan
      thinkingEvent.context.plan = plan;

      // Add planning step to history
      thinkingEvent.context.history.push({
        thought: 'I need to create a plan to solve this query.',
        action: 'Created a step-by-step plan.',
        observation: `Plan has ${plan.steps.length} steps.`,
      } as ThoughtActionObservation);

      return Ok([
        {
          type: 'InvokeDecisioning',
          source: 'ThinkingAgent',
          context: thinkingEvent.context,
          correlationId: event.correlationId,
        } as InvokeDecisioning,
      ]);
    } catch (error) {
      return Ok([
        {
          type: 'FailureOccurred',
          source: 'ThinkingAgent',
          context: thinkingEvent.context,
          reason: `Error during planning: ${error instanceof Error ? error.message : String(error)}`,
          correlationId: event.correlationId,
        } as FailureOccurred,
      ]);
    }
  }

  /**
   * Generate the prompt for the planning LLM.
   *
   * @param event - The thinking event containing current context
   * @returns The formatted prompt string
   */
  private buildPrompt(event: InvokeThinking): string {
    return `You are to solve a problem by reasoning and acting on the information you have. Here is the current context:

${formatCurrentContext(event.context)}
${formatAvailableTools(this.tools)}

Your Instructions:
Given our context and what we've done so far, and the tools available, create a step-by-step plan to answer the query.
Each step should be concrete and actionable. Consider which tools you'll need to use.`;
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
