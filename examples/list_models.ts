/**
 * List available models from Ollama gateway
 *
 * This example demonstrates how to query the Ollama server for available models.
 *
 * Usage:
 *   npx ts-node examples/list_models.ts
 *
 * Requirements:
 *   - Ollama running locally (default: http://localhost:11434)
 *   - At least one model pulled (e.g., ollama pull qwen3:32b)
 */

import { OllamaGateway } from '../src';
import { isOk } from '../src/error';

async function main() {
  // Create Ollama gateway
  const gateway = new OllamaGateway();

  console.log('Ollama Models:');
  console.log();

  // Get available models
  const result = await gateway.listModels();

  if (isOk(result)) {
    const models = result.value;

    if (models.length === 0) {
      console.log('No models found.');
      console.log();
      console.log('Pull a model with:');
      console.log('  ollama pull qwen3:32b');
    } else {
      for (const model of models) {
        console.log(`- ${model}`);
      }
    }
  } else {
    console.error('Error fetching models:', result.error.message);
    console.error();
    console.error('Make sure Ollama is running:');
    console.error('  ollama serve');
    console.error();
    console.error('And that you have at least one model pulled:');
    console.error('  ollama pull qwen3:32b');
  }
}

main().catch(console.error);
