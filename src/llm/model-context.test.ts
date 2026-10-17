import { effectiveContextWindow, getModelContextWindow, ModelContextWindow } from './model-context';
import { LlmGateway } from './gateway';
import { Err, GatewayError, Ok } from '../error';
import { OpenAIGateway } from './gateways/openai';
import { getModelRegistry, ModelType } from './gateways/openai-model-registry';

const window: ModelContextWindow = Object.freeze({
  maxContextTokens: 100,
  field: 'model_info.arch.context_length',
  modelNumCtx: 40,
});

describe('effectiveContextWindow', () => {
  it.each([
    [20, 20],
    [100, 100],
    [200, 100],
  ])('caps explicit numCtx %i at the advertised maximum', (numCtx, expected) => {
    expect(effectiveContextWindow(window, Object.freeze({ numCtx }))).toBe(expected);
  });

  it.each([
    [20, 20],
    [100, 100],
    [200, 100],
  ])('caps model parameter %i at the advertised maximum', (modelNumCtx, expected) => {
    expect(effectiveContextWindow({ ...window, modelNumCtx })).toBe(expected);
  });

  it('uses the model parameter when configuration omits numCtx', () => {
    expect(effectiveContextWindow(window, {})).toBe(40);
  });

  it('returns the advertised upper bound when no context setting is visible', () => {
    expect(
      effectiveContextWindow({ maxContextTokens: 100, field: 'model_info.arch.context_length' })
    ).toBe(100);
  });

  it.each([undefined, {}, { numCtx: 20 }])(
    'does not guess an unknown window with config %j',
    (config) => {
      expect(effectiveContextWindow(null, config)).toBeNull();
    }
  );
});

describe('optional custom gateway context metadata', () => {
  const legacyGateway: LlmGateway = {
    generate: async () => Ok({ content: '' }),
    async *generateStream() {
      yield Ok({ content: '', done: true });
    },
    listModels: async () => Ok([]),
    calculateEmbeddings: async () => Ok([]),
  };

  it('keeps existing custom gateway implementations source compatible', async () => {
    expect(await getModelContextWindow(legacyGateway, 'unknown')).toEqual(Ok(null));
  });

  it('preserves implemented metadata and method binding', async () => {
    const gateway = {
      ...legacyGateway,
      window,
      async getModelContextWindow() {
        return Ok(this.window);
      },
    };

    expect(await getModelContextWindow(gateway, 'known')).toEqual(Ok(window));
  });

  it('preserves the implemented Result error', async () => {
    const error = new GatewayError('unavailable');
    const gateway = { ...legacyGateway, getModelContextWindow: async () => Err(error) };

    expect(await getModelContextWindow(gateway, 'known')).toEqual(Err(error));
  });
});

describe('OpenAI context registry without network access', () => {
  // An unreachable configured endpoint makes an accidental HTTP lookup fail the value assertions.
  const gateway = new OpenAIGateway('unused', 'http://127.0.0.1:1/v1');

  it.each([
    ['gpt-4o', 128000],
    ['gpt-5.4', 1050000],
    ['gpt-5.5', 1050000],
  ] as const)('reads exact registered context for %s offline', async (model, expected) => {
    expect(expected).toBeGreaterThan(0);
    expect(await gateway.getModelContextWindow(model)).toEqual(
      Ok({ maxContextTokens: expected, field: 'registry' })
    );
  });

  it.each(['gpt-5-future-unknown', 'o3-unknown', 'not-a-model', 'GPT-4O'])(
    'does not infer a window for unknown model %s',
    async (model) => {
      expect(await gateway.getModelContextWindow(model)).toEqual(Ok(null));
    }
  );

  it('returns not advertised for an explicitly registered model without a window', async () => {
    getModelRegistry().registerModel('context-test-no-window', {
      modelType: ModelType.CHAT,
      supportsTools: false,
      supportsStreaming: false,
      supportsVision: false,
      supportsChatApi: true,
      supportsCompletionsApi: false,
      supportsResponsesApi: false,
    });

    expect(await gateway.getModelContextWindow('context-test-no-window')).toEqual(Ok(null));
  });
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid registered window %s',
    async (maxContextTokens) => {
      getModelRegistry().registerModel('context-test-invalid', {
        modelType: ModelType.CHAT,
        supportsTools: false,
        supportsStreaming: false,
        supportsVision: false,
        supportsChatApi: true,
        supportsCompletionsApi: false,
        supportsResponsesApi: false,
        maxContextTokens,
      });

      expect(await gateway.getModelContextWindow('context-test-invalid')).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
      });
    }
  );
});
