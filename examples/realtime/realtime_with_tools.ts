/**
 * Realtime — single-tool text-mode demo.
 *
 * Exercises the function-call lifecycle end-to-end without requiring audio.
 *
 * Run: `npm run example:realtime-tools`
 */

import { CurrentDatetimeTool, OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';

async function main(): Promise<void> {
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions:
      'You are a helpful assistant. Call the `get_current_datetime` tool when the user asks about the current time.',
    modalities: ['text'],
    turnDetection: 'none',
    tools: [new CurrentDatetimeTool()],
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  await session.sendText('What is the current date and time? Reply with one short sentence.');

  for await (const event of session.events()) {
    switch (event.kind) {
      case 'tool_call_started':
        console.log(`[tool] ${event.name} requested`);
        break;
      case 'tool_call_dispatched':
        console.log(`[tool] ${event.name} args:`, event.args);
        break;
      case 'tool_call_completed':
        console.log(`[tool] ${event.name} result:`, event.result);
        break;
      case 'assistant_text_delta':
        process.stdout.write(event.delta);
        break;
      case 'assistant_turn_completed':
        process.stdout.write('\n');
        if (event.usage?.totalTokens !== undefined) {
          console.log(`[usage] ${event.usage.totalTokens} tokens`);
        }
        // Wait for one full turn (which may include the post-tool follow-up).
        // The model's follow-up arrives as a fresh turn after we submit
        // function_call_output items.
        if (!(await waitOneMoreTurn(session.events()))) {
          await session.close();
        }
        break;
      case 'session_closed':
        return;
      case 'error':
        console.error('\n[error]', event.error.message);
        await session.close();
        break;
    }
  }
}

async function waitOneMoreTurn(events: AsyncIterable<{ kind: string }>): Promise<boolean> {
  // Peek: returns true once we see the next assistant_turn_completed.
  for await (const ev of events) {
    if (ev.kind === 'assistant_turn_completed') return false;
  }
  return false;
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
