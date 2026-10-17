/**
 * Output-limit migration example (historical filename)
 * Use maxTokens for every provider; omit it to use provider/model limits.
 */

import { LlmBroker, OllamaGateway, Message } from '../src';
import { isOk } from '../src/error';

async function testOutputLimit(): Promise<void> {
  console.log('🧪 Testing maxTokens parameter\n');

  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  const messages = [Message.user('Count from 1 to 100')];

  // Test 1: Using maxTokens to limit response
  console.log('Test 1: Using maxTokens=10 (should generate short response)');
  const config = { maxTokens: 10 };
  const result = await broker.generate(messages, undefined, config);

  if (isOk(result)) {
    console.log('Response:', result.value);
    console.log('Response length:', result.value.length);
  } else {
    console.error('Error:', result.error.message);
  }

  console.log('\n---\n');

  // Test 2: Omit the limit to let the provider decide
  console.log('Test 2: No caller-selected output limit');
  const config2 = {};
  const result2 = await broker.generate(messages, undefined, config2);

  if (isOk(result2)) {
    console.log('Response:', result2.value);
    console.log('Response length:', result2.value.length);
  } else {
    console.error('Error:', result2.error.message);
  }

  console.log('\n✅ maxTokens parameter tests completed');
}

testOutputLimit().catch(console.error);
