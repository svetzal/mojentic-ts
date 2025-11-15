/**
 * Example demonstrating the usage of the ephemeral task manager tools
 *
 * Run with: npx ts-node examples/ephemeral-task-manager.ts
 */

import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { LlmMessage, MessageRole } from '../src/llm/models';
import { TaskList, allTools } from '../src/llm/tools/ephemeral-task-manager';

async function main() {
  // Create broker with Ollama
  const gateway = new OllamaGateway('http://localhost:11434');
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create shared task list
  const taskList = new TaskList();

  // Create all task management tools
  const tools = allTools(taskList);

  // Ask the LLM to manage a counting task
  const message: LlmMessage = {
    role: MessageRole.User,
    content: `I want you to count from 1 to 5. Break that request down into individual tasks,
     track them using available tools, and perform them one by one until you're finished.
     Report on your progress as you work through the tasks.`,
  };

  console.log('Starting task management example...');
  console.log('='.repeat(80));
  console.log();

  // Generate response with tools
  const result = await broker.generate([message], tools, undefined, 0.0);

  if (result.ok) {
    const response = result.value;
    console.log('LLM Response:');
    console.log(response);
    console.log();
  } else {
    console.error('Error:', result.error.message);
  }

  // Show final task list
  const tasks = taskList.listTasks();

  console.log();
  console.log('='.repeat(80));
  console.log('Final Task List:');
  console.log();

  if (tasks.length === 0) {
    console.log('No tasks in list');
  } else {
    tasks.forEach((task) => {
      console.log(`${task.id}. ${task.description} (${task.status})`);
    });
  }
}

main().catch(console.error);
