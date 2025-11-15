/**
 * Example: Basic chat session with automatic context management
 *
 * This example demonstrates the ChatSession class which automatically manages
 * conversation history and handles context window limits by removing older messages.
 *
 * Usage:
 *   npx ts-node examples/chat_session.ts
 *
 * Press Ctrl+C to exit
 */

import * as readline from 'readline';
import { LlmBroker, ChatSession } from '../src';
import { OllamaGateway } from '../src/llm/gateways/ollama';

async function main() {
  // Create broker with Ollama
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create chat session
  const chatSession = new ChatSession(broker, {
    systemPrompt: 'You are a helpful assistant.',
    maxContext: 32768,
  });

  console.log('Chat session started. Type your queries and press Enter.');
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
