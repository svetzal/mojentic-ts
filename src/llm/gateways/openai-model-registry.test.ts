/**
 * Tests for OpenAI Model Registry
 */

import {
  OpenAIModelRegistry,
  ModelType,
  getTokenLimitParam,
  supportsTemperature,
  getModelRegistry,
  resetModelRegistry,
} from './openai-model-registry';

describe('OpenAIModelRegistry', () => {
  let registry: OpenAIModelRegistry;

  beforeEach(() => {
    resetModelRegistry();
    registry = new OpenAIModelRegistry();
  });

  describe('getModelCapabilities', () => {
    it('should return capabilities for known GPT-4 model', () => {
      const capabilities = registry.getModelCapabilities('gpt-4');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsStreaming).toBe(true);
    });

    it('should return capabilities for known GPT-4o model', () => {
      const capabilities = registry.getModelCapabilities('gpt-4o');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsVision).toBe(true);
    });

    it('should return capabilities for reasoning model o1', () => {
      const capabilities = registry.getModelCapabilities('o1');

      expect(capabilities.modelType).toBe(ModelType.REASONING);
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsStreaming).toBe(false);
    });

    it('should return capabilities for GPT-3.5 turbo', () => {
      const capabilities = registry.getModelCapabilities('gpt-3.5-turbo');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.maxOutputTokens).toBe(4096);
    });

    it('should return capabilities for GPT-3.5 instruct (no tools)', () => {
      const capabilities = registry.getModelCapabilities('gpt-3.5-turbo-instruct');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsStreaming).toBe(false);
    });

    it('should return capabilities for embedding model', () => {
      const capabilities = registry.getModelCapabilities('text-embedding-3-large');

      expect(capabilities.modelType).toBe(ModelType.EMBEDDING);
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsStreaming).toBe(false);
    });

    it('should use pattern matching for unknown models', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const capabilities = registry.getModelCapabilities('gpt-4-custom-variant');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should default to CHAT for completely unknown models', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const capabilities = registry.getModelCapabilities('unknown-model-xyz');

      expect(capabilities.modelType).toBe(ModelType.CHAT);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('isReasoningModel', () => {
    it('should return true for o1 models', () => {
      expect(registry.isReasoningModel('o1')).toBe(true);
      expect(registry.isReasoningModel('o1-mini')).toBe(true);
    });

    it('should return true for o3 models', () => {
      expect(registry.isReasoningModel('o3')).toBe(true);
      expect(registry.isReasoningModel('o3-mini')).toBe(true);
    });

    it('should return false for chat models', () => {
      expect(registry.isReasoningModel('gpt-4')).toBe(false);
      expect(registry.isReasoningModel('gpt-4o')).toBe(false);
      expect(registry.isReasoningModel('gpt-3.5-turbo')).toBe(false);
    });
  });

  describe('registerModel', () => {
    it('should allow registering new models', () => {
      registry.registerModel('custom-model', {
        modelType: ModelType.CHAT,
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        maxContextTokens: 8192,
        maxOutputTokens: 4096,
      });

      const capabilities = registry.getModelCapabilities('custom-model');
      expect(capabilities.maxContextTokens).toBe(8192);
    });
  });

  describe('registerPattern', () => {
    it('should allow registering new patterns', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      registry.registerPattern('custom-prefix', ModelType.REASONING);

      const capabilities = registry.getModelCapabilities('custom-prefix-model');
      expect(capabilities.modelType).toBe(ModelType.REASONING);

      consoleSpy.mockRestore();
    });
  });

  describe('getRegisteredModels', () => {
    it('should return all registered model names', () => {
      const models = registry.getRegisteredModels();

      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('o1');
      expect(models.length).toBeGreaterThan(30);
    });
  });
});

describe('getTokenLimitParam', () => {
  it('should return max_completion_tokens for reasoning models', () => {
    const capabilities = {
      modelType: ModelType.REASONING,
      supportsTools: false,
      supportsStreaming: false,
      supportsVision: false,
    };

    expect(getTokenLimitParam(capabilities)).toBe('max_completion_tokens');
  });

  it('should return max_tokens for chat models', () => {
    const capabilities = {
      modelType: ModelType.CHAT,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false,
    };

    expect(getTokenLimitParam(capabilities)).toBe('max_tokens');
  });
});

describe('supportsTemperature', () => {
  it('should return true when supportedTemperatures is null', () => {
    const capabilities = {
      modelType: ModelType.CHAT,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false,
      supportedTemperatures: null,
    };

    expect(supportsTemperature(capabilities, 0.5)).toBe(true);
    expect(supportsTemperature(capabilities, 1.0)).toBe(true);
  });

  it('should return false when supportedTemperatures is empty array', () => {
    const capabilities = {
      modelType: ModelType.REASONING,
      supportsTools: false,
      supportsStreaming: false,
      supportsVision: false,
      supportedTemperatures: [],
    };

    expect(supportsTemperature(capabilities, 0.5)).toBe(false);
    expect(supportsTemperature(capabilities, 1.0)).toBe(false);
  });

  it('should return true only for specified temperatures', () => {
    const capabilities = {
      modelType: ModelType.REASONING,
      supportsTools: false,
      supportsStreaming: false,
      supportsVision: false,
      supportedTemperatures: [1.0],
    };

    expect(supportsTemperature(capabilities, 1.0)).toBe(true);
    expect(supportsTemperature(capabilities, 0.5)).toBe(false);
  });
});

describe('getModelRegistry', () => {
  beforeEach(() => {
    resetModelRegistry();
  });

  it('should return singleton instance', () => {
    const registry1 = getModelRegistry();
    const registry2 = getModelRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should reset with resetModelRegistry', () => {
    const registry1 = getModelRegistry();
    resetModelRegistry();
    const registry2 = getModelRegistry();

    expect(registry1).not.toBe(registry2);
  });
});
