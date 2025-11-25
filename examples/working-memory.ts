/**
 * Working Memory Example - Demonstrates shared memory across agents
 *
 * For comprehensive documentation on the working memory pattern, see:
 * docs/working-memory.md
 *
 * This example shows how to use SharedWorkingMemory with agents to maintain
 * and update context across multiple interactions. The system demonstrates:
 *
 * 1. SharedWorkingMemory - A shared context agents can read from and write to
 * 2. RequestAgent - An agent that answers questions using memory context
 * 3. Event-driven architecture - Coordinator agents using Dispatcher and Router
 *
 * The agent remembers user information and learns new facts during conversation.
 */

import { LlmBroker } from '../src/llm';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import {
  Event,
  AsyncLlmAgentWithMemory,
  AsyncLlmAgentWithMemoryConfig,
  AsyncDispatcher,
  Router,
  BaseAsyncAgent,
} from '../src/agents';
import { SharedWorkingMemory } from '../src/context';
import { Result, Ok, isOk } from '../src/error';

// ============================================================================
// Event Definitions
// ============================================================================

/**
 * Event representing a user request
 */
interface RequestEvent extends Event {
  type: 'RequestEvent';
  text: string;
}

/**
 * Type guard for RequestEvent
 */
function isRequestEvent(event: Event): event is RequestEvent {
  return (event as RequestEvent).type === 'RequestEvent';
}

/**
 * Event representing an agent response with updated memory
 */
interface ResponseEvent extends Event {
  type: 'ResponseEvent';
  text: string;
  memory: Record<string, unknown>;
}

// ============================================================================
// Response Schema
// ============================================================================

/**
 * Schema for the agent's response
 */
const responseModelSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'The response text to the user',
    },
  },
  required: ['text'],
};

/**
 * Response type matching the schema
 */
interface ResponseModel {
  text: string;
}

// ============================================================================
// Request Agent with Memory
// ============================================================================

/**
 * Agent that processes user requests with memory context.
 *
 * This agent:
 * - Reads from shared working memory to understand context
 * - Answers questions using remembered information
 * - Learns new facts and stores them in memory
 * - Produces ResponseEvent with both answer and updated memory
 */
class RequestAgent extends AsyncLlmAgentWithMemory {
  constructor(broker: LlmBroker, memory: SharedWorkingMemory) {
    const config: AsyncLlmAgentWithMemoryConfig = {
      broker,
      memory,
      behaviour:
        'You are a helpful assistant, and you like to make note of new things that you learn.',
      instructions: "Answer the user's question, use what you know, and what you remember.",
      responseModel: responseModelSchema,
    };
    super(config);
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (isRequestEvent(event)) {
      // Generate response with memory context
      const result = await this.generateResponseWithMemory<ResponseModel>(event.text);

      if (isOk(result)) {
        const response = result.value;

        // Create response event with answer and updated memory
        const responseEvent: ResponseEvent = {
          type: 'ResponseEvent',
          source: this.constructor.name,
          correlationId: event.correlationId,
          text: response.text,
          memory: this.memory.getWorkingMemory(),
        };

        return Ok([responseEvent]);
      }

      return result as Result<Event[], Error>;
    }

    return Ok([]);
  }
}

// ============================================================================
// Output Agent
// ============================================================================

/**
 * Agent that displays responses and terminates the dispatcher.
 *
 * This agent prints events to the console and sends a terminate signal
 * to stop the dispatcher after displaying the response.
 */
class OutputAgent implements BaseAsyncAgent {
  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    console.log('\n' + '='.repeat(80));
    console.log('Event:', event.type);
    console.log('='.repeat(80));
    console.log(JSON.stringify(event, null, 2));
    console.log('='.repeat(80) + '\n');

    // Signal termination after output
    return Ok([
      {
        type: 'terminate',
        source: this.constructor.name,
        correlationId: event.correlationId,
      },
    ]);
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  // Initialize shared working memory with user information
  const memory = new SharedWorkingMemory({
    User: {
      name: 'Stacey',
      age: 56,
    },
  });

  console.log('Initial Working Memory:');
  console.log(JSON.stringify(memory.getWorkingMemory(), null, 2));
  console.log('');

  // Create LLM broker with Ollama gateway
  const gateway = new OllamaGateway('http://localhost:11434');
  const broker = new LlmBroker('qwen2.5:7b', gateway);

  // Create agents
  const requestAgent = new RequestAgent(broker, memory);
  const outputAgent = new OutputAgent();

  // Configure router to direct events to appropriate agents
  const router = new Router();
  router.addRoute('RequestEvent', requestAgent);
  router.addRoute('RequestEvent', outputAgent); // Also show request
  router.addRoute('ResponseEvent', outputAgent);

  // Create and start dispatcher
  const dispatcher = new AsyncDispatcher(router);
  await dispatcher.start();

  // Dispatch a request that teaches the agent about pets
  const requestEvent: RequestEvent = {
    type: 'RequestEvent',
    source: 'main',
    text:
      'What is my name, and how old am I? ' +
      'And, did you know I have a dog named Boomer, and two cats named Spot and Beau?',
  };

  dispatcher.dispatch(requestEvent);

  // Wait for processing to complete (with timeout)
  const completed = await dispatcher.waitForEmptyQueue(30000);

  if (!completed) {
    console.error('Timeout waiting for events to process');
  }

  // Stop the dispatcher
  await dispatcher.stop();

  // Display final memory state
  console.log('\nFinal Working Memory:');
  console.log(JSON.stringify(memory.getWorkingMemory(), null, 2));
}

// Run the example
main().catch((error) => {
  console.error('Error running example:', error);
  process.exit(1);
});
