/**
 * Quick probe: connect to the realtime API with a given model, send a tiny
 * text prompt, and report success or the first error event. Used to
 * smoke-test which model identifiers our account has access to.
 *
 * Run: `npx ts-node examples/realtime/_probe_model.ts <model-id>`
 */

import { OpenAIRealtimeGateway, RealtimeVoiceBroker } from '../../src';
import { isOk } from '../../src/error';

async function probe(model: string): Promise<{ ok: boolean; detail: string }> {
  const gateway = new OpenAIRealtimeGateway();
  const broker = new RealtimeVoiceBroker(model, gateway, {
    instructions: 'Reply with exactly the word "ok".',
    modalities: ['text'],
    turnDetection: 'none',
  });

  const result = await broker.connect();
  if (!isOk(result)) {
    return { ok: false, detail: `connect failed: ${result.error.message}` };
  }
  const session = result.value;

  const sendResult = await session.sendText('Reply with "ok".');
  if (!isOk(sendResult)) {
    await session.close();
    return { ok: false, detail: `sendText failed: ${sendResult.error.message}` };
  }

  const timeoutMs = 15000;
  let got = '';
  const deadline = Date.now() + timeoutMs;
  for await (const ev of session.events()) {
    if (ev.kind === 'assistant_text_delta') got += ev.delta;
    if (ev.kind === 'assistant_text') got = ev.text;
    if (ev.kind === 'assistant_turn_completed') {
      await session.close();
      return { ok: true, detail: `reply: ${got.trim().slice(0, 80)}` };
    }
    if (ev.kind === 'error') {
      await session.close();
      return { ok: false, detail: `server error: ${ev.error.message}` };
    }
    if (Date.now() > deadline) {
      await session.close();
      return { ok: false, detail: `timed out after ${timeoutMs}ms (partial: "${got}")` };
    }
  }
  return { ok: false, detail: 'event stream ended without completion' };
}

async function main(): Promise<void> {
  const model = process.argv[2];
  if (!model) {
    console.error('Usage: probe_model.ts <model-id>');
    process.exit(2);
  }
  const start = Date.now();
  const { ok, detail } = await probe(model);
  const elapsed = Date.now() - start;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${model} (${elapsed}ms): ${detail}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
