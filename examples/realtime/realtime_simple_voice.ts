/**
 * Realtime — simple voice example using a WAV file source/sink.
 *
 * We stay hardware-free: the input is a WAV file path read frame-by-frame,
 * the output is written to another WAV file. Wire your own mic/speaker via
 * `node-mic` / `speaker` when running interactively — but those bindings
 * are platform-fragile and intentionally out of scope for the library.
 *
 * Run: `npm run example:realtime-voice -- input.wav output.wav`
 */

import { promises as fs } from 'fs';
import { OpenAIRealtimeGateway, RealtimeVoiceBroker, encodeBase64Pcm16 } from '../../src';
import { isOk } from '../../src/error';

const FRAME_SAMPLES = 1200; // 50ms @ 24kHz

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: realtime_simple_voice.ts <input.wav> <output.wav>');
    process.exit(1);
  }

  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker('gpt-realtime-2', gateway, {
    instructions: 'Respond aloud, briefly.',
    modalities: ['audio', 'text'],
    voice: 'verse',
    turnDetection: 'server_vad',
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    console.error('Failed to connect:', result.error.message);
    process.exit(1);
  }
  const session = result.value;

  const inputPcm = await readWavAsPcm16(inputPath);
  const outputChunks: Int16Array[] = [];

  // Stream input audio in 50ms frames.
  const audioInput = async function* (): AsyncGenerator<Int16Array> {
    for (let i = 0; i < inputPcm.length; i += FRAME_SAMPLES) {
      yield inputPcm.subarray(i, Math.min(i + FRAME_SAMPLES, inputPcm.length));
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  const sendPromise = session.sendAudio(audioInput()).then(async () => {
    // For server VAD, commit + response.create are handled automatically.
    // Wait briefly for the assistant turn, then close.
    await new Promise((r) => setTimeout(r, 6000));
    await session.close();
  });

  for await (const event of session.events()) {
    if (event.kind === 'assistant_audio_delta') {
      outputChunks.push(event.pcm);
    } else if (event.kind === 'assistant_transcript') {
      console.log('[assistant]', event.text);
    } else if (event.kind === 'user_transcript') {
      console.log('[user]', event.text);
    } else if (event.kind === 'session_closed') {
      break;
    }
  }
  await sendPromise;

  await writeWavFromPcm16(outputPath, mergeChunks(outputChunks), 24000);
  console.log(`Wrote ${outputPath}`);
  // Touch the unused helper to make ESLint happy in the example.
  void encodeBase64Pcm16;
}

async function readWavAsPcm16(path: string): Promise<Int16Array> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI example, user supplies path
  const buf = await fs.readFile(path);
  // Minimal WAV reader: assumes PCM mono 16-bit at unspecified rate. Skips
  // header to first `data` chunk.
  const dataIdx = buf.indexOf('data');
  if (dataIdx < 0) throw new Error(`No data chunk in ${path}`);
  const dataStart = dataIdx + 8; // 'data' + size
  const samples = new Int16Array((buf.length - dataStart) / 2);
  for (let i = 0; i < samples.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- bounded index
    samples[i] = buf.readInt16LE(dataStart + i * 2);
  }
  return samples;
}

function mergeChunks(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function writeWavFromPcm16(
  path: string,
  samples: Int16Array,
  sampleRate: number
): Promise<void> {
  const byteLength = samples.length * 2;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(byteLength, 40);

  const body = Buffer.alloc(byteLength);
  for (let i = 0; i < samples.length; i++) {
    // eslint-disable-next-line security/detect-object-injection -- bounded index
    body.writeInt16LE(samples[i], i * 2);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI example, user supplies path
  await fs.writeFile(path, Buffer.concat([header, body]));
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
