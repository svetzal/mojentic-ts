# Embeddings

Embeddings allow you to convert text into vector representations, which are useful for semantic search, clustering, and similarity comparisons.

## Setup

You need an embedding model. Ollama supports models like `mxbai-embed-large` or `nomic-embed-text`.

```typescript
import { EmbeddingsGateway } from 'mojentic';

// Initialize gateway
const gateway = new EmbeddingsGateway('mxbai-embed-large');
```

## Generating Embeddings

```typescript
const text = "The quick brown fox jumps over the lazy dog.";
const result = await gateway.embed(text);

if (result.isOk()) {
  console.log(result.value.slice(0, 5));
  // => [0.123, -0.456, ...]
}
```

## Batch Processing

You can embed multiple texts at once:

```typescript
const texts = ["Hello", "World"];
const result = await gateway.embedBatch(texts);
```

## Cosine Similarity

Mojentic provides utilities to calculate similarity between vectors:

```typescript
import { cosineSimilarity } from 'mojentic';

const similarity = cosineSimilarity(vector1, vector2);
```
