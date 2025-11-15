/**
 * Example: Using file management tools with the LLM
 *
 * This example demonstrates the file management tools (ReadFileTool, WriteFileTool)
 * which allow the LLM to read and write files within a sandboxed directory.
 *
 * The example:
 * 1. Creates a sample unfinished story file
 * 2. Asks the LLM to read it
 * 3. Asks the LLM to complete the story and save it to a new file
 *
 * Usage:
 *   npx ts-node examples/file_tool.ts
 *
 * Note: This example requires Ollama to be running locally.
 * The file operations are sandboxed to the /tmp directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LlmBroker, Message } from '../src';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { FilesystemGateway, ReadFileTool, WriteFileTool } from '../src/llm/tools/file-manager';

async function main() {
  // Setup sandbox directory
  const sandboxDir = '/tmp';

  // Create an unfinished story
  const storyPath = path.join(sandboxDir, 'ernie.md');
  const storyContent = `# Ernie the Caterpillar

This is an unfinished story about Ernie, the most adorable and colourful caterpillar.`;

  fs.writeFileSync(storyPath, storyContent);
  console.log(`Created sample story at: ${storyPath}\n`);

  // Create filesystem gateway and tools
  const filesystemGateway = new FilesystemGateway(sandboxDir);
  const readTool = new ReadFileTool(filesystemGateway);
  const writeTool = new WriteFileTool(filesystemGateway);

  // Create broker with tools
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  console.log('Asking LLM to read and complete the story...\n');
  console.log('This may take a moment as the LLM:\n');
  console.log('1. Reads the unfinished story from ernie.md');
  console.log('2. Completes the story');
  console.log('3. Writes the completed story to ernie2.md\n');

  // Ask the LLM to read and complete the story
  const result = await broker.generate(
    [
      Message.system('You are a helpful assistant with access to file operations.'),
      Message.user(`Step 1 - Read the unfinished story in ernie.md
Step 2 - Complete the story and store it in ernie2.md`),
    ],
    [readTool, writeTool],
    { temperature: 0.7 }
  );

  if (!result.ok) {
    console.error('Error:', result.error.message);
    return;
  }

  console.log('LLM Response:');
  console.log(result.value);

  // Show the completed story if it exists
  const completedPath = path.join(sandboxDir, 'ernie2.md');
  if (fs.existsSync(completedPath)) {
    console.log('\n' + '='.repeat(60));
    console.log('Completed story from ernie2.md:');
    console.log('='.repeat(60));
    const completedContent = fs.readFileSync(completedPath, 'utf-8');
    console.log(completedContent);
  } else {
    console.log('\nNote: The completed story file was not created.');
    console.log('This can happen with some models that struggle with multi-step tool calls.');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Files in /tmp:');
  console.log('='.repeat(60));
  const files = fs.readdirSync(sandboxDir).filter((f: string) => f.startsWith('ernie'));
  files.forEach((file: string) => console.log(`  - ${file}`));
}

main().catch(console.error);
