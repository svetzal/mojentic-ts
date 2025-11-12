/**
 * Structured output example using JSON schema
 */

import { LlmBroker, OllamaGateway, Message } from '../src';
import { isOk } from '../src/error';

interface SentimentAnalysis {
  sentiment: string;
  confidence: number;
  reasoning: string;
}

async function main() {
  console.log('🚀 Mojentic TypeScript - Structured Output Example\n');

  // Initialize the gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Define the JSON schema for structured output
  const schema = {
    type: 'object',
    properties: {
      sentiment: {
        type: 'string',
        description: 'The sentiment (positive, negative, or neutral)',
        enum: ['positive', 'negative', 'neutral'],
      },
      confidence: {
        type: 'number',
        description: 'Confidence score between 0 and 1',
        minimum: 0,
        maximum: 1,
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of the sentiment analysis',
      },
    },
    required: ['sentiment', 'confidence', 'reasoning'],
  };

  // Create a message for sentiment analysis
  const messages = [
    Message.system('You are a sentiment analysis expert. Analyze the sentiment of user messages.'),
    Message.user('I absolutely love this new framework! It makes development so much easier.'),
  ];

  console.log('Generating structured output...\n');

  // Generate structured response
  const result = await broker.generateObject<SentimentAnalysis>(messages, schema);

  if (isOk(result)) {
    console.log('Sentiment Analysis Result:');
    console.log(JSON.stringify(result.value, null, 2));
    console.log(`\nSentiment: ${result.value.sentiment}`);
    console.log(`Confidence: ${(result.value.confidence * 100).toFixed(1)}%`);
    console.log(`Reasoning: ${result.value.reasoning}`);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }
}

main().catch(console.error);
