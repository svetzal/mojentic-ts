/**
 * Summarization agent for the ReAct pattern.
 *
 * This agent generates the final answer based on accumulated context.
 */

import { BaseAsyncAgent } from '../../agents/base-async-agent';
import { Event } from '../../agents/event';
import { Result, Ok, isOk } from '../../error';
import { LlmBroker } from '../../llm/broker';
import { Message } from '../../llm/models';
import { FinishAndSummarize, FailureOccurred } from './events';
import { formatCurrentContext } from './formatters';

/**
 * Agent responsible for generating the final answer.
 *
 * This agent reviews the context, plan, and history to synthesize
 * a complete answer to the user's original query.
 */
export class SummarizationAgent implements BaseAsyncAgent {
  /**
   * Initialize the summarization agent.
   *
   * @param llm - The LLM broker to use for generating summaries
   */
  constructor(private readonly llm: LlmBroker) {}

  /**
   * Generate a final answer based on the context.
   *
   * @param event - The finish event containing the complete context
   * @returns Empty array (terminal event) or array with FailureOccurred on error
   */
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (event.type !== 'FinishAndSummarize') {
      return Ok([]);
    }

    const finishEvent = event as FinishAndSummarize;

    try {
      const prompt = this.buildPrompt(finishEvent);
      console.log(this.formatBlock(prompt));

      const result = await this.llm.generate([Message.user(prompt)]);

      if (!isOk(result)) {
        return Ok([
          {
            type: 'FailureOccurred',
            source: 'SummarizationAgent',
            context: finishEvent.context,
            reason: `Error during summarization: ${result.error.message}`,
            correlationId: event.correlationId,
          } as FailureOccurred,
        ]);
      }

      const response = result.value;

      console.log('\n' + '='.repeat(80));
      console.log('FINAL ANSWER:');
      console.log('='.repeat(80));
      console.log(response);
      console.log('='.repeat(80) + '\n');

      // This is a terminal event - return empty list to stop the loop
      return Ok([]);
    } catch (error) {
      return Ok([
        {
          type: 'FailureOccurred',
          source: 'SummarizationAgent',
          context: finishEvent.context,
          reason: `Error during summarization: ${error instanceof Error ? error.message : String(error)}`,
          correlationId: event.correlationId,
        } as FailureOccurred,
      ]);
    }
  }

  /**
   * Generate the prompt for the summarization LLM.
   *
   * @param event - The finish event containing the complete context
   * @returns The formatted prompt string
   */
  private buildPrompt(event: FinishAndSummarize): string {
    return `Based on the following context, provide a clear and concise answer to the user's query.

${formatCurrentContext(event.context)}

Your task:
Review what we've learned and provide a direct answer to: "${event.context.userQuery}"

Be specific and use the information gathered during our process.`;
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
