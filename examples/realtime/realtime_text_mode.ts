/**
 * Realtime — text-mode hello world.
 *
 * Connects in text-only modality so this example runs anywhere without an
 * audio device. Demonstrates the streaming assistant_text_delta events and
 * the assistant_turn_completed event.
 *
 * Requires OPENAI_API_KEY. Run: `npm run example:realtime-text`
 */

import { OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';

async function main(): Promise<void> {
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions: 'You are a concise assistant. Answer in one or two sentences.',
    modalities: ['text'],
    turnDetection: 'none',
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  await session.sendText('In one sentence, what is the Mojentic project?');

  for await (const event of session.events()) {
    switch (event.kind) {
      case 'assistant_text_delta':
        process.stdout.write(event.delta);
        break;
      case 'assistant_turn_completed':
        process.stdout.write('\n');
        await session.close();
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

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
