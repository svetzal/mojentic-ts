/**
 * Demonstrates text embeddings generation using OllamaGateway.
 *
 * This example shows how to:
 * 1. Initialize the OllamaGateway
 * 2. Calculate embeddings for text
 * 3. Display the embedding dimensions
 * 4. Handle potential errors gracefully
 *
 * Embeddings are vector representations of text that capture semantic meaning,
 * useful for similarity search, clustering, and other NLP tasks.
 */

import { OllamaGateway } from '../src/llm/gateways/ollama';
import { isOk } from '../src/error';

async function main(): Promise<void> {
  try {
    // Initialize the Ollama gateway
    const gateway = new OllamaGateway();

    // Text to generate embeddings for
    const text = 'Hello, world! This is a sample text for embeddings.';

    // Model optimized for text embeddings
    const model = 'mxbai-embed-large';

    console.log(`Calculating embeddings for: '${text}'`);
    console.log(`Using model: ${model}\n`);

    // Calculate embeddings
    const result = await gateway.calculateEmbeddings(text, model);

    if (!isOk(result)) {
      console.error(`Error: ${result.error.message}`);
      console.log('\nNote: This example requires Ollama to be running locally');
      console.log('with the mxbai-embed-large model installed.');
      console.log('\nTo install the model, run:');
      console.log('  ollama pull mxbai-embed-large');
      return;
    }

    const embedding = result.value;

    // Display results
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log(`First 10 values: ${embedding.slice(0, 10).map((v) => v.toFixed(6)).join(', ')}`);

    // Demonstrate with a different text to show variation
    const text2 = 'Machine learning models process numerical data.';
    const result2 = await gateway.calculateEmbeddings(text2, model);

    if (isOk(result2)) {
      const embedding2 = result2.value;
      console.log(`\nSecond embedding dimensions: ${embedding2.length}`);
      console.log(
        `First 10 values: ${embedding2.slice(0, 10).map((v) => v.toFixed(6)).join(', ')}`
      );

      // Calculate cosine similarity between the two embeddings
      const similarity = cosineSimilarity(embedding, embedding2);
      console.log(`\nCosine similarity between texts: ${similarity.toFixed(4)}`);
      console.log('(Higher values indicate more semantic similarity)');
    }

    console.log('\nEmbeddings generated successfully!');
  } catch (error) {
    console.error(`Unexpected error: ${error}`);
    console.log('\nNote: This example requires Ollama to be running locally');
    console.log('with the mxbai-embed-large model installed.');
    console.log('\nTo install the model, run:');
    console.log('  ollama pull mxbai-embed-large');
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

main();
