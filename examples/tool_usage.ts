/**
 * Tool usage example with automatic tool calling
 */

import { LlmBroker, OllamaGateway, Message, DateResolverTool } from '../src';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Tool Usage Example\n');

  // Initialize the gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Create tools
  const tools = [new DateResolverTool()];

  console.log('Available tools:');
  tools.forEach((tool) => {
    console.log(`  - ${tool.name()}: ${tool.descriptor().function.description}`);
  });
  console.log();

  // Create messages that will trigger tool usage
  const messages = [
    Message.system(
      'You are a helpful assistant with access to tools. Use the resolve_date tool when users ask about dates.'
    ),
    Message.user('What day of the week is next Friday?'),
  ];

  console.log('Sending message (LLM will automatically call tools if needed)...\n');

  // Generate response with automatic tool calling
  const result = await broker.generate(messages, tools);

  if (isOk(result)) {
    console.log('Response:');
    console.log(result.value);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }

  // Try another example
  console.log('\n' + '='.repeat(60) + '\n');

  const messages2 = [
    Message.system(
      'You are a helpful assistant with access to tools. Use the resolve_date tool when users ask about dates.'
    ),
    Message.user('When is tomorrow and what day of the week is it?'),
  ];

  console.log('Sending another message...\n');

  const result2 = await broker.generate(messages2, tools);

  if (isOk(result2)) {
    console.log('Response:');
    console.log(result2.value);
  } else {
    console.error('Error:', result2.error.message);
    process.exit(1);
  }
}

main().catch(console.error);
