/**
 * Web search example - demonstrates searching the web with DuckDuckGo
 */

import { LlmBroker, OllamaGateway, Message, WebSearchTool } from '../src';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Web Search Example\n');

  // Initialize the gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Create web search tool
  const tools = [new WebSearchTool()];

  console.log('Available tools:');
  tools.forEach((tool) => {
    console.log(`  - ${tool.name()}: ${tool.descriptor().function.description}`);
  });
  console.log();

  // Create messages that will trigger web search
  const messages = [
    Message.system(
      'You are a helpful research assistant with access to web search. Use the web_search tool to find current information when needed.'
    ),
    Message.user('What are the latest developments in TypeScript?'),
  ];

  console.log('Sending message (LLM will search the web if needed)...\n');

  // Generate response with automatic tool calling
  const result = await broker.generate(messages, tools);

  if (isOk(result)) {
    console.log('Response:');
    console.log(result.value);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }

  // Try another example with specific query
  console.log('\n' + '='.repeat(60) + '\n');

  const messages2 = [
    Message.system(
      'You are a helpful research assistant with access to web search. Use the web_search tool to find current information when needed.'
    ),
    Message.user('Search for information about climate change solutions'),
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

  // Direct tool usage example
  console.log('\n' + '='.repeat(60) + '\n');
  console.log('Direct tool usage example:\n');

  const searchTool = new WebSearchTool();
  const directResult = await searchTool.run({ query: 'TypeScript best practices' });

  if (isOk(directResult)) {
    console.log('Search results:');
    const results = JSON.parse(directResult.value as string);
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Snippet: ${result.snippet}`);
    });
  } else {
    console.error('Search error:', directResult.error.message);
  }
}

main().catch(console.error);
