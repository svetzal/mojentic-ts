/**
 * ReAct Pattern Example
 *
 * This example demonstrates the ReAct (Reasoning + Acting) pattern for
 * problem-solving with LLMs. The pattern involves:
 *
 * 1. **Thinking**: Create a plan with multiple steps
 * 2. **Decisioning**: Decide what action to take next (PLAN, ACT, or FINISH)
 * 3. **Acting**: Execute tools to gather information
 * 4. **Observing**: Record results and update context
 * 5. **Summarizing**: Generate final answer when done
 *
 * The loop continues until the agent decides to FINISH or hits max iterations.
 *
 * ## Architecture
 *
 * ```
 * User Query
 *     ↓
 * ThinkingAgent (creates plan)
 *     ↓
 * DecisioningAgent (decides: ACT or FINISH)
 *     ↓
 * ToolCallAgent (executes tool) ←─┐
 *     ↓                             │
 * DecisioningAgent (reconsider) ───┘
 *     ↓
 * SummarizationAgent (final answer)
 * ```
 *
 * ## Available Models
 *
 * - qwen3:32b (default)
 * - qwen3-coder:30b
 * - deepseek-r1:70b
 *
 * @example
 * ```bash
 * npx ts-node examples/react.ts
 * ```
 */

import { randomUUID } from 'crypto';
import { LlmBroker } from '../src/llm/broker';
import { OllamaGateway } from '../src/llm/gateways/ollama';
import { AsyncDispatcher } from '../src/agents/async-dispatcher';
import { Router } from '../src/agents/router';
import { InvokeThinking } from '../src/examples/react/events';
import { CurrentContext } from '../src/examples/react/models';
import { ThinkingAgent } from '../src/examples/react/thinking-agent';
import { DecisioningAgent } from '../src/examples/react/decisioning-agent';
import { ToolCallAgent } from '../src/examples/react/tool-call-agent';
import { SummarizationAgent } from '../src/examples/react/summarization-agent';
import { OutputAgent } from '../src/examples/react/output-agent';

/**
 * Main entry point for the ReAct pattern example.
 */
async function main(): Promise<void> {
  console.log('\n🧠 ReAct Pattern Example - Reasoning + Acting');
  console.log('═'.repeat(80));
  console.log('This example demonstrates multi-step reasoning with tool usage.');
  console.log('═'.repeat(80));

  // Initialize LLM broker with Ollama
  const gateway = new OllamaGateway();
  const model = 'qwen3:32b'; // Try: qwen3-coder:30b, deepseek-r1:70b
  const llm = new LlmBroker(model, gateway);

  console.log(`\n📡 Using model: ${model}`);
  console.log(`🔧 Gateway: Ollama\n`);

  // Create agents
  const thinkingAgent = new ThinkingAgent(llm);
  const decisioningAgent = new DecisioningAgent(llm);
  const toolCallAgent = new ToolCallAgent();
  const summarizationAgent = new SummarizationAgent(llm);
  const outputAgent = new OutputAgent();

  // Configure router for event dispatching
  const router = new Router();
  router.addRoute('InvokeThinking', thinkingAgent);
  router.addRoute('InvokeThinking', outputAgent);
  router.addRoute('InvokeDecisioning', decisioningAgent);
  router.addRoute('InvokeDecisioning', outputAgent);
  router.addRoute('InvokeToolCall', toolCallAgent);
  router.addRoute('InvokeToolCall', outputAgent);
  router.addRoute('FinishAndSummarize', summarizationAgent);
  router.addRoute('FinishAndSummarize', outputAgent);
  router.addRoute('FailureOccurred', outputAgent);

  // Create async dispatcher
  const dispatcher = new AsyncDispatcher(router);

  // Start the ReAct loop with a user query
  const userQuery = 'What is the date next Friday?';
  console.log(`\n❓ User Query: ${userQuery}\n`);

  const initialContext: CurrentContext = {
    userQuery,
    plan: { steps: [] },
    history: [],
    iteration: 0,
  };

  const initialEvent: InvokeThinking = {
    type: 'InvokeThinking',
    source: 'main',
    context: initialContext,
    correlationId: randomUUID(),
  };

  // Dispatch the initial event and let the ReAct loop run
  console.log('🚀 Starting ReAct loop...\n');
  await dispatcher.dispatch(initialEvent);

  // Allow time for async processing to complete
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Stop the dispatcher
  dispatcher.stop();

  console.log('\n✅ ReAct loop completed!');
  console.log('═'.repeat(80));
  console.log('\n💡 The ReAct pattern enables:');
  console.log('  • Multi-step reasoning');
  console.log('  • Dynamic tool selection');
  console.log('  • Iterative problem solving');
  console.log('  • Context-aware decision making\n');
}

// Run the example
main().catch((error) => {
  console.error('❌ Error running ReAct example:', error);
  throw error;
});
