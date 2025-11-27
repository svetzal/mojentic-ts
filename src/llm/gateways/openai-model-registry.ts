/**
 * OpenAI Model Registry for managing model-specific configurations and capabilities.
 *
 * This module provides infrastructure for categorizing OpenAI models and managing
 * their specific parameter requirements and capabilities.
 */

/**
 * Classification of OpenAI model types based on their capabilities and parameters.
 */
export enum ModelType {
  /** Models like o1, o3 that use max_completion_tokens */
  REASONING = 'reasoning',
  /** Standard chat models that use max_tokens */
  CHAT = 'chat',
  /** Text embedding models */
  EMBEDDING = 'embedding',
  /** Content moderation models */
  MODERATION = 'moderation',
}

/**
 * Defines the capabilities and parameter requirements for a model.
 */
export interface ModelCapabilities {
  modelType: ModelType;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
  /** null means all temperatures supported, empty array means no temperature parameter allowed */
  supportedTemperatures?: number[] | null;
}

/**
 * Get the correct parameter name for token limits based on model type.
 */
export function getTokenLimitParam(capabilities: ModelCapabilities): string {
  if (capabilities.modelType === ModelType.REASONING) {
    return 'max_completion_tokens';
  }
  return 'max_tokens';
}

/**
 * Check if the model supports a specific temperature value.
 */
export function supportsTemperature(capabilities: ModelCapabilities, temperature: number): boolean {
  if (
    capabilities.supportedTemperatures === null ||
    capabilities.supportedTemperatures === undefined
  ) {
    return true; // All temperatures supported if not restricted
  }
  if (capabilities.supportedTemperatures.length === 0) {
    return false; // No temperature values supported (parameter not allowed)
  }
  return capabilities.supportedTemperatures.includes(temperature);
}

/**
 * Registry for managing OpenAI model configurations and capabilities.
 *
 * This class provides a centralized way to manage model-specific configurations,
 * parameter mappings, and capabilities for OpenAI models.
 */
export class OpenAIModelRegistry {
  private models: Map<string, ModelCapabilities> = new Map();
  private patternMappings: Map<string, ModelType> = new Map();

  constructor() {
    this.initializeDefaultModels();
  }

  private initializeDefaultModels(): void {
    // Reasoning Models (o1, o3, o4, gpt-5 series)
    const reasoningModels = [
      'o1',
      'o1-2024-12-17',
      'o1-mini',
      'o1-mini-2024-09-12',
      'o1-pro',
      'o1-pro-2025-03-19',
      'o3',
      'o3-2025-04-16',
      'o3-deep-research',
      'o3-deep-research-2025-06-26',
      'o3-mini',
      'o3-mini-2025-01-31',
      'o3-pro',
      'o3-pro-2025-06-10',
      'o4-mini',
      'o4-mini-2025-04-16',
      'o4-mini-deep-research',
      'o4-mini-deep-research-2025-06-26',
      'gpt-5',
      'gpt-5-2025-08-07',
      'gpt-5-chat-latest',
      'gpt-5-codex',
      'gpt-5-mini',
      'gpt-5-mini-2025-08-07',
      'gpt-5-nano',
      'gpt-5-nano-2025-08-07',
    ];

    for (const model of reasoningModels) {
      const isDeepResearch = model.includes('deep-research');
      const isGpt5 = model.includes('gpt-5');
      const isO1Series = model.startsWith('o1');
      const isO3Series = model.startsWith('o3');
      const isO4Series = model.startsWith('o4');
      const isMiniOrNano = model.includes('mini') || model.includes('nano');

      // GPT-5 models may support more features than o1/o3/o4
      const supportsTools = isGpt5;
      const supportsStreaming = isGpt5;

      // Set context and output tokens based on model tier
      let contextTokens: number;
      let outputTokens: number;

      if (isGpt5) {
        contextTokens = isMiniOrNano ? 200000 : 300000;
        outputTokens = isMiniOrNano ? 32768 : 50000;
      } else if (isDeepResearch) {
        contextTokens = 200000;
        outputTokens = 100000;
      } else {
        contextTokens = 128000;
        outputTokens = 32768;
      }

      // Temperature restrictions based on model series
      let supportedTemps: number[] | null;
      if (isGpt5 || isO1Series || isO4Series) {
        supportedTemps = [1.0];
      } else if (isO3Series) {
        supportedTemps = []; // o3 series doesn't support temperature
      } else {
        supportedTemps = null;
      }

      this.models.set(model, {
        modelType: ModelType.REASONING,
        supportsTools,
        supportsStreaming,
        supportsVision: false,
        maxContextTokens: contextTokens,
        maxOutputTokens: outputTokens,
        supportedTemperatures: supportedTemps,
      });
    }

    // Chat Models (GPT-4 and GPT-4.1 series)
    const gpt4AndNewerModels = [
      'chatgpt-4o-latest',
      'gpt-4',
      'gpt-4-0125-preview',
      'gpt-4-0613',
      'gpt-4-1106-preview',
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-4-turbo-preview',
      'gpt-4.1',
      'gpt-4.1-2025-04-14',
      'gpt-4.1-mini',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4.1-nano',
      'gpt-4.1-nano-2025-04-14',
      'gpt-4o',
      'gpt-4o-2024-05-13',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20',
      'gpt-4o-audio-preview',
      'gpt-4o-audio-preview-2024-10-01',
      'gpt-4o-audio-preview-2024-12-17',
      'gpt-4o-audio-preview-2025-06-03',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'gpt-4o-mini-audio-preview',
      'gpt-4o-mini-audio-preview-2024-12-17',
      'gpt-4o-mini-realtime-preview',
      'gpt-4o-mini-realtime-preview-2024-12-17',
      'gpt-4o-mini-search-preview',
      'gpt-4o-mini-search-preview-2025-03-11',
      'gpt-4o-mini-transcribe',
      'gpt-4o-mini-tts',
      'gpt-4o-realtime-preview',
      'gpt-4o-realtime-preview-2024-10-01',
      'gpt-4o-realtime-preview-2024-12-17',
      'gpt-4o-realtime-preview-2025-06-03',
      'gpt-4o-search-preview',
      'gpt-4o-search-preview-2025-03-11',
      'gpt-4o-transcribe',
    ];

    for (const model of gpt4AndNewerModels) {
      const visionSupport =
        model.includes('gpt-4o') || model.includes('audio-preview') || model.includes('realtime');
      const isMiniOrNano = model.includes('mini') || model.includes('nano');
      const isAudio =
        model.includes('audio') || model.includes('realtime') || model.includes('transcribe');
      const isGpt41 = model.includes('gpt-4.1');

      let contextTokens: number;
      let outputTokens: number;

      if (isGpt41) {
        contextTokens = isMiniOrNano ? 128000 : 200000;
        outputTokens = isMiniOrNano ? 16384 : 32768;
      } else if (model.includes('gpt-4o')) {
        contextTokens = 128000;
        outputTokens = 16384;
      } else {
        // GPT-4 series
        contextTokens = 32000;
        outputTokens = 8192;
      }

      this.models.set(model, {
        modelType: ModelType.CHAT,
        supportsTools: true,
        supportsStreaming: !isAudio,
        supportsVision: visionSupport,
        maxContextTokens: contextTokens,
        maxOutputTokens: outputTokens,
      });
    }

    // Chat Models (GPT-3.5 series)
    const gpt35Models = [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
      'gpt-3.5-turbo-16k',
      'gpt-3.5-turbo-instruct',
      'gpt-3.5-turbo-instruct-0914',
    ];

    for (const model of gpt35Models) {
      this.models.set(model, {
        modelType: ModelType.CHAT,
        supportsTools: !model.includes('instruct'),
        supportsStreaming: !model.includes('instruct'),
        supportsVision: false,
        maxContextTokens: 16385,
        maxOutputTokens: 4096,
      });
    }

    // Embedding Models
    const embeddingModels = [
      'text-embedding-3-large',
      'text-embedding-3-small',
      'text-embedding-ada-002',
    ];

    for (const model of embeddingModels) {
      this.models.set(model, {
        modelType: ModelType.EMBEDDING,
        supportsTools: false,
        supportsStreaming: false,
        supportsVision: false,
      });
    }

    // Pattern mappings for unknown models
    this.patternMappings.set('o1', ModelType.REASONING);
    this.patternMappings.set('o3', ModelType.REASONING);
    this.patternMappings.set('o4', ModelType.REASONING);
    this.patternMappings.set('gpt-5', ModelType.REASONING);
    this.patternMappings.set('gpt-4', ModelType.CHAT);
    this.patternMappings.set('gpt-4.1', ModelType.CHAT);
    this.patternMappings.set('gpt-3.5', ModelType.CHAT);
    this.patternMappings.set('chatgpt', ModelType.CHAT);
    this.patternMappings.set('text-embedding', ModelType.EMBEDDING);
    this.patternMappings.set('text-moderation', ModelType.MODERATION);
  }

  /**
   * Get the capabilities for a specific model.
   */
  getModelCapabilities(modelName: string): ModelCapabilities {
    // Direct lookup first
    const capabilities = this.models.get(modelName);
    if (capabilities) {
      return capabilities;
    }

    // Pattern matching for unknown models
    const modelLower = modelName.toLowerCase();
    for (const [pattern, modelType] of this.patternMappings) {
      if (modelLower.includes(pattern)) {
        console.warn(
          `Using pattern matching for unknown model: ${modelName} (pattern: ${pattern}, inferred: ${modelType})`
        );
        return this.getDefaultCapabilitiesForType(modelType);
      }
    }

    // Default to chat model if no pattern matches
    console.warn(`Unknown model, defaulting to chat model capabilities: ${modelName}`);
    return this.getDefaultCapabilitiesForType(ModelType.CHAT);
  }

  private getDefaultCapabilitiesForType(modelType: ModelType): ModelCapabilities {
    switch (modelType) {
      case ModelType.REASONING:
        return {
          modelType: ModelType.REASONING,
          supportsTools: false,
          supportsStreaming: false,
          supportsVision: false,
        };
      case ModelType.CHAT:
        return {
          modelType: ModelType.CHAT,
          supportsTools: true,
          supportsStreaming: true,
          supportsVision: false,
        };
      case ModelType.EMBEDDING:
        return {
          modelType: ModelType.EMBEDDING,
          supportsTools: false,
          supportsStreaming: false,
          supportsVision: false,
        };
      case ModelType.MODERATION:
      default:
        return {
          modelType: ModelType.MODERATION,
          supportsTools: false,
          supportsStreaming: false,
          supportsVision: false,
        };
    }
  }

  /**
   * Check if a model is a reasoning model.
   */
  isReasoningModel(modelName: string): boolean {
    const capabilities = this.getModelCapabilities(modelName);
    return capabilities.modelType === ModelType.REASONING;
  }

  /**
   * Get a list of all explicitly registered models.
   */
  getRegisteredModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Register a new model with its capabilities.
   */
  registerModel(modelName: string, capabilities: ModelCapabilities): void {
    this.models.set(modelName, capabilities);
  }

  /**
   * Register a pattern for inferring model types.
   */
  registerPattern(pattern: string, modelType: ModelType): void {
    this.patternMappings.set(pattern, modelType);
  }
}

// Global registry instance
let registryInstance: OpenAIModelRegistry | null = null;

/**
 * Get the global OpenAI model registry instance.
 */
export function getModelRegistry(): OpenAIModelRegistry {
  if (!registryInstance) {
    registryInstance = new OpenAIModelRegistry();
  }
  return registryInstance;
}

/**
 * Reset the global model registry (for testing).
 */
export function resetModelRegistry(): void {
  registryInstance = null;
}
