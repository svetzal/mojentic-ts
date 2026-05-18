/**
 * Realtime — barge-in / interruption demo.
 *
 * Demonstrates `session.interrupt()` cancelling an in-flight assistant
 * response. In a real voice flow this would also fire from server VAD
 * detecting the user speaking over the assistant.
 *
 * Run: `npm run example:realtime-interrupt`
 */

import { OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';

async function main(): Promise<void> {
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions:
      'You are a verbose assistant. When asked a question, answer in at least four sentences.',
    modalities: ['text'],
    turnDetection: 'none',
    onInterrupt: 'drop',
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  await session.sendText('Tell me a long story about a bridge.');

  let charsSeen = 0;
  for await (const event of session.events()) {
    switch (event.kind) {
      case 'assistant_text_delta':
        process.stdout.write(event.delta);
        charsSeen += event.delta.length;
        if (charsSeen > 80) {
          console.log('\n[interrupting]');
          await session.interrupt();
        }
        break;
      case 'interrupted':
        console.log(`[interrupted: ${event.reason}]`);
        await session.close();
        break;
      case 'session_closed':
        return;
    }
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
