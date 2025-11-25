/**
 * Test script for numPredict parameter
 * This demonstrates the new numPredict configuration option
 */

import { LlmBroker, OllamaGateway, Message } from '../src';
import { isOk } from '../src/error';

async function testNumPredict() {
  console.log('🧪 Testing numPredict parameter\n');

  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  const messages = [Message.user('Count from 1 to 100')];

  // Test 1: Using numPredict to limit response
  console.log('Test 1: Using numPredict=10 (should generate short response)');
  const config = { numPredict: 10 };
  const result = await broker.generate(messages, config);

  if (isOk(result)) {
    console.log('Response:', result.value);
    console.log('Response length:', result.value.length);
  } else {
    console.error('Error:', result.error.message);
  }

  console.log('\n---\n');

  // Test 2: Verify numPredict takes precedence over maxTokens
  console.log('Test 2: Using both numPredict=15 and maxTokens=100 (should use 15)');
  const config2 = { numPredict: 15, maxTokens: 100 };
  const result2 = await broker.generate(messages, config2);

  if (isOk(result2)) {
    console.log('Response:', result2.value);
    console.log('Response length:', result2.value.length);
  } else {
    console.error('Error:', result2.error.message);
  }

  console.log('\n✅ numPredict parameter tests completed');
}

testNumPredict().catch(console.error);
