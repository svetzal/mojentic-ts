/**
 * Image Analysis Example
 *
 * This example demonstrates multimodal capabilities - analyzing images
 * with vision-capable LLM models.
 *
 * Usage:
 *   npm run example:image
 *   or
 *   ts-node examples/image_analysis.ts
 *
 * Requirements:
 *   - Ollama running locally (default: http://localhost:11434)
 *   - A vision-capable model pulled (e.g., ollama pull qwen3-vl:30b)
 *   - Test image at examples/images/flash_rom.jpg
 */

import { LlmBroker, OllamaGateway, MessageRole } from '../src';
import { isOk } from '../src/error';
import { imageContent, textContent } from '../src/llm/utils/image';
import { existsSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🖼️  Mojentic TypeScript - Image Analysis Example\n');

  // Get the path to the test image
  const imagePath = join(__dirname, 'images', 'flash_rom.jpg');

  // Check if image exists
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Example code checking for test image
  if (!existsSync(imagePath)) {
    console.error(`❌ Error: Image not found at ${imagePath}`);
    console.error('\nMake sure the test image exists:');
    console.error('  examples/images/flash_rom.jpg');
    process.exit(1);
  }

  console.log(`Analyzing image: ${imagePath}\n`);

  // Initialize the gateway and broker with a vision-capable model
  // Options: llava:latest, bakllava:latest, gemma3:27b, qwen3-vl:30b, etc.
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3-vl:30b', gateway);

  console.log(`Using model: ${broker.getModel()}\n`);

  // Create a multimodal message with text and image using utility functions
  const message = {
    role: MessageRole.User,
    content: [
      textContent(
        'This is a Flash ROM chip on an adapter board. Extract the text on top of the chip.'
      ),
      imageContent(imagePath),
    ],
  };

  console.log('Sending message to LLM...\n');

  // Generate response
  const result = await broker.generate([message]);

  if (isOk(result)) {
    console.log('Response:');
    console.log(result.value);
  } else {
    console.error('❌ Error:', result.error.message);
    console.error('\nMake sure you have a vision-capable model installed:');
    console.error('  ollama pull qwen3-vl:30b');
    console.error('\nOther vision models to try:');
    console.error('  ollama pull llava:latest');
    console.error('  ollama pull bakllava:latest');
    console.error('  ollama pull gemma3:27b');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
