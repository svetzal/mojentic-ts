import { QWEN3_8_REASONING_PROFILE, validateReasoningProfile } from '../index';
import contract from './gateways/__fixtures__/reasoning-profiles-v1.json';

it('advertises Qwen3.8 native history capability without selecting a default effort', () => {
  expect(QWEN3_8_REASONING_PROFILE).toEqual(contract.selections[1]?.profile);
  expect(validateReasoningProfile(QWEN3_8_REASONING_PROFILE)).toEqual({
    ok: true,
    value: undefined,
  });
});

it.each(['disabled', 'low', 'medium', 'xhigh'] as const)('accepts Qwen3.8 %s exactly', (effort) => {
  expect(validateReasoningProfile(QWEN3_8_REASONING_PROFILE, effort)).toEqual({
    ok: true,
    value: undefined,
  });
});

it.each(['enabled', 'high'] as const)('rejects unsupported Qwen3.8 %s', (effort) => {
  expect(validateReasoningProfile(QWEN3_8_REASONING_PROFILE, effort)).toEqual({
    ok: false,
    error: expect.objectContaining({ name: 'ValidationError', field: 'reasoningEffort' }),
  });
});

it('validates caller-defined boolean-only capabilities', () => {
  const profile = {
    name: 'boolean-only',
    supportedEfforts: ['enabled', 'disabled'] as const,
    supportsReasoningHistory: false,
  };

  expect(validateReasoningProfile(profile, 'low')).toEqual({
    ok: false,
    error: expect.objectContaining({ name: 'ValidationError', field: 'reasoningEffort' }),
  });
});
