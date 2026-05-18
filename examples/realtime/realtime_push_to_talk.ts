/**
 * Realtime — push-to-talk demo.
 *
 * Uses `turnDetection: 'none'` and `commitAudio()` to manually close the
 * input buffer. Good for CLI demos where you don't want server VAD to
 * decide when you're done speaking.
 *
 * Run: `npm run example:realtime-ptt -- input.wav`
 */

import { promises as fs } from 'fs';
import { OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';

const FRAME_SAMPLES = 1200; // 50ms @ 24kHz

async function main(): Promise<void> {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error('Usage: realtime_push_to_talk.ts <input.wav>');
    process.exit(1);
  }

  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions: 'Listen, then reply briefly in text only.',
    modalities: ['text'],
    voice: 'verse',
    turnDetection: 'none',
    inputAudioTranscription: { model: 'whisper-1' },
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  const pcm = await readWavAsPcm16(inputPath);

  const audioInput = async function* (): AsyncGenerator<Int16Array> {
    for (let i = 0; i < pcm.length; i += FRAME_SAMPLES) {
      yield pcm.subarray(i, Math.min(i + FRAME_SAMPLES, pcm.length));
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const send = session.sendAudio(audioInput()).then(async () => {
    // Manual commit + response.create (push-to-talk release).
    await session.commitAudio();
  });

  for await (const event of session.events()) {
    switch (event.kind) {
      case 'user_transcript':
        console.log('[heard]', event.text);
        break;
      case 'assistant_text_delta':
        process.stdout.write(event.delta);
        break;
      case 'assistant_turn_completed':
        process.stdout.write('\n');
        await session.close();
        break;
      case 'session_closed':
        await send;
        return;
    }
  }
}

async function readWavAsPcm16(path: string): Promise<Int16Array> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI example, user supplies path
  const buf = await fs.readFile(path);
  const dataIdx = buf.indexOf('data');
  if (dataIdx < 0) throw new Error(`No data chunk in ${path}`);
  const dataStart = dataIdx + 8;
  const samples = new Int16Array((buf.length - dataStart) / 2);
  for (let i = 0; i < samples.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- bounded index
    samples[i] = buf.readInt16LE(dataStart + i * 2);
  }
  return samples;
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
