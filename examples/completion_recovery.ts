/** Supply harness-owned admission; this example never starts live inference on import. */
import {
  LlmBroker,
  LlmMessage,
  RecoveryAdmission,
  RecoveryError,
  RecoveryOptions,
  Result,
} from '../src';

/** Recover only a completion; the caller retains responsibility for remote ownership checks. */
export async function generateWithRecovery(
  broker: LlmBroker,
  messages: LlmMessage[],
  admit: (context: RecoveryAdmission) => Promise<'allow' | 'reject'>,
  signal?: AbortSignal
): Promise<Result<string, Error>> {
  const recovery = completionRecoveryPolicy(admit, signal);
  const result = await broker.generate(messages, undefined, { recovery });
  if (!result.ok && result.error instanceof RecoveryError) {
    console.error(result.error.outcome, result.error.failure.httpStatus);
  }
  return result;
}

/** The same bounded admission policy applies to ordinary and streaming completions. */
function completionRecoveryPolicy(
  admit: (context: RecoveryAdmission) => Promise<'allow' | 'reject'>,
  signal?: AbortSignal
): RecoveryOptions {
  return { maxAttempts: 3, baseDelayMs: 200, delayCeilingMs: 5000, budgetMs: 20000, signal, admit };
}

/** Preserve completed tool history; surface interruption rather than appending a new attempt. */
export async function* streamWithRecovery(
  broker: LlmBroker,
  messages: LlmMessage[],
  admit: (context: RecoveryAdmission) => Promise<'allow' | 'reject'>,
  signal?: AbortSignal
): AsyncGenerator<Result<string, Error>> {
  yield* broker.generateStream(messages, { recovery: completionRecoveryPolicy(admit, signal) });
}
