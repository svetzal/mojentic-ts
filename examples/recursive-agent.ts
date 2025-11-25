/**
 * Example: Using the SimpleRecursiveAgent
 *
 * For comprehensive documentation on the SimpleRecursiveAgent pattern, see:
 * docs/simple-recursive-agent.md
 *
 * This example demonstrates how to create and use a SimpleRecursiveAgent to solve
 * problems asynchronously, including event handling and concurrent problem-solving.
 */

import {
  SimpleRecursiveAgent,
  GoalAchievedEvent,
  IterationCompletedEvent,
} from '../src/agents/simple-recursive-agent';
import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { DateResolverTool } from '../src/llm/tools/date-resolver';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('SIMPLE RECURSIVE AGENT - EXAMPLE');
  console.log('='.repeat(80) + '\n');

  // Initialize the LLM broker with Ollama
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Example 1: Basic usage
  console.log('Example 1: Basic Usage\n');
  const agent1 = new SimpleRecursiveAgent(broker, [], 3);

  const problem1 = 'What is the capital of France?';
  console.log(`Problem: ${problem1}`);
  const solution1 = await agent1.solve(problem1);
  console.log(`Solution: ${solution1}\n`);

  agent1.dispose();

  // Example 2: With event handling
  console.log('Example 2: With Event Handling\n');
  const agent2 = new SimpleRecursiveAgent(broker, [], 3);

  const problem2 = 'What are the three primary colors?';
  console.log(`Problem: ${problem2}`);

  // Set up event handlers for monitoring the solution process
  const unsubscribeIteration = agent2.emitter.subscribe(
    'iteration-completed',
    (event: IterationCompletedEvent) => {
      console.log(`  Iteration ${event.state.iteration} completed`);
    }
  );

  const unsubscribeSolved = agent2.emitter.subscribe(
    'goal-achieved',
    (event: GoalAchievedEvent) => {
      console.log(`  Problem solved after ${event.state.iteration} iterations`);
    }
  );

  const solution2 = await agent2.solve(problem2);
  console.log(`Solution: ${solution2}\n`);

  // Unsubscribe from events
  unsubscribeIteration();
  unsubscribeSolved();
  agent2.dispose();

  // Example 3: With tools
  console.log('Example 3: With Tools\n');
  const agent3 = new SimpleRecursiveAgent(broker, [new DateResolverTool()], 5);

  const problem3 = "What's the date next Friday?";
  console.log(`Problem: ${problem3}`);
  const solution3 = await agent3.solve(problem3);
  console.log(`Solution: ${solution3}\n`);

  agent3.dispose();

  // Example 4: Running multiple problems concurrently
  console.log('Example 4: Concurrent Problem Solving\n');
  console.log('Running multiple problems concurrently...');

  const agent4 = new SimpleRecursiveAgent(broker, [], 3);

  const problems = [
    'What is the Pythagorean theorem?',
    'Explain the concept of recursion in programming.',
  ];

  async function solveAndPrint(problem: string): Promise<string> {
    console.log(`\nStarted solving: ${problem}`);
    const solution = await agent4.solve(problem);
    console.log(`\nSolution for '${problem}':\n${solution}`);
    return solution;
  }

  // Create tasks for all problems and run them concurrently
  const tasks = problems.map((problem) => solveAndPrint(problem));
  await Promise.all(tasks);

  console.log('\nAll concurrent problems have been solved!');
  agent4.dispose();

  // Example 5: Custom system prompt
  console.log('\n' + '='.repeat(80));
  console.log('Example 5: Custom System Prompt\n');

  const customPrompt =
    'You are a concise assistant that provides brief, factual answers. ' +
    'Always respond in exactly one sentence.';

  const agent5 = new SimpleRecursiveAgent(broker, [], 3, customPrompt);

  const problem5 = 'What is TypeScript?';
  console.log(`Problem: ${problem5}`);
  const solution5 = await agent5.solve(problem5);
  console.log(`Solution: ${solution5}\n`);

  agent5.dispose();

  console.log('='.repeat(80));
  console.log('All examples completed!');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
