/**
 * Simple LLM text generation example
 */

import { LlmBroker, OllamaGateway, Message } from '../src';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Simple LLM Example\n');

  // Initialize the gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Create a simple message
  const messages = [Message.user('What is TypeScript and why is it useful?')];

  console.log('Sending message to LLM...\n');

  // Generate response
  const result = await broker.generate(messages);

  if (isOk(result)) {
    console.log('Response:');
    console.log(result.value);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }
}

main().catch(console.error);
