/**
 * Shared audio I/O helpers for realtime examples.
 *
 * Wraps `audify` (PortAudio/RtAudio with prebuilt native binaries) into the
 * stream shapes the realtime broker already speaks:
 *
 * - `micStream()` → `AsyncIterable<Int16Array>` you hand to `session.sendAudio`.
 * - `speakerSink()` → `{ write, close }` you call from your `audioOutput`
 *   loop.
 *
 * `audify` is a **devDependency** — it ships prebuilt binaries for macOS
 * (incl. Apple Silicon), Linux, and Windows. It is intentionally kept out
 * of the library's runtime deps because native audio bindings don't belong
 * in a hardware-free framework. These helpers are example glue only.
 */

import { RtAudio, RtAudioFormat } from 'audify';

const OPENAI_RATE = 24000;
// macOS CoreAudio (and most consumer hardware) won't open at 24k; 48k is
// the universal common ground. We resample 2:1 between device and OpenAI.
const DEVICE_RATE = 48000;
const FRAME_SAMPLES_DEVICE = 960; // 20ms @ 48kHz
const CHANNELS = 1;

/** Decimate 48 kHz → 24 kHz by simple 2:1 averaging (cheap low-pass). */
function downsample48to24(frame: Int16Array): Int16Array {
  const out = new Int16Array(frame.length >> 1);
  for (let i = 0, j = 0; j < out.length; i += 2, j++) {
    // eslint-disable-next-line security/detect-object-injection -- bounded indices
    out[j] = (frame[i] + frame[i + 1]) >> 1;
  }
  return out;
}

/** Linear upsample 24 kHz → 48 kHz by sample duplication. */
function upsample24to48(frame: Int16Array): Int16Array {
  /* eslint-disable security/detect-object-injection -- bounded indices */
  const out = new Int16Array(frame.length << 1);
  for (let i = 0, j = 0; i < frame.length; i++, j += 2) {
    const s = frame[i];
    out[j] = s;
    out[j + 1] = s;
  }
  return out;
  /* eslint-enable security/detect-object-injection */
}

interface RtAudioStreamParams {
  deviceId: number;
  nChannels: number;
  firstChannel: number;
}

/**
 * Open the default microphone and yield PCM16 frames as they arrive.
 *
 * The generator runs until the returned `stop` function is called or the
 * consumer breaks out of the `for await` loop.
 */
export function micStream(): {
  frames: AsyncIterable<Int16Array>;
  stop: () => void;
  /**
   * Enable or disable forwarding of captured frames. When disabled, the
   * device keeps running but frames are dropped instead of yielded. Use
   * this to implement half-duplex mute (mic off while assistant is
   * speaking) when running over a laptop speaker/mic combo without
   * acoustic echo cancellation.
   */
  setEnabled: (on: boolean) => void;
} {
  const rt = new RtAudio();
  const inputParams: RtAudioStreamParams = {
    deviceId: rt.getDefaultInputDevice(),
    nChannels: CHANNELS,
    firstChannel: 0,
  };

  const queue: Int16Array[] = [];
  const waiters: Array<(v: IteratorResult<Int16Array>) => void> = [];
  let stopped = false;
  let enabled = true;

  const push = (frame: Int16Array): void => {
    const waiter = waiters.shift();
    if (waiter) waiter({ value: frame, done: false });
    else queue.push(frame);
  };
  const end = (): void => {
    stopped = true;
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter?.({ value: undefined as unknown as Int16Array, done: true });
    }
  };

  rt.openStream(
    null,
    inputParams,
    RtAudioFormat.RTAUDIO_SINT16,
    DEVICE_RATE,
    FRAME_SAMPLES_DEVICE,
    'mojentic-realtime-in',
    (pcm: Buffer) => {
      if (!enabled) return;
      // audify hands us a Buffer of raw little-endian PCM16 at DEVICE_RATE.
      const wide = new Int16Array(pcm.length / 2);
      for (let i = 0; i < wide.length; i++) {
        // eslint-disable-next-line security/detect-object-injection -- bounded index
        wide[i] = pcm.readInt16LE(i * 2);
      }
      push(downsample48to24(wide));
    },
    null
  );
  rt.start();

  const frames: AsyncIterable<Int16Array> = {
    [Symbol.asyncIterator](): AsyncIterator<Int16Array> {
      return {
        next: async (): Promise<IteratorResult<Int16Array>> => {
          if (queue.length > 0) {
            return { value: queue.shift() as Int16Array, done: false };
          }
          if (stopped) return { value: undefined as unknown as Int16Array, done: true };
          return new Promise((resolve) => waiters.push(resolve));
        },
        return: async (): Promise<IteratorResult<Int16Array>> => {
          end();
          try {
            rt.closeStream();
          } catch {
            /* best-effort */
          }
          return { value: undefined as unknown as Int16Array, done: true };
        },
      };
    },
  };

  return {
    frames,
    stop: () => {
      end();
      try {
        rt.closeStream();
      } catch {
        /* best-effort */
      }
    },
    setEnabled: (on: boolean) => {
      enabled = on;
    },
  };
}

/**
 * Open the default speaker and return a sink callable from your
 * `audioOutput` loop.
 *
 * Frames are queued and drained to the audio device automatically by
 * audify's internal buffer.
 */
export function speakerSink(): {
  write: (frame: Int16Array) => void;
  close: () => void;
} {
  const rt = new RtAudio();
  const outputParams: RtAudioStreamParams = {
    deviceId: rt.getDefaultOutputDevice(),
    nChannels: CHANNELS,
    firstChannel: 0,
  };

  rt.openStream(
    outputParams,
    null,
    RtAudioFormat.RTAUDIO_SINT16,
    DEVICE_RATE,
    FRAME_SAMPLES_DEVICE,
    'mojentic-realtime-out',
    null,
    null
  );
  rt.start();

  // RtAudio.write() requires exactly FRAME_SAMPLES_DEVICE samples per call.
  // OpenAI sends arbitrarily-sized frames, so we buffer and emit fixed chunks.
  let pending = new Int16Array(0);
  const CHUNK_BYTES = FRAME_SAMPLES_DEVICE * 2;

  const flushChunks = (): void => {
    while (pending.length >= FRAME_SAMPLES_DEVICE) {
      const chunk = pending.subarray(0, FRAME_SAMPLES_DEVICE);
      pending = pending.subarray(FRAME_SAMPLES_DEVICE);
      const buf = Buffer.from(chunk.buffer, chunk.byteOffset, CHUNK_BYTES);
      rt.write(buf);
    }
  };

  return {
    write: (frame: Int16Array) => {
      // Incoming frames are 24kHz; the device is open at 48kHz.
      const wide = upsample24to48(frame);
      const merged = new Int16Array(pending.length + wide.length);
      merged.set(pending, 0);
      merged.set(wide, pending.length);
      pending = merged;
      flushChunks();
    },
    close: () => {
      if (pending.length > 0) {
        // Pad the tail with silence so the device gets a full frame.
        const padded = new Int16Array(FRAME_SAMPLES_DEVICE);
        padded.set(pending, 0);
        const buf = Buffer.from(padded.buffer, padded.byteOffset, CHUNK_BYTES);
        try {
          rt.write(buf);
        } catch {
          /* best-effort during shutdown */
        }
        pending = new Int16Array(0);
      }
      try {
        rt.closeStream();
      } catch {
        /* best-effort */
      }
    },
  };
}

export const REALTIME_SAMPLE_RATE = OPENAI_RATE;
