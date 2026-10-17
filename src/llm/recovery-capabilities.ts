/** Documentation-backed facilities for recovery on one completion endpoint. */
export type RecoveryCapabilityStatus = 'supported' | 'unsupported' | 'unknown';

/** The five facilities required by the October 12 recovery amendment. */
export type RecoveryCapability =
  | 'clientAbort'
  | 'requestCancellation'
  | 'requestStatus'
  | 'idempotency'
  | 'exactAttemptTermination';

/** Inspection evidence, not confirmation that a remote attempt stopped. */
export interface RecoveryCapabilityEvidence {
  readonly endpoint: string;
  readonly documentation: string;
  readonly inspectedOn: string;
  readonly basis: string;
}

/** Capability values and endpoint-specific evidence exposed by a recovery adapter. */
export interface CompletionRecoveryCapabilities {
  readonly clientAbort: RecoveryCapabilityStatus;
  readonly requestCancellation: RecoveryCapabilityStatus;
  readonly requestStatus: RecoveryCapabilityStatus;
  readonly idempotency: RecoveryCapabilityStatus;
  readonly exactAttemptTermination: RecoveryCapabilityStatus;
  readonly evidence: Readonly<Record<RecoveryCapability, RecoveryCapabilityEvidence>>;
  /** Legacy informational field; never proof of exact-attempt termination. */
  readonly remoteTerminationEvidence: 'none';
  readonly streamingRecovery: RecoveryCapabilityStatus;
}

function capabilities(endpoint: string, documentation: string): CompletionRecoveryCapabilities {
  const evidence = (basis: string): RecoveryCapabilityEvidence =>
    Object.freeze({ endpoint, documentation, inspectedOn: '2026-10-17', basis });
  return Object.freeze({
    clientAbort: 'supported',
    requestCancellation: 'unsupported',
    requestStatus: 'unsupported',
    idempotency: 'unsupported',
    exactAttemptTermination: 'unknown',
    remoteTerminationEvidence: 'none',
    streamingRecovery: 'supported',
    evidence: Object.freeze({
      clientAbort: evidence(
        'Local HTTP abort only: https://nodejs.org/api/http.html#requestdestroyerror; no remote termination guarantee.'
      ),
      requestCancellation: evidence(
        'No remote cancellation facility documented for this endpoint.'
      ),
      requestStatus: evidence('No in-flight request status facility documented for this endpoint.'),
      idempotency: evidence('No idempotency facility documented for this endpoint.'),
      exactAttemptTermination: evidence(
        'No evidence that this exact attempt has terminated remotely.'
      ),
    }),
  });
}

/** Maintained completion endpoints; custom hosts can have different facilities. */
export const providerRecoveryCapabilities = Object.freeze({
  openai: capabilities(
    '/v1/chat/completions',
    'https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create'
  ),
  ollama: capabilities('/api/chat', 'https://docs.ollama.com/api/chat'),
  omlx: capabilities(
    '/v1/chat/completions',
    'https://github.com/jundot/omlx/blob/main/README.md#api-compatibility'
  ),
});
