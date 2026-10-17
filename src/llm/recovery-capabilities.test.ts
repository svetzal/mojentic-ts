import { OpenAIGateway, OllamaGateway, OMLXGateway, completionRecoveryCapabilities } from './index';

const inspectedOn = '2026-10-17';

describe('recovery capability endpoint evidence', () => {
  describe.each([
    [
      'OpenAI',
      new OpenAIGateway('test'),
      '/v1/chat/completions',
      'https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create',
    ],
    ['Ollama', new OllamaGateway(), '/api/chat', 'https://docs.ollama.com/api/chat'],
    [
      'oMLX',
      new OMLXGateway(),
      '/v1/chat/completions',
      'https://github.com/jundot/omlx/blob/main/README.md#api-compatibility',
    ],
  ] as const)('%s', (_name, gateway, endpoint, documentation) => {
    it.each([
      [
        'clientAbort',
        'unknown',
        'Endpoint documentation does not describe a client abort facility; local HTTP abort alone is not provider evidence.',
      ],
      [
        'requestCancellation',
        'unsupported',
        'No remote cancellation facility documented for this endpoint.',
      ],
      [
        'requestStatus',
        'unsupported',
        'No in-flight request status facility documented for this endpoint.',
      ],
      ['idempotency', 'unsupported', 'No idempotency facility documented for this endpoint.'],
      [
        'exactAttemptTermination',
        'unknown',
        'No evidence that this exact attempt has terminated remotely.',
      ],
    ])('should expose %s as %s with endpoint evidence', (capability, status, basis) => {
      expect(gateway.recoveryCapabilities).toHaveProperty(capability, status);
      expect(gateway.recoveryCapabilities).toHaveProperty(`evidence.${capability}`, {
        endpoint,
        documentation,
        inspectedOn,
        basis,
      });
    });
  });
});

describe('legacy recovery capability export', () => {
  it('should retain the generic snapshot for existing imports', () => {
    expect(completionRecoveryCapabilities).toEqual({
      clientAbort: 'supported',
      requestCancellation: 'unsupported',
      requestStatus: 'unsupported',
      idempotency: 'unknown',
      remoteTerminationEvidence: 'none',
      streamingRecovery: 'supported',
    });
  });
});
