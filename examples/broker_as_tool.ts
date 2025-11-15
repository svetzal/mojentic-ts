/**
 * Broker as Tool Example - Agent delegation pattern
 *
 * Demonstrates how to wrap agents as tools using ToolWrapper,
 * enabling hierarchical agent systems where a coordinator agent
 * delegates tasks to specialist agents.
 */

import {
  LlmBroker,
  OllamaGateway,
  Agent,
  ToolWrapper,
  DateResolverTool,
  CurrentDatetimeTool,
} from '../src';
import { isOk } from '../src/error';

async function main() {
  console.log('🚀 Mojentic TypeScript - Broker as Tool Example\n');
  console.log('This example shows agent delegation using ToolWrapper\n');

  // Initialize the gateway
  const gateway = new OllamaGateway();

  // Create a temporal specialist agent
  // This agent specializes in date and time-related queries
  const temporalSpecialist = new Agent(
    new LlmBroker('qwen3:7b', gateway),
    [new DateResolverTool(), new CurrentDatetimeTool()],
    `You are a temporal specialist with deep knowledge of dates and time.
Your expertise includes:
- Resolving relative date references (tomorrow, next Friday, etc.)
- Providing current date and time information
- Calculating date differences and patterns
- Understanding calendrical systems

Always be precise and provide complete date information including day of week when relevant.`
  );

  // Create a general knowledge specialist agent
  const generalKnowledgeSpecialist = new Agent(
    new LlmBroker('qwen3:7b', gateway),
    [],
    `You are a general knowledge specialist with expertise in:
- Science and technology
- History and geography
- Arts and culture
- General facts and trivia

Provide clear, concise, and accurate information.`
  );

  // Create a coordinator agent that uses specialists as tools
  const coordinator = new Agent(
    new LlmBroker('qwen3:32b', gateway),
    [
      new ToolWrapper(
        temporalSpecialist,
        'temporal_specialist',
        'A specialist in dates, time, and temporal queries. Use this for any questions about dates, times, calendars, or temporal references.'
      ),
      new ToolWrapper(
        generalKnowledgeSpecialist,
        'knowledge_specialist',
        'A general knowledge expert. Use this for questions about science, history, geography, culture, or general facts.'
      ),
    ],
    `You are an intelligent coordinator that delegates tasks to specialist agents.

Your role:
1. Analyze the user's request
2. Determine which specialist(s) can best help
3. Delegate to the appropriate specialist(s)
4. Synthesize their responses into a coherent answer

Available specialists:
- temporal_specialist: For date/time queries
- knowledge_specialist: For general knowledge questions

Use the specialists when their expertise is relevant. You can call multiple specialists if needed.`
  );

  console.log('='.repeat(60));
  console.log('Example 1: Temporal Query');
  console.log('='.repeat(60));
  console.log('Question: What day of the week is next Friday?\n');

  const result1 = await coordinator.generate('What day of the week is next Friday?');

  if (isOk(result1)) {
    console.log('Coordinator Response:');
    console.log(result1.value);
    console.log();
  } else {
    console.error('Error:', result1.error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Example 2: Combined Query');
  console.log('='.repeat(60));
  console.log('Question: What day is tomorrow and what year did World War II end?\n');

  const result2 = await coordinator.generate(
    'What day is tomorrow and what year did World War II end?'
  );

  if (isOk(result2)) {
    console.log('Coordinator Response:');
    console.log(result2.value);
    console.log();
  } else {
    console.error('Error:', result2.error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Example 3: General Knowledge Query');
  console.log('='.repeat(60));
  console.log('Question: What is TypeScript and why is it useful?\n');

  const result3 = await coordinator.generate('What is TypeScript and why is it useful?');

  if (isOk(result3)) {
    console.log('Coordinator Response:');
    console.log(result3.value);
    console.log();
  } else {
    console.error('Error:', result3.error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Example 4: Complex Multi-Specialist Query');
  console.log('='.repeat(60));
  console.log(
    'Question: If today is the current date, calculate when was exactly 100 days ago, and tell me about a significant historical event from that approximate time period in history.\n'
  );

  const result4 = await coordinator.generate(
    'If today is the current date, calculate when was exactly 100 days ago, and tell me about a significant historical event from that approximate time period in history.'
  );

  if (isOk(result4)) {
    console.log('Coordinator Response:');
    console.log(result4.value);
    console.log();
  } else {
    console.error('Error:', result4.error.message);
  }

  console.log('\n✅ Agent delegation example completed!');
  console.log('\nKey takeaways:');
  console.log('- Agents can be wrapped as tools using ToolWrapper');
  console.log('- Coordinator agents can delegate to specialist agents');
  console.log('- Each specialist has its own tools and behavior');
  console.log('- This enables hierarchical agent architectures');
}

main().catch(console.error);
