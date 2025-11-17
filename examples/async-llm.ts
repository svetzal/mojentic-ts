/**
 * Async LLM Example - Demonstrates async agent framework with parallel processing
 *
 * This example shows how to build an event-driven agent system where:
 * 1. A question is dispatched
 * 2. FactCheckerAgent and AnswerGeneratorAgent process it in parallel
 * 3. FinalAnswerAgent aggregates both results to produce a final answer
 */

import { LlmBroker } from '../src/llm';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { Event, AsyncLlmAgent, AsyncAggregatorAgent, AsyncDispatcher, Router } from '../src/agents';
import { Result, Ok, isOk } from '../src/error';

// ============================================================================
// Event Definitions
// ============================================================================

interface QuestionEvent extends Event {
  type: 'QuestionEvent';
  question: string;
}

function isQuestionEvent(event: Event): event is QuestionEvent {
  return (event as QuestionEvent).type === 'QuestionEvent';
}

interface FactCheckEvent extends Event {
  type: 'FactCheckEvent';
  question: string;
  facts: string[];
}

function isFactCheckEvent(event: Event): event is FactCheckEvent {
  return (event as FactCheckEvent).type === 'FactCheckEvent';
}

interface AnswerEvent extends Event {
  type: 'AnswerEvent';
  question: string;
  answer: string;
  confidence: number;
}

function isAnswerEvent(event: Event): event is AnswerEvent {
  return (event as AnswerEvent).type === 'AnswerEvent';
}

interface FinalAnswerEvent extends Event {
  type: 'FinalAnswerEvent';
  question: string;
  answer: string;
  facts: string[];
  confidence: number;
}

// ============================================================================
// Response Models (JSON Schemas)
// ============================================================================

const factCheckResponseSchema = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: { type: 'string' },
      description: 'The facts related to the question',
    },
  },
  required: ['facts'],
};

const answerResponseSchema = {
  type: 'object',
  properties: {
    answer: {
      type: 'string',
      description: 'The answer to the question',
    },
    confidence: {
      type: 'number',
      description: 'The confidence level of the answer (0-1)',
    },
  },
  required: ['answer', 'confidence'],
};

// ============================================================================
// Agent Implementations
// ============================================================================

/**
 * Agent that checks facts related to a question using an LLM.
 */
class FactCheckerAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour:
        'You are a fact-checking assistant. Your job is to provide relevant facts about a question.',
      responseModel: factCheckResponseSchema,
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (!isQuestionEvent(event)) {
      return Ok([]);
    }

    console.log(`FactCheckerAgent processing: "${event.question}"`);

    const prompt = `Please provide relevant facts about the following question: ${event.question}`;
    const result = await this.generateResponse<{ facts: string[] }>(prompt);

    if (!isOk(result)) {
      console.error('FactCheckerAgent error:', result.error);
      return Ok([]);
    }

    const factCheckEvent: FactCheckEvent = {
      type: 'FactCheckEvent',
      source: 'FactCheckerAgent',
      correlationId: event.correlationId,
      question: event.question,
      facts: result.value.facts,
    };

    console.log(`FactCheckerAgent found ${result.value.facts.length} facts`);
    return Ok([factCheckEvent]);
  }
}

/**
 * Agent that generates an answer to a question using an LLM.
 */
class AnswerGeneratorAgent extends AsyncLlmAgent {
  constructor(broker: LlmBroker) {
    super({
      broker,
      behaviour:
        'You are a question-answering assistant. Your job is to provide accurate answers to questions.',
      responseModel: answerResponseSchema,
    });
  }

  async receiveEventAsync(event: Event): Promise<Result<Event[], Error>> {
    if (!isQuestionEvent(event)) {
      return Ok([]);
    }

    console.log(`AnswerGeneratorAgent processing: "${event.question}"`);

    const prompt = `Please answer the following question: ${event.question}`;
    const result = await this.generateResponse<{ answer: string; confidence: number }>(prompt);

    if (!isOk(result)) {
      console.error('AnswerGeneratorAgent error:', result.error);
      return Ok([]);
    }

    const answerEvent: AnswerEvent = {
      type: 'AnswerEvent',
      source: 'AnswerGeneratorAgent',
      correlationId: event.correlationId,
      question: event.question,
      answer: result.value.answer,
      confidence: result.value.confidence,
    };

    console.log(`AnswerGeneratorAgent generated answer with confidence ${result.value.confidence}`);
    return Ok([answerEvent]);
  }
}

/**
 * Agent that combines facts and answers to produce a final answer.
 */
class FinalAnswerAgent extends AsyncAggregatorAgent {
  private finalAnswers: Map<string, FinalAnswerEvent> = new Map();

  constructor() {
    super(['FactCheckEvent', 'AnswerEvent']);
  }

  async processEvents(events: Event[]): Promise<Result<Event[], Error>> {
    console.log(`FinalAnswerAgent processing ${events.length} events`);

    const factCheckEvent = events.find(isFactCheckEvent);
    const answerEvent = events.find(isAnswerEvent);

    if (!factCheckEvent || !answerEvent) {
      console.log('FinalAnswerAgent missing required events');
      return Ok([]);
    }

    console.log('FinalAnswerAgent has both FactCheckEvent and AnswerEvent');

    // Adjust confidence based on facts
    let confidence = answerEvent.confidence;
    if (factCheckEvent.facts.length > 0) {
      // Increase confidence if we have facts
      confidence = Math.min(1.0, confidence + 0.1);
    }

    const finalAnswerEvent: FinalAnswerEvent = {
      type: 'FinalAnswerEvent',
      source: 'FinalAnswerAgent',
      correlationId: factCheckEvent.correlationId,
      question: factCheckEvent.question,
      answer: answerEvent.answer,
      facts: factCheckEvent.facts,
      confidence,
    };

    // Store for retrieval
    if (finalAnswerEvent.correlationId) {
      this.finalAnswers.set(finalAnswerEvent.correlationId, finalAnswerEvent);
    }

    console.log('FinalAnswerAgent created FinalAnswerEvent');
    return Ok([finalAnswerEvent]);
  }

  /**
   * Get the final answer for a specific correlation ID.
   * Waits for all required events to arrive before returning.
   */
  async getFinalAnswer(
    correlationId: string,
    timeout: number = 30000
  ): Promise<FinalAnswerEvent | null> {
    // Wait for all needed events
    const result = await this.waitForEvents(correlationId, timeout);

    if (!isOk(result)) {
      console.error('Error waiting for events:', result.error);
      return null;
    }

    // Return the final answer if available
    return this.finalAnswers.get(correlationId) || null;
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Async LLM Agent Example');
  console.log('='.repeat(80));
  console.log();

  // Initialize the LLM broker with Ollama
  const gateway = new OllamaGateway('http://localhost:11434');
  const broker = new LlmBroker('qwen3:30b-a3b-q4_K_M', gateway);

  // Create agents
  const factChecker = new FactCheckerAgent(broker);
  const answerGenerator = new AnswerGeneratorAgent(broker);
  const finalAnswerAgent = new FinalAnswerAgent();

  // Create router and register agents
  const router = new Router();
  router.addRoute('QuestionEvent', factChecker);
  router.addRoute('QuestionEvent', answerGenerator);
  router.addRoute('QuestionEvent', finalAnswerAgent);
  router.addRoute('FactCheckEvent', finalAnswerAgent);
  router.addRoute('AnswerEvent', finalAnswerAgent);

  // Create and start dispatcher
  const dispatcher = new AsyncDispatcher(router);
  await dispatcher.start();

  console.log('Dispatcher started');
  console.log();

  // Create question event
  const question = 'What is the capital of France?';
  const questionEvent: QuestionEvent = {
    type: 'QuestionEvent',
    source: 'ExampleSource',
    correlationId: 'example-001',
    question,
  };

  console.log(`Dispatching question: "${question}"`);
  console.log();

  // Dispatch the event
  dispatcher.dispatch(questionEvent);

  // Give the dispatcher a moment to start processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Wait for the final answer
  console.log('Waiting for final answer...');
  console.log();
  const correlationId = questionEvent.correlationId || '';
  const finalAnswer = await finalAnswerAgent.getFinalAnswer(correlationId, 30000);

  // Display results
  if (finalAnswer) {
    console.log('='.repeat(80));
    console.log('FINAL ANSWER');
    console.log('='.repeat(80));
    console.log();
    console.log(`Question: ${finalAnswer.question}`);
    console.log(`Answer: ${finalAnswer.answer}`);
    console.log(`Confidence: ${finalAnswer.confidence.toFixed(2)}`);
    console.log();
    console.log('Facts:');
    for (const fact of finalAnswer.facts) {
      console.log(`  - ${fact}`);
    }
    console.log();
  } else {
    console.log('No FinalAnswerEvent received');
  }

  // Stop the dispatcher
  await dispatcher.stop();
  console.log('Dispatcher stopped');
}

// Run the example
main().catch((error) => {
  console.error('Error running example:', error);
});
