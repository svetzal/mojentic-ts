/**
 * Example demonstrating the CurrentDatetime tool
 * This tool allows the LLM to get the current date and time
 */

import { OllamaGateway } from '../src/llm/gateways/ollama-gateway';
import { LlmBroker } from '../src/llm/broker';
import { Message } from '../src/llm/messages';
import { CurrentDatetimeTool } from '../src/llm/tools/current-datetime';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Current Datetime Tool Example\n');

  // Initialize the gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Create the tool
  const tool = new CurrentDatetimeTool();

  console.log('Available tool:');
  const descriptor = tool.descriptor();
  console.log(`  - ${descriptor.function.name}: ${descriptor.function.description}`);
  console.log();

  // Example 1: Ask for current time
  console.log('Example 1: What time is it right now?\n');

  let messages = [
    Message.system('You are a helpful assistant with access to tools.'),
    Message.user('What time is it right now? Also, what day of the week is it today?'),
  ];

  let result = await broker.generate(messages, [tool]);

  if (isOk(result)) {
    console.log('LLM Response:');
    console.log(result.value);
    console.log();
  } else {
    console.log(`Error: ${result.error.message}\n`);
  }

  // Example 2: Ask for current date in a friendly format
  console.log("Example 2: What's today's date in a friendly format?\n");

  messages = [
    Message.system('You are a helpful assistant with access to tools.'),
    Message.user("Tell me the current date in a friendly format, like 'Monday, January 1, 2023'"),
  ];

  result = await broker.generate(messages, [tool]);

  if (isOk(result)) {
    console.log('LLM Response:');
    console.log(result.value);
    console.log();
  } else {
    console.log(`Error: ${result.error.message}\n`);
  }

  // Example 3: Multiple queries about time
  console.log('Example 3: When was this program run?\n');

  messages = [
    Message.system('You are a helpful assistant with access to tools.'),
    Message.user('When was this program run? Give me the exact timestamp.'),
  ];

  result = await broker.generate(messages, [tool]);

  if (isOk(result)) {
    console.log('LLM Response:');
    console.log(result.value);
    console.log();
  } else {
    console.log(`Error: ${result.error.message}\n`);
  }

  console.log('✅ Example completed!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
