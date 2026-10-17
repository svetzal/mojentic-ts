/**
 * Comprehensive demonstration of CompletionConfig parameters
 * This example shows all available configuration options for LLM generation
 */

import { LlmBroker, OllamaGateway, Message } from '../src';
import { isOk } from '../src/error';

async function demonstrateConfigParameters() {
  console.log('🎛️  Demonstrating CompletionConfig Parameters\n');

  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  const messages = [Message.user('Write a creative short story opening about a mysterious door.')];

  // Test 1: Basic temperature control
  console.log('Test 1: Temperature control');
  console.log('Low temperature (0.3) - More focused and deterministic:');
  const lowTempResult = await broker.generate(messages, undefined, {
    temperature: 0.3,
    maxTokens: 100,
  });
  if (isOk(lowTempResult)) {
    console.log(lowTempResult.value);
  }

  console.log('\nHigh temperature (1.2) - More creative and varied:');
  const highTempResult = await broker.generate(messages, undefined, {
    temperature: 1.2,
    maxTokens: 100,
  });
  if (isOk(highTempResult)) {
    console.log(highTempResult.value);
  }

  console.log('\n---\n');

  // Test 2: Top-K sampling
  console.log('Test 2: Top-K sampling');
  console.log('Using topK=10 (limits choices to top 10 most probable tokens):');
  const topKResult = await broker.generate(messages, undefined, {
    temperature: 0.8,
    topK: 10,
    maxTokens: 100,
  });
  if (isOk(topKResult)) {
    console.log(topKResult.value);
  }

  console.log('\n---\n');

  // Test 3: Top-P (nucleus sampling)
  console.log('Test 3: Top-P (nucleus sampling)');
  console.log('Using topP=0.9 (considers tokens with cumulative probability up to 90%):');
  const topPResult = await broker.generate(messages, undefined, {
    temperature: 0.8,
    topP: 0.9,
    maxTokens: 100,
  });
  if (isOk(topPResult)) {
    console.log(topPResult.value);
  }

  console.log('\n---\n');

  // Test 4: Context window size
  console.log('Test 4: Context window size');
  console.log('Using numCtx=4096 (sets context window to 4096 tokens):');
  const numCtxResult = await broker.generate(messages, undefined, {
    numCtx: 4096,
    maxTokens: 100,
  });
  if (isOk(numCtxResult)) {
    console.log(numCtxResult.value);
  }

  console.log('\n---\n');

  // Test 5: Combined parameters for optimal control
  console.log('Test 5: Combined parameters');
  console.log('Using balanced settings for creative but controlled output:');
  const combinedResult = await broker.generate(messages, undefined, {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    numCtx: 8192,
    maxTokens: 150,
    stop: ['THE END', '---'],
  });
  if (isOk(combinedResult)) {
    console.log(combinedResult.value);
  }

  console.log('\n---\n');

  // Test 6: Omit the output limit to use the provider's configuration.
  console.log('Test 6: Provider-controlled output limit');
  const providerLimitedResult = await broker.generate(messages);
  if (isOk(providerLimitedResult)) {
    console.log(providerLimitedResult.value);
  }

  console.log('\n✅ CompletionConfig parameter demonstration completed');
  console.log('\nKey takeaways:');
  console.log('- temperature: Controls randomness (0.0-2.0)');
  console.log('- topK: Limits token selection to top K choices');
  console.log('- topP: Nucleus sampling threshold (0.0-1.0)');
  console.log('- numCtx: Sets context window size');
  console.log(
    '- maxTokens: Optional cross-provider output limit; omit to use provider/model limits'
  );
  console.log('- stop: Array of sequences that will halt generation');
}

demonstrateConfigParameters().catch(console.error);
