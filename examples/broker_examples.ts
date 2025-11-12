/**
 * Comprehensive broker feature tests
 *
 * This example demonstrates all major broker capabilities:
 * - Simple text generation
 * - Structured output with schemas
 * - Tool usage
 * - Image analysis (multimodal)
 *
 * Usage:
 *   npm run example:broker
 *
 * Requirements:
 *   - Ollama running locally (default: http://localhost:11434)
 *   - Models pulled:
 *     - qwen3:32b (for text, structured, tools)
 *     - qwen3-vl:30b (for image analysis)
 */

import { LlmBroker, OllamaGateway, Message, MessageRole, DateResolverTool } from '../src';
import { isOk } from '../src/error';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Sentiment response interface for structured output
interface SentimentAnalysis {
  label: string;
  confidence: number;
}

function printSection(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Read an image file and convert it to a base64 data URI
 */
function imageToDataUri(filePath: string): string {
  const imageBuffer = readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');

  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  const mimeType = mimeTypes[ext || 'jpg'] || 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

async function main() {
  // Initialize gateway and brokers
  const gateway = new OllamaGateway();
  const textBroker = new LlmBroker('qwen3:32b', gateway);
  const visionBroker = new LlmBroker('qwen3-vl:30b', gateway);

  // ============================================================================
  // Test 1: Simple Text Generation
  // ============================================================================
  printSection('Test 1: Simple Text Generation');

  console.log('Testing with model: qwen3:32b');
  const messages1 = [Message.user('Hello, how are you?')];

  const result1 = await textBroker.generate(messages1);

  if (isOk(result1)) {
    console.log('Simple text generation:');
    console.log(`✅ Success: ${result1.value}\n`);
  } else {
    console.log('Simple text generation:');
    console.log(`❌ Error: ${result1.error.message}\n`);
  }

  // ============================================================================
  // Test 2: Structured Output
  // ============================================================================
  printSection('Test 2: Structured Output');

  console.log('Testing structured output with schema...');

  const schema = {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        description: 'label for the sentiment (positive, negative, neutral)',
      },
      confidence: {
        type: 'number',
        description: 'confidence score between 0 and 1',
      },
    },
    required: ['label', 'confidence'],
  };

  const messages2 = [Message.user("I love this product! It's amazing and works perfectly.")];

  const result2 = await textBroker.generateObject<SentimentAnalysis>(messages2, schema);

  if (isOk(result2)) {
    console.log('Structured output:');
    console.log(
      `✅ Success: label: ${result2.value.label}, confidence: ${result2.value.confidence}\n`
    );
  } else {
    console.log('Structured output:');
    console.log(`❌ Error: ${result2.error.message}\n`);
  }

  // ============================================================================
  // Test 3: Tool Usage
  // ============================================================================
  printSection('Test 3: Tool Usage');

  console.log('Testing tool usage with DateResolver...');

  const dateTool = new DateResolverTool();
  const tools = [dateTool];
  const messages3 = [Message.user('What day of the week is Christmas 2025?')];

  const result3 = await textBroker.generate(messages3, tools);

  if (isOk(result3)) {
    console.log('Tool usage:');
    console.log(`✅ Success: ${result3.value}\n`);
  } else {
    console.log('Tool usage:');
    console.log(`❌ Error: ${result3.error.message}\n`);
  }

  // ============================================================================
  // Test 4: Image Analysis (Multimodal)
  // ============================================================================
  printSection('Test 4: Image Analysis (Multimodal)');

  const imagePath = join(__dirname, 'images', 'flash_rom.jpg');

  if (existsSync(imagePath)) {
    console.log('Testing image analysis with model: qwen3-vl:30b');
    console.log(`Image path: ${imagePath}`);

    const imageDataUri = imageToDataUri(imagePath);
    const message4 = {
      role: MessageRole.User,
      content: [
        {
          type: 'text' as const,
          text: 'What text is visible in this image? Please extract all readable text.',
        },
        {
          type: 'image_url' as const,
          image_url: {
            url: imageDataUri,
          },
        },
      ],
    };

    const result4 = await visionBroker.generate([message4]);

    if (isOk(result4)) {
      console.log('Image analysis:');
      console.log(`✅ Success: ${result4.value}\n`);
    } else {
      console.log('Image analysis:');
      console.log(`❌ Error: ${result4.error.message}\n`);
    }
  } else {
    console.log(`❌ Image file not found: ${imagePath}`);
    console.log('Skipping image analysis test.\n');
  }

  // ============================================================================
  // Summary
  // ============================================================================
  printSection('Summary');

  console.log(`
All broker feature tests completed!

Features demonstrated:
✓ Simple text generation
✓ Structured output with JSON schema
✓ Tool calling with DateResolver
✓ Multimodal image analysis

For more detailed examples, see:
- examples/simple_llm.ts
- examples/structured_output.ts
- examples/tool_usage.ts
- examples/image_analysis.ts
`);
}

main().catch(console.error);
