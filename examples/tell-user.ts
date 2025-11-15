/**
 * Tell User Tool Example
 *
 * This example demonstrates how to use the TellUserTool to display
 * intermediate messages to the user without expecting a response.
 */

import { LlmBroker, LlmMessage } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { TellUserTool } from '../src/llm/tools/tell-user';
import { isOk } from '../src/error';

async function main() {
  // Create gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create the TellUser tool
  const tellUserTool = new TellUserTool();

  // User request
  const userRequest = 'Tell me about the benefits of exercise.';

  // Create messages with a system prompt encouraging tool usage
  const messages = [
    new LlmMessage(
      'system',
      'You are a helpful assistant. Use the tell_user tool to share important intermediate information with the user as you work on their request.'
    ),
    new LlmMessage('user', userRequest),
  ];

  console.log('User Request:');
  console.log(userRequest);
  console.log('\nProcessing...\n');

  // Generate response with the TellUser tool
  const result = await broker.generate(messages, [tellUserTool]);

  if (isOk(result)) {
    console.log('\nFinal Response:');
    console.log(result.value.content);
  } else {
    console.error('\nError:', result.error.message);
  }
}

main().catch(console.error);
