import { Err, Ok, Result, ValidationError } from '../error';
import { CompletionConfig, ReasoningEffort } from './models';

/** Caller-selected model capabilities, independent of provider wire adaptation. */
export interface ReasoningProfile {
  /** Human-readable identity used in validation errors. */
  readonly name: string;
  /** Exact controls accepted by this model. Omission never selects a default. */
  readonly supportedEfforts: readonly ReasoningEffort[];
  /** Capability metadata only; does not enable history serialization or retention. */
  readonly supportsReasoningHistory: boolean;
}

/** Qwen3.8 capabilities from the native reasoning contract; select explicitly. */
export const QWEN3_8_REASONING_PROFILE: ReasoningProfile = Object.freeze({
  name: 'qwen3.8',
  supportedEfforts: Object.freeze(['disabled', 'low', 'medium', 'xhigh'] as const),
  supportsReasoningHistory: true,
});

/** Validate an explicit effort. Unsupported controls return a ValidationError. */
export function validateReasoningProfile(
  profile: ReasoningProfile,
  effort?: ReasoningEffort
): Result<void, ValidationError> {
  if (effort !== undefined && !profile.supportedEfforts.includes(effort)) {
    return Err(
      new ValidationError(
        `Reasoning effort "${effort}" is unsupported by profile ${profile.name}; supported: ${profile.supportedEfforts.join(', ')}`,
        'reasoningEffort'
      )
    );
  }
  return Ok(undefined);
}

/** Shared pre-dispatch validation; no profile leaves existing behavior intact. */
export function reasoningProfileError(config?: CompletionConfig): ValidationError | undefined {
  if (!config?.reasoningProfile) return undefined;
  const result = validateReasoningProfile(config.reasoningProfile, config.reasoningEffort);
  return result.ok ? undefined : result.error;
}
