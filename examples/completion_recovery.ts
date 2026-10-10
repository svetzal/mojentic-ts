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
  const recovery: RecoveryOptions = {
    maxAttempts: 3,
    baseDelayMs: 200,
    delayCeilingMs: 5000,
    budgetMs: 20000,
    signal,
    admit,
  };
  const result = await broker.generate(messages, undefined, { recovery });
  if (!result.ok && result.error instanceof RecoveryError) {
    console.error(result.error.outcome, result.error.failure.httpStatus);
  }
  return result;
}
