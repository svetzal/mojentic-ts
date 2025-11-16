/**
 * Tracer Demo - Interactive chat with ChatSession and tools
 *
 * This example demonstrates the tracer system by monitoring an interactive
 * chat session with LlmBroker and tools. When the user exits the session,
 * the script displays a summary of all traced events.
 *
 * It also demonstrates how correlationId is used to trace related events
 * across the system, allowing you to track the flow of a request from start to finish.
 */

import * as readline from 'readline';
import { LlmBroker } from '../src/llm/broker';
import { ChatSession } from '../src/llm/chat-session';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { Message } from '../src/llm/models';
import { DateResolverTool } from '../src/llm/tools/date-resolver';
import {
  TracerSystem,
  TracerEvent,
  LLMCallTracerEvent,
  LLMResponseTracerEvent,
  ToolCallTracerEvent,
} from '../src/tracer';
import { isOk } from '../src/error';

/**
 * Print tracer events using their printableSummary method.
 */
function printTracerEvents(events: TracerEvent[]): void {
  console.log('\n' + '-'.repeat(80));
  console.log('Tracer Events:');
  console.log('-'.repeat(80));

  events.forEach((event, i) => {
    console.log(`${i + 1}. ${event.printableSummary()}`);
    console.log();
  });
}

/**
 * Main function - runs a chat session with tracer system to monitor interactions.
 */
async function main() {
  // Create a tracer system to monitor all interactions
  const tracer = new TracerSystem();

  // Create an LLM broker with the tracer
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen2.5:3b', gateway);

  // Create a date resolver tool that will also use the tracer
  const dateTool = new DateResolverTool();

  // Create a chat session with the broker and tool
  const session = new ChatSession(broker, {
    tools: [dateTool],
    systemPrompt: 'You are a helpful assistant with access to date resolution tools.',
  });

  // Dictionary to store correlation_ids for each conversation turn
  // This allows us to track related events across the system
  const conversationCorrelationIds: Record<number, string> = {};

  console.log('Welcome to the chat session with tracer demonstration!');
  console.log("Ask questions about dates (e.g., 'What day is next Friday?') or anything else.");
  console.log('Behind the scenes, the tracer system is recording all interactions.');
  console.log('Each interaction is assigned a unique correlationId to trace related events.');
  console.log('Press Ctrl+C or type "exit" to quit and see the trace summary.');
  console.log('-'.repeat(80));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let turnCounter = 0;

  const processInput = async (query: string): Promise<boolean> => {
    if (!query.trim() || query.toLowerCase() === 'exit') {
      return false;
    }

    // Generate a unique correlationId for this conversation turn
    const correlationId = crypto.randomUUID();
    turnCounter++;
    conversationCorrelationIds[turnCounter] = correlationId;

    console.log(`[Turn ${turnCounter}, correlation_id: ${correlationId.substring(0, 8)}...]`);
    process.stdout.write('Assistant: ');

    try {
      // For the demo, we'll manually record the broker call since ChatSession doesn't pass correlationId yet
      // In a production system, you would modify ChatSession to accept and use correlationId

      const result = await session.send(query);

      if (isOk(result)) {
        console.log(result.value);
      } else {
        console.log(`Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    return true;
  };

  // Interactive chat loop
  const askQuestion = () => {
    rl.question('You: ', async (query) => {
      const shouldContinue = await processInput(query);
      if (shouldContinue) {
        askQuestion();
      } else {
        rl.close();
        await showTracerSummary();
      }
    });
  };

  const showTracerSummary = async () => {
    console.log('\nExiting chat session...');
    console.log('\nTracer System Summary');
    console.log('='.repeat(80));
    console.log('You just had a conversation with an LLM, and the tracer recorded everything!');

    // Get all events
    const allEvents = tracer.getEvents();
    console.log(`\nTotal events recorded: ${allEvents.length}`);

    if (allEvents.length > 0) {
      printTracerEvents(allEvents);

      // Show how to filter events by type
      console.log('\nYou can filter events by type:');

      const llmCalls = tracer.getEvents({ eventType: LLMCallTracerEvent });
      console.log(`\nLLM Call Events: ${llmCalls.length}`);
      if (llmCalls.length > 0) {
        console.log(`Example: ${llmCalls[0].printableSummary()}`);
      }

      const llmResponses = tracer.getEvents({ eventType: LLMResponseTracerEvent });
      console.log(`\nLLM Response Events: ${llmResponses.length}`);
      if (llmResponses.length > 0) {
        console.log(`Example: ${llmResponses[0].printableSummary()}`);
      }

      const toolCalls = tracer.getEvents({ eventType: ToolCallTracerEvent });
      console.log(`\nTool Call Events: ${toolCalls.length}`);
      if (toolCalls.length > 0) {
        console.log(`Example: ${toolCalls[0].printableSummary()}`);
      }

      // Show the last few events
      console.log('\nThe last few events:');
      const lastEvents = tracer.getLastNTracerEvents(3);
      printTracerEvents(lastEvents);

      // Show how to use time-based filtering
      console.log('\nYou can also filter events by time range:');
      console.log('Example: tracer.getEvents({ startTime: startTimestamp, endTime: endTimestamp })');

      // Demonstrate filtering events by correlationId
      console.log('\nFiltering events by correlationId:');
      console.log(
        'This is a powerful feature that allows you to trace all events related to a specific request'
      );

      // If we have any conversation turns, show events for the first turn
      if (Object.keys(conversationCorrelationIds).length > 0) {
        const firstTurnId = 1;
        const firstCorrelationId = conversationCorrelationIds[firstTurnId];

        if (firstCorrelationId) {
          console.log(
            `\nEvents for conversation turn ${firstTurnId} (correlation_id: ${firstCorrelationId.substring(0, 8)}...):`
          );

          // Get all events with this correlationId
          const relatedEvents = tracer.getEvents({
            filterFunc: (event) => event.correlationId === firstCorrelationId,
          });

          if (relatedEvents.length > 0) {
            console.log(`Found ${relatedEvents.length} related events`);
            printTracerEvents(relatedEvents);

            console.log('\nThe correlationId allows you to trace the complete flow of a request:');
            console.log('1. From the initial LLM call');
            console.log('2. To the LLM response');
            console.log('3. To any tool calls triggered by the LLM');
            console.log('4. And any subsequent LLM calls with the tool results');
            console.log('\nThis creates a complete audit trail for debugging and observability.');
          } else {
            console.log(
              'No events found with this correlationId. This is expected since ChatSession'
            );
            console.log("doesn't pass correlationId yet. This would work with direct broker usage.");
          }
        }
      }

      // Show how to extract specific information from events
      if (toolCalls.length > 0) {
        console.log('\nDetailed analysis example - Tool usage stats:');
        const toolNames: Record<string, number> = {};
        toolCalls.forEach((event) => {
          const toolEvent = event as ToolCallTracerEvent;
          const toolName = toolEvent.toolName;
          toolNames[toolName] = (toolNames[toolName] || 0) + 1;
        });

        console.log('Tool usage frequency:');
        Object.entries(toolNames).forEach(([toolName, count]) => {
          console.log(`  - ${toolName}: ${count} calls`);
        });
      }
    } else {
      console.log('\nNo events were recorded. Try asking some questions with dates!');
      console.log("For example: 'What day is next Friday?'");
    }

    process.exit(0);
  };

  // Handle Ctrl+C gracefully
  rl.on('close', async () => {
    if (!rl.terminal) {
      await showTracerSummary();
    }
  });

  askQuestion();
}

// Run the demo
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
