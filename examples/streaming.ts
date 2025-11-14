/**
 * Streaming Example - Demonstrates streaming text generation with tool calling support
 *
 * This example shows how generateStream() handles tool calls seamlessly:
 * 1. Streams content as it arrives
 * 2. Detects tool calls in the stream
 * 3. Executes tools
 * 4. Recursively streams the LLM's response after tool execution
 *
 * Run with: npm run example:streaming
 * Or: ts-node examples/streaming.ts
 */

import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { Message } from '../src/llm/models';
import { DateResolverTool } from '../src/llm/tools/date-resolver';
import { isOk } from '../src/error';

async function main() {
  console.log('Streaming response with tool calling enabled...\n');

  // Create broker with Ollama
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create date resolver tool
  const dateTool = new DateResolverTool();

  // Request a story with relative dates that will trigger tool calls
  const messages = [
    Message.user(
      'Tell me a short story about a dragon. In your story, reference several dates relative to today, ' +
        "like 'three days from now' or 'last week'."
    ),
  ];

  // Stream with tool support
  const stream = broker.generateStream(messages, { temperature: 0.7, maxTokens: -1 }, [dateTool]);

  // Print chunks as they arrive
  for await (const chunkResult of stream) {
    if (isOk(chunkResult)) {
      process.stdout.write(chunkResult.value);
    } else {
      console.error('\nError:', chunkResult.error.message);
      break;
    }
  }

  console.log('\n\nDone!');
}

main().catch(console.error);
