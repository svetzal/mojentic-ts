/**
 * Example: Chat session with tool support
 *
 * This example demonstrates a ChatSession with tool integration.
 * The DateResolverTool allows the LLM to resolve relative date references
 * like "next Friday" or "tomorrow" during the conversation.
 *
 * Usage:
 *   npx ts-node examples/chat_session_with_tool.ts
 *
 * Try queries like:
 *   - "What day is next Friday?"
 *   - "Tell me about tomorrow"
 *   - "What's the date in 2 weeks?"
 *
 * Press Ctrl+C to exit
 */

import * as readline from 'readline';
import { LlmBroker, ChatSession } from '../src';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { DateResolverTool } from '../src/llm/tools/date-resolver';

async function main() {
  // Create broker with Ollama
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create chat session with date resolver tool
  const chatSession = new ChatSession(broker, {
    systemPrompt: 'You are a helpful assistant with access to date resolution tools.',
    tools: [new DateResolverTool()],
    maxContext: 32768,
  });

  console.log('Chat session with DateResolverTool started.');
  console.log('Type your queries and press Enter.');
  console.log('Try asking about dates like "next Friday" or "tomorrow".');
  console.log('Press Ctrl+C to exit.\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Query: ',
  });

  rl.prompt();

  rl.on('line', async (query: string) => {
    if (!query.trim()) {
      rl.close();
      return;
    }

    try {
      const response = await chatSession.send(query);
      console.log(`\n${response}\n`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    chatSession.dispose();
    process.exit(0);
  });
}

main().catch(console.error);
