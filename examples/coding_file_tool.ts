/**
 * Example: Coding with file management tools and task tracking
 *
 * This example demonstrates the use of all file management tools combined with
 * task management tools for systematic coding work.
 *
 * It creates a sandbox directory and equips an LLM with access to:
 * - File management tools (read, write, list, find, create directories)
 * - Task management tools (for planning and tracking work)
 *
 * The LLM is then given a coding task that requires using these tools to
 * create a small TypeScript project with tests.
 *
 * Run with: npx ts-node examples/coding_file_tool.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { LlmMessage, MessageRole } from '../src/llm/models';
import {
  FilesystemGateway,
  ListFilesTool,
  ReadFileTool,
  WriteFileTool,
  ListAllFilesTool,
  FindFilesByGlobTool,
  FindFilesContainingTool,
  FindLinesMatchingTool,
  CreateDirectoryTool,
} from '../src/llm/tools/file-manager';
import { TaskList, allTools as allTaskTools } from '../src/llm/tools/ephemeral-task-manager';

async function main() {
  // Create a sandbox directory for the coding project
  const sandboxDir = path.join(os.tmpdir(), 'mojentic_coding_example');

  // Clean up and recreate sandbox
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Example code setting up sandbox
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true });
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Example code setting up sandbox
  fs.mkdirSync(sandboxDir, { recursive: true });

  console.log('='.repeat(80));
  console.log('Coding File Tool Example');
  console.log('='.repeat(80));
  console.log();
  console.log(`Sandbox directory: ${sandboxDir}`);
  console.log();

  // Create FilesystemGateway and file management tools
  const filesystemGateway = new FilesystemGateway(sandboxDir);

  const fileTools = [
    new ListFilesTool(filesystemGateway),
    new ReadFileTool(filesystemGateway),
    new WriteFileTool(filesystemGateway),
    new ListAllFilesTool(filesystemGateway),
    new FindFilesByGlobTool(filesystemGateway),
    new FindFilesContainingTool(filesystemGateway),
    new FindLinesMatchingTool(filesystemGateway),
    new CreateDirectoryTool(filesystemGateway),
  ];

  // Create task management tools
  const taskList = new TaskList();
  const taskTools = allTaskTools(taskList);

  // Combine all tools
  const allTools = [...fileTools, ...taskTools];

  // Create LLM broker with qwen3-coder model for coding tasks
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3-coder:30b', gateway);

  // System prompt with coding best practices
  const systemPrompt = `# Role and Context

You are an expert and principled software engineer, well versed in writing TypeScript programs.
You work carefully and purposefully and always check your work with an eye to testability
and correctness. You know that every line of code you write is a liability, and you take
care that every line matters.

# Universal Engineering Principles

* **Code is communication** — optimise for the next human reader.
* **Simple Design Heuristics**:
  1. **All tests pass** — correctness is non-negotiable.
  2. **Reveals intent** — code should read like an explanation.
  3. **No knowledge duplication** — avoid multiple spots that must change together.
  4. **Minimal entities** — remove unnecessary indirection or classes.
* **Small, safe increments** — single-reason commits; avoid speculative work (YAGNI).
* **Tests are the executable spec** — test behaviour not implementation.
* **Functional core, imperative shell** — isolate pure logic from I/O and side effects.

# Planning and Goal Tracking

- Use the task management tools to create your plans and work through them step by step.
- Before declaring yourself finished, list all tasks and ensure they are all complete.
- If you've missed or forgotten steps, add them to the task list and continue.
- When all tasks are complete, and you can think of no more to add, declare yourself finished.

# File Management

- All file operations must be done through the provided tools.
- The sandbox root is: ${sandboxDir}
- Use relative paths from the sandbox root (e.g., "src/calculator.ts", not absolute paths).
- Always verify your work by reading back files you create or modify.

# Task Instructions

Work systematically:
1. Break down the problem into clear tasks
2. Create the task list using task management tools
3. Work through each task one by one
4. Mark tasks complete as you finish them
5. Verify your work at each step`;

  // Define the coding task
  const task = `Create a simple TypeScript calculator module with the following features:

1. A Calculator class with basic operations (add, subtract, multiply, divide)
2. Proper error handling for division by zero
3. A comprehensive test file using Jest that tests all operations
4. A README.md explaining how to use the calculator

Keep it simple but well-structured and properly tested.`;

  console.log('Task assigned to LLM:');
  console.log(task);
  console.log();
  console.log('Working on task...');
  console.log('-'.repeat(80));
  console.log();

  const messages: LlmMessage[] = [
    { role: MessageRole.System, content: systemPrompt },
    { role: MessageRole.User, content: task },
  ];

  // Generate response
  const result = await broker.generate(messages, allTools, { temperature: 0.1 });

  console.log();
  console.log('-'.repeat(80));

  if (result.ok) {
    console.log('LLM Response:');
    console.log(result.value);
  } else {
    console.log('Error:', result.error.message);
  }

  console.log();
  console.log('='.repeat(80));
  console.log('Final Results');
  console.log('='.repeat(80));
  console.log();

  // Show final task list
  const tasks = taskList.listTasks();

  console.log('Task List Status:');
  if (tasks.length === 0) {
    console.log('  No tasks in list');
  } else {
    tasks.forEach((task) => {
      console.log(`  ${task.id}. ${task.description} (${task.status})`);
    });
  }

  console.log();

  // Show created files
  console.log('Files created:');
  const allFiles = listAllFilesRecursive(sandboxDir);

  if (allFiles.length === 0) {
    console.log('  No files created');
  } else {
    allFiles.forEach((file) => {
      const relativePath = path.relative(sandboxDir, file);
      console.log(`  - ${relativePath}`);
    });
  }

  console.log();
  console.log(`Sandbox directory preserved at: ${sandboxDir}`);
  console.log('You can inspect the generated code and run tests with:');
  console.log(`  cd ${sandboxDir}`);
  console.log(`  npm init -y && npm install --save-dev jest @types/jest ts-jest`);
  console.log(`  npx jest calculator.test.ts  # (if Jest is configured)`);
  console.log();

  console.log('Done!');
}

// Helper function to list all files recursively
function listAllFilesRecursive(dir: string): string[] {
  const results: string[] = [];

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Example code traversing sandbox directory
  if (!fs.existsSync(dir)) {
    return results;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Example code traversing sandbox directory
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listAllFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

main().catch(console.error);
