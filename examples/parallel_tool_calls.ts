/**
 * Parallel tool execution example.
 *
 * Demonstrates the {@link ParallelToolRunner} dispatching multiple tool calls
 * concurrently within a single assistant turn. The default {@link LlmBroker}
 * still runs tools serially for back-compat; pass `new ParallelToolRunner()`
 * (optionally with a `maxConcurrency` cap) to opt in.
 *
 * Run: `npm run example:parallel-tools`
 */

import {
  CurrentDatetimeTool,
  DateResolverTool,
  LlmBroker,
  Message,
  OllamaGateway,
  ParallelToolRunner,
  TracerSystem,
  WebSearchTool,
} from '../src';
import { isOk } from '../src/error';
import { ToolBatchTracerEvent } from '../src/tracer';

async function main(): Promise<void> {
  console.log('🚀 Mojentic TypeScript — Parallel Tool Calls\n');

  const gateway = new OllamaGateway();
  const tracer = new TracerSystem();
  const broker = new LlmBroker(
    'qwen3:32b',
    gateway,
    tracer,
    new ParallelToolRunner(4) // opt in to concurrent tool execution
  );

  const tools = [new CurrentDatetimeTool(), new DateResolverTool(), new WebSearchTool()];

  const messages = [
    Message.system(
      'You are a helpful assistant. When the user asks about multiple things, call all relevant tools in a single turn rather than one at a time.'
    ),
    Message.user(
      'What is the current date and time, what day of the week is "next Friday", ' +
        'and search for "TypeScript 6 release notes". Please answer all three.'
    ),
  ];

  console.log('Asking the model to call three tools at once...\n');

  const result = await broker.generate(messages, tools);

  if (isOk(result)) {
    console.log('Response:\n');
    console.log(result.value);
  } else {
    console.error('Error:', result.error.message);
    process.exit(1);
  }

  console.log('\n--- Tool batch trace ---');
  const batches = tracer.getEvents({ eventType: ToolBatchTracerEvent }) as ToolBatchTracerEvent[];
  for (const batch of batches) {
    console.log(
      `batch ${batch.batchId.slice(0, 8)}: ${batch.callCount} tools (` +
        `${batch.successCount} ok / ${batch.failureCount} failed) in ${batch.durationMs}ms`
    );
    console.log(`  → ${batch.toolNames.join(', ')}`);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
