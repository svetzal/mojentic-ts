/**
 * Tests for OpenAI realtime event schema parsing.
 */

import {
  parseServerEvent,
  serverEventSchema,
  audioDeltaSchema,
  responseDoneSchema,
} from './schemas';

describe('serverEventSchema', () => {
  test('accepts a valid session.created event', () => {
    const parsed = serverEventSchema.parse({
      type: 'session.created',
      session: { id: 'sess_123', voice: 'verse' },
    });
    expect(parsed.type).toBe('session.created');
  });

  test('accepts function_call_arguments.delta with call_id', () => {
    const parsed = serverEventSchema.parse({
      type: 'response.function_call_arguments.delta',
      response_id: 'resp_1',
      call_id: 'call_42',
      delta: '{"loc"',
    });
    expect(parsed.type).toBe('response.function_call_arguments.delta');
    if (parsed.type === 'response.function_call_arguments.delta') {
      expect(parsed.call_id).toBe('call_42');
    }
  });

  test('rejects an event missing required fields', () => {
    const result = audioDeltaSchema.safeParse({
      type: 'response.audio.delta',
    });
    expect(result.success).toBe(false);
  });

  test('tolerates extra fields via passthrough on response.done', () => {
    const parsed = responseDoneSchema.parse({
      type: 'response.done',
      response: { id: 'resp_1', some_future_field: 42 },
    });
    expect(parsed.response.id).toBe('resp_1');
  });
});

describe('parseServerEvent', () => {
  test('returns validated event for known shapes', () => {
    const parsed = parseServerEvent({
      type: 'response.created',
      response: { id: 'resp_1' },
    });
    expect(parsed.type).toBe('response.created');
  });

  test('returns raw payload for unknown types', () => {
    const parsed = parseServerEvent({
      type: 'response.brand_new_event',
      payload: { ok: true },
    });
    expect(parsed.type).toBe('response.brand_new_event');
    expect((parsed as { payload?: unknown }).payload).toEqual({ ok: true });
  });

  test('returns unknown for non-object payloads', () => {
    const parsed = parseServerEvent('garbage');
    expect(parsed.type).toBe('unknown');
  });
});
