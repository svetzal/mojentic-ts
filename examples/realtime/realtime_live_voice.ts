/**
 * Realtime — live mic-to-speaker voice example.
 *
 * Uses `audify` (devDependency) for real-time mic capture and speaker
 * playback. Holds the session open until Ctrl-C.
 *
 * **Headphone mode (default):** assumes you're wearing headphones so the
 * mic doesn't hear the speaker. Barge-in works normally.
 *
 * **Half-duplex mode:** mutes the mic while the assistant is speaking so
 * laptop-speaker → laptop-mic feedback can't loop. Trades barge-in for
 * speaker-only operation. Enable with either:
 *
 *     npm run example:realtime-live -- --half-duplex
 *     HALF_DUPLEX=1 npm run example:realtime-live
 *
 * We don't ship acoustic echo cancellation; doing it well needs WebRTC's
 * AEC3 and has no good prebuilt Node binding. Use headphones for the
 * cleanest experience.
 *
 * Run: `npm run example:realtime-live`
 */

import { OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';
import { micStream, speakerSink } from './_audio';

const HALF_DUPLEX =
  process.argv.includes('--half-duplex') ||
  process.env.HALF_DUPLEX === '1' ||
  process.env.HALF_DUPLEX === 'true';

async function main(): Promise<void> {
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions: 'You are a concise, friendly assistant. Keep replies short.',
    voice: 'verse',
    modalities: ['audio', 'text'],
    // `threshold` is 0.0–1.0 (default ≈ 0.5). Higher = less sensitive, so
    // background noise won't trip the VAD. `silenceDurationMs` controls how
    // long after you stop speaking before the turn closes — lower = snappier
    // responses but more sensitive to mid-sentence pauses.
    // `interruptResponse: false` prevents background noise from cancelling
    // an in-flight assistant reply.
    turnDetection: {
      type: 'server_vad',
      threshold: 0.95,
      silenceDurationMs: 300,
      interruptResponse: false,
    },
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  const mic = micStream();
  const speaker = speakerSink();
  let stopping = false;

  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log('\n[shutting down]');
    mic.stop();
    speaker.close();
    await session.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  // Pump mic into the session in the background.
  void session.sendAudio(mic.frames);

  console.log(
    `🎙️  Speak into your microphone. Ctrl-C to exit. ` +
      `[${HALF_DUPLEX ? 'half-duplex' : 'headphone mode — barge-in enabled'}]\n`
  );

  for await (const event of session.events()) {
    switch (event.kind) {
      case 'user_speech_started':
        process.stdout.write('🧑 ');
        break;
      case 'user_transcript':
        console.log(`(you said: "${event.text}")`);
        break;
      case 'assistant_turn_started':
        if (HALF_DUPLEX) mic.setEnabled(false);
        break;
      case 'assistant_transcript_delta':
        process.stdout.write(event.delta);
        break;
      case 'assistant_audio_delta':
        speaker.write(event.pcm);
        break;
      case 'assistant_turn_completed':
        process.stdout.write('\n');
        if (HALF_DUPLEX) {
          // Give the speaker a moment to drain the last chunks before
          // re-enabling the mic; otherwise the tail of the played audio
          // gets captured.
          setTimeout(() => mic.setEnabled(true), 300);
        }
        break;
      case 'interrupted':
        console.log(`[interrupted: ${event.reason}]`);
        if (HALF_DUPLEX) mic.setEnabled(true);
        break;
      case 'error':
        console.error('[error]', event.error.message);
        break;
      case 'session_closed':
        await shutdown();
        return;
    }
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
