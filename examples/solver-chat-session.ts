/**
 * Example: Chat session with IterativeProblemSolver as a tool
 *
 * This example demonstrates wrapping the IterativeProblemSolver agent as a tool
 * that can be used within a ChatSession. This allows the chat interface to
 * delegate complex multi-step problems to a specialized solver agent.
 *
 * Usage:
 *   npx ts-node examples/solver-chat-session.ts
 *
 * Try queries like:
 *   - "What day is next Friday?"
 *   - "Calculate the date 3 weeks from now"
 *   - "What's the day of the week for Christmas?"
 *
 * Press Ctrl+C to exit
 */

import * as readline from 'readline';
import { LlmBroker, ChatSession } from '../src';
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../src/llm/tools/tool';
import { IterativeProblemSolver } from '../src/agents/iterative-problem-solver';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { DateResolverTool } from '../src/llm/tools/date-resolver';
import { LlmTool } from '../src/llm/tools';
import { Result, Ok, Err } from '../src/error';

/**
 * Tool wrapper that delegates complex problems to an IterativeProblemSolver.
 *
 * This allows a ChatSession to use the IterativeProblemSolver as a regular tool,
 * creating a two-tier architecture:
 * 1. The outer ChatSession handles conversational interaction
 * 2. The inner IterativeProblemSolver handles complex multi-step problems
 */
class IterativeProblemSolverTool extends BaseTool {
  private readonly broker: LlmBroker;
  private readonly tools: LlmTool[];

  constructor(broker: LlmBroker, tools: LlmTool[]) {
    super();
    this.broker = broker;
    this.tools = tools;
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const problemToSolve = args.problem_to_solve as string;

      if (!problemToSolve || typeof problemToSolve !== 'string') {
        return Err(new Error('problem_to_solve must be a non-empty string'));
      }

      const solver = new IterativeProblemSolver({
        broker: this.broker,
        tools: this.tools,
        maxIterations: 5,
      });

      try {
        const result = await solver.solve(problemToSolve);
        return Ok(result);
      } finally {
        solver.dispose();
      }
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'iterative_problem_solver',
        description: 'Iteratively solve a complex multi-step problem using available tools.',
        parameters: {
          type: 'object',
          properties: {
            problem_to_solve: {
              type: 'string',
              description: 'The problem or request to be solved.',
            },
          },
          required: ['problem_to_solve'],
        },
      },
    };
  }
}

async function main() {
  // Create broker with Ollama
  // Using qwen3:32b model
  const gateway = new OllamaGateway();
  const broker = new LlmBroker('qwen3:32b', gateway);

  // Create chat session with solver tool
  // The solver tool itself has access to DateResolverTool
  const solverTool = new IterativeProblemSolverTool(broker, [new DateResolverTool()]);

  const chatSession = new ChatSession(broker, {
    systemPrompt: 'You are a helpful assistant with access to a problem-solving tool.',
    tools: [solverTool],
    maxContext: 32768,
  });

  console.log('Chat session with IterativeProblemSolver started.');
  console.log('Type your queries and press Enter.');
  console.log('Try asking about dates or complex multi-step problems.');
  console.log('Press Ctrl+C to exit.\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Query: ',
  });

  rl.prompt();

  rl.on('line', async (query: string) => {
    if (!query.trim()) {
      rl.close();
      return;
    }

    try {
      const response = await chatSession.send(query);
      console.log(`\n${response}\n`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    chatSession.dispose();
    process.exit(0);
  });
}

main().catch(console.error);
