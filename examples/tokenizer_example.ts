import { TokenizerGateway } from '../src/llm/gateways/tokenizerGateway';

/**
 * Example demonstrating the TokenizerGateway usage.
 *
 * This shows how to:
 * - Create a tokenizer instance
 * - Encode text into tokens
 * - Decode tokens back to text
 * - Count tokens for context window management
 */
function main() {
  // Create a tokenizer with the default cl100k_base encoding
  // (used by GPT-4 and GPT-3.5-turbo)
  const tokenizer = new TokenizerGateway();

  console.log('=== TokenizerGateway Example ===\n');

  // Example 1: Basic encoding and decoding
  const text1 = 'Hello, world! This is a test message.';
  console.log(`Original text: "${text1}"`);

  const tokens1 = tokenizer.encode(text1);
  console.log(`Tokens: [${tokens1.join(', ')}]`);
  console.log(`Token count: ${tokens1.length}`);

  const decoded1 = tokenizer.decode(tokens1);
  console.log(`Decoded text: "${decoded1}"`);
  console.log(`Round-trip successful: ${text1 === decoded1}\n`);

  // Example 2: Counting tokens for context window management
  const longMessage = `
This is a longer message that demonstrates token counting.
Token counting is important for:
- Managing context window limits
- Estimating API costs
- Optimizing prompt engineering
- Debugging tokenization issues
  `.trim();

  const tokens2 = tokenizer.encode(longMessage);
  console.log(`\nLong message token count: ${tokens2.length}`);
  console.log(`First 10 tokens: [${tokens2.slice(0, 10).join(', ')}]`);

  // Example 3: Comparing different text lengths
  const texts = [
    'Hi',
    'Hello, how are you?',
    'The quick brown fox jumps over the lazy dog.',
    'A much longer sentence with more words will naturally have more tokens.',
  ];

  console.log('\n=== Token Counts for Different Text Lengths ===');
  texts.forEach((text) => {
    const tokens = tokenizer.encode(text);
    console.log(`"${text}"`);
    console.log(`  → ${tokens.length} tokens\n`);
  });

  // Example 4: Unicode and special characters
  const unicodeText = 'Hello 世界! 🌍 Special chars: @#$%';
  const unicodeTokens = tokenizer.encode(unicodeText);
  console.log(`Unicode text: "${unicodeText}"`);
  console.log(`Token count: ${unicodeTokens.length}`);
  console.log(`Decoded: "${tokenizer.decode(unicodeTokens)}"\n`);

  // Clean up
  tokenizer.free();
  console.log('Tokenizer resources freed.');
}

main();
