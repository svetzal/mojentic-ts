# Image Analysis

Mojentic supports multimodal capabilities, allowing you to analyze images with vision-capable LLM models. This guide shows you how to send images to LLMs and get intelligent responses.

## Overview

Vision-capable models can analyze images and answer questions about them. Mojentic provides utilities to encode images and send them alongside text prompts in a single message.

## Requirements

- A vision-capable model (e.g., `llava`, `bakllava`, `qwen3-vl`, `gemma3:27b`)
- Image files in common formats (JPEG, PNG, GIF, WebP, BMP, SVG)

## Quick Example

```typescript
import { LlmBroker, OllamaGateway, MessageRole, isOk } from 'mojentic';
import { imageContent, textContent } from 'mojentic/llm/utils/image';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3-vl:30b', gateway);

// Create a multimodal message with text and image
const message = {
  role: MessageRole.User,
  content: [
    textContent('What do you see in this image?'),
    imageContent('./path/to/image.jpg'),
  ],
};

const result = await broker.generate([message]);

if (isOk(result)) {
  console.log(result.value);
}
```

## Image Utilities

### `imageToDataUri(filePath: string): string`

Reads an image file and converts it to a base64 data URI suitable for LLM consumption.

```typescript
import { imageToDataUri } from 'mojentic/llm/utils/image';

const dataUri = imageToDataUri('./photo.jpg');
// Returns: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
```

**Supported formats:**
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)
- BMP (`.bmp`)
- SVG (`.svg`)

### `imageContent(filePath: string)`

Creates a `ContentItem` for an image, automatically handling the encoding.

```typescript
import { imageContent } from 'mojentic/llm/utils/image';

const imageItem = imageContent('./diagram.png');
// Returns: { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
```

### `textContent(text: string)`

Creates a `ContentItem` for text. Use this when combining text and images in the same message.

```typescript
import { textContent } from 'mojentic/llm/utils/image';

const textItem = textContent('Describe this diagram:');
// Returns: { type: 'text', text: 'Describe this diagram:' }
```

## Multiple Images

You can include multiple images in a single message:

```typescript
const message = {
  role: MessageRole.User,
  content: [
    textContent('Compare these two images:'),
    imageContent('./before.jpg'),
    imageContent('./after.jpg'),
    textContent('What are the key differences?'),
  ],
};
```

## Manual Construction

If you need more control, you can construct multimodal messages manually:

```typescript
import { MessageRole } from 'mojentic';
import { readFileSync } from 'fs';

function imageToDataUri(filePath: string): string {
  const imageBuffer = readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

const message = {
  role: MessageRole.User,
  content: [
    {
      type: 'text' as const,
      text: 'What is in this image?',
    },
    {
      type: 'image_url' as const,
      image_url: {
        url: imageToDataUri('./photo.jpg'),
      },
    },
  ],
};
```

## Vision-Capable Models

### Ollama Models

Popular vision models available via Ollama:

- **qwen3-vl:30b** - Excellent vision understanding and text extraction
- **llava:latest** - General-purpose vision model
- **bakllava:latest** - Enhanced LLaVA variant
- **gemma3:27b** - Google's multimodal model

Pull a model with:
```bash
ollama pull qwen3-vl:30b
```

## Complete Example

Here's a complete working example that analyzes an image:

```typescript
import { LlmBroker, OllamaGateway, MessageRole, isOk } from 'mojentic';
import { imageContent, textContent } from 'mojentic/llm/utils/image';
import { existsSync } from 'fs';
import { join } from 'path';

async function analyzeImage(imagePath: string, prompt: string) {
  // Verify image exists
  if (!existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  // Initialize gateway and broker
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3-vl:30b', gateway);

  // Create multimodal message
  const message = {
    role: MessageRole.User,
    content: [
      textContent(prompt),
      imageContent(imagePath),
    ],
  };

  console.log(`Analyzing: ${imagePath}`);
  console.log(`Prompt: ${prompt}\n`);

  // Generate response
  const result = await broker.generate([message]);

  if (isOk(result)) {
    console.log('Analysis:', result.value);
    return result.value;
  } else {
    throw result.error;
  }
}

// Usage
analyzeImage(
  './photo.jpg',
  'Describe what you see in this image in detail.'
).catch(console.error);
```

## Use Cases

### Document OCR
Extract text from images of documents, receipts, or signs:

```typescript
const message = {
  role: MessageRole.User,
  content: [
    textContent('Extract all text from this document in markdown format.'),
    imageContent('./receipt.jpg'),
  ],
};
```

### Image Comparison
Compare multiple images to identify differences or similarities:

```typescript
const message = {
  role: MessageRole.User,
  content: [
    textContent('Compare these product photos and list the differences:'),
    imageContent('./product_v1.jpg'),
    imageContent('./product_v2.jpg'),
  ],
};
```

### Diagram Understanding
Analyze technical diagrams, charts, or visualizations:

```typescript
const message = {
  role: MessageRole.User,
  content: [
    textContent('Explain the architecture shown in this diagram:'),
    imageContent('./system_architecture.png'),
  ],
};
```

### Accessibility
Generate alt text descriptions for images:

```typescript
const message = {
  role: MessageRole.User,
  content: [
    textContent('Generate a concise alt text description for this image:'),
    imageContent('./photo.jpg'),
  ],
};
```

## Implementation Notes

### Base64 Encoding
Images are automatically converted to base64-encoded data URIs when using the provided utilities. This is required by the Ollama API for image inputs.

### Memory Considerations
Large images consume significant memory when base64-encoded. Consider:
- Resizing images before encoding
- Processing images in batches rather than all at once
- Using appropriate model context windows

### Gateway Support
Currently, multimodal image support is implemented for:
- ✅ OllamaGateway

Support for other gateways (OpenAI, Anthropic) coming soon.

## Error Handling

```typescript
import { isOk, GatewayError } from 'mojentic';

const result = await broker.generate([message]);

if (!isOk(result)) {
  if (result.error instanceof GatewayError) {
    console.error('Gateway error:', result.error.message);
    console.error('Status code:', result.error.statusCode);
  } else {
    console.error('Unexpected error:', result.error);
  }
}
```

## Best Practices

1. **Check file existence** before attempting to read images
2. **Use appropriate models** - ensure your model supports vision
3. **Provide clear prompts** - be specific about what you want to analyze
4. **Handle errors gracefully** - network issues and missing files can occur
5. **Consider image size** - large images may hit token limits or memory constraints
6. **Test with multiple models** - different models have different strengths

## See Also

- [LLM Broker](./broker.md) - Core message handling
- [Tool Usage](./tool-usage.md) - Combining images with tool calls
- [API Reference](./api/core.md) - Type definitions
