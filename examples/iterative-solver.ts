/**
 * Example: Using the IterativeProblemSolver agent
 *
 * This example demonstrates how to use the IterativeProblemSolver to solve
 * date-related queries using the DateResolverTool and AskUserTool.
 */

import { IterativeProblemSolver } from '../src/agents/iterative-problem-solver';
import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { DateResolverTool } from '../src/llm/tools/date-resolver';
import { AskUserTool } from '../src/llm/tools/ask-user';

async function main() {
  // Initialize the LLM broker with Ollama
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Define a user request
  const userRequest = "What's the date next Friday?";

  console.log('User Request:');
  console.log(userRequest);
  console.log('\n' + '='.repeat(80) + '\n');

  // Create the problem solver with necessary tools
  const solver = new IterativeProblemSolver({
    broker,
    tools: [new DateResolverTool(), new AskUserTool()],
    maxIterations: 5,
  });

  try {
    // Run the solver and get the result
    const result = await solver.solve(userRequest);

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('Final Result:');
    console.log(result);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  } finally {
    solver.dispose();
  }
}

main().catch(console.error);
