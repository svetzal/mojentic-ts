/**
 * Realtime — parallel tool calls in a single voice turn.
 *
 * Asks the model to call three tools at once. The default tool runner on
 * RealtimeVoiceBroker is {@link ParallelToolRunner}, so the calls dispatch
 * concurrently within the single response turn.
 *
 * Run: `npm run example:realtime-parallel`
 */

import {
  CurrentDatetimeTool,
  DateResolverTool,
  OpenAIRealtimeGateway,
  RealtimeVoiceBroker,
  TracerSystem,
  WebSearchTool,
} from '../../src';
import { isOk } from '../../src/error';
import { ToolBatchTracerEvent } from '../../src/tracer';

async function main(): Promise<void> {
  const tracer = new TracerSystem();
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker(
    'gpt-realtime-2',
    gateway,
    {
      instructions:
        'You are a helpful assistant. When the user asks about multiple things, call all relevant tools in a single turn rather than one at a time.',
      modalities: ['text'],
      turnDetection: 'none',
      tools: [new CurrentDatetimeTool(), new DateResolverTool(), new WebSearchTool()],
    },
    tracer
  );

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  await session.sendText(
    'In one paragraph: what is the current date/time, what day is "next Friday", ' +
      'and search for "Mojentic project".'
  );

  let turnsSeen = 0;
  for await (const event of session.events()) {
    switch (event.kind) {
      case 'tool_call_started':
        console.log(`[start  ] ${event.name} (${event.callId.slice(0, 8)})`);
        break;
      case 'tool_call_dispatched':
        console.log(`[dispatch] ${event.name}`);
        break;
      case 'tool_call_completed':
        console.log(`[ok     ] ${event.name}`);
        break;
      case 'tool_call_failed':
        console.log(`[fail   ] ${event.name}: ${event.error.message}`);
        break;
      case 'assistant_text_delta':
        process.stdout.write(event.delta);
        break;
      case 'assistant_turn_completed':
        process.stdout.write('\n');
        turnsSeen++;
        if (turnsSeen >= 2) {
          await session.close();
        }
        break;
      case 'session_closed':
        printBatches(tracer);
        return;
      case 'error':
        console.error('\n[error]', event.error.message);
        await session.close();
        break;
    }
  }
}

function printBatches(tracer: TracerSystem): void {
  const batches = tracer.getEvents({
    eventType: ToolBatchTracerEvent,
  }) as ToolBatchTracerEvent[];
  console.log('\n--- Tool batches ---');
  for (const b of batches) {
    console.log(
      `${b.callCount} tools (${b.successCount} ok / ${b.failureCount} failed) in ${b.durationMs}ms — ${b.toolNames.join(', ')}`
    );
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
