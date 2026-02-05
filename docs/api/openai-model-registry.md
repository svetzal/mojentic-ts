# API Reference - OpenAI Model Registry

The OpenAI Model Registry manages model-specific configurations, capabilities, and parameter requirements for OpenAI models. It provides a centralized way to determine what features each model supports and how to configure requests correctly.

## ModelType Enum

Classification of OpenAI models based on their capabilities and parameters.

```typescript
enum ModelType {
  REASONING = 'reasoning',
  CHAT = 'chat',
  EMBEDDING = 'embedding',
  MODERATION = 'moderation'
}
```

### Model Types

- **REASONING** - Models like o1, o3, gpt-5 that use `max_completion_tokens` instead of `max_tokens`. These models are designed for complex reasoning tasks.
- **CHAT** - Standard chat models (GPT-4, GPT-4o, GPT-3.5-turbo) that use `max_tokens` parameter. The majority of conversational models fall into this category.
- **EMBEDDING** - Text embedding models (text-embedding-3-large, text-embedding-ada-002) for converting text to vectors.
- **MODERATION** - Content moderation models for filtering harmful content.

## ModelCapabilities Interface

Defines the capabilities and parameter requirements for a model.

```typescript
interface ModelCapabilities {
  modelType: ModelType;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxContextTokens?: number;
  maxOutputTokens?: number;
  supportedTemperatures?: number[] | null;
  supportsChatApi: boolean;
  supportsCompletionsApi: boolean;
  supportsResponsesApi: boolean;
}
```

### Fields

- **modelType** - The classification of the model (reasoning, chat, embedding, moderation)
- **supportsTools** - Whether the model supports function/tool calling
- **supportsStreaming** - Whether the model supports streaming responses
- **supportsVision** - Whether the model can process image inputs
- **maxContextTokens** - Maximum input context window size in tokens
- **maxOutputTokens** - Maximum output tokens the model can generate
- **supportedTemperatures** - Temperature restrictions:
  - `null` or `undefined` - All temperature values supported
  - `[]` - No temperature parameter allowed
  - `[1.0]` - Only temperature 1.0 allowed
- **supportsChatApi** - Supports `/v1/chat/completions` endpoint
- **supportsCompletionsApi** - Supports `/v1/completions` endpoint (legacy)
- **supportsResponsesApi** - Supports `/v1/responses` endpoint (newer models)

## API Endpoint Support

OpenAI models support different API endpoints. Understanding which endpoint(s) a model supports is important for correctly routing requests.

### Endpoint Categories

**Chat API** (`/v1/chat/completions`) - Most models, default endpoint
- GPT-4, GPT-4o, GPT-4.1 series
- o1, o3, o4-mini
- gpt-5 base models
- gpt-3.5-turbo (non-instruct)

**Completions API** (`/v1/completions`) - Legacy models
- babbage-002
- davinci-002
- gpt-3.5-turbo-instruct
- gpt-5.1-codex-mini

**Responses API** (`/v1/responses`) - Newer specialized models
- gpt-5-pro
- codex-mini-latest
- o1-pro
- o3-pro
- o3-deep-research, o4-mini-deep-research

**Multiple Endpoints** - Some models support more than one endpoint
- gpt-4o-mini (chat + completions)
- gpt-4.1-nano (chat + completions)
- gpt-5.1 (chat + completions)

### Current Gateway Implementation

The OpenAI gateway currently only calls the Chat API (`/v1/chat/completions`). The endpoint support flags are informational and help developers understand model capabilities. Future gateway versions may use these flags to route requests to appropriate endpoints.

## Helper Functions

### getTokenLimitParam

Returns the correct parameter name for token limits based on model type.

```typescript
function getTokenLimitParam(capabilities: ModelCapabilities): string
```

**Returns:**
- `'max_completion_tokens'` for reasoning models
- `'max_tokens'` for all other models

**Example:**
```typescript
const caps = registry.getModelCapabilities('o1');
const param = getTokenLimitParam(caps);
// param = 'max_completion_tokens'

const chatCaps = registry.getModelCapabilities('gpt-4o');
const chatParam = getTokenLimitParam(chatCaps);
// chatParam = 'max_tokens'
```

### supportsTemperature

Checks if a model supports a specific temperature value.

```typescript
function supportsTemperature(
  capabilities: ModelCapabilities,
  temperature: number
): boolean
```

**Parameters:**
- `capabilities` - Model capabilities object
- `temperature` - Temperature value to check

**Returns:**
- `true` if the temperature is supported
- `false` if the temperature is not allowed

**Example:**
```typescript
const caps = registry.getModelCapabilities('o3');

// o3 only supports temperature=1.0
supportsTemperature(caps, 1.0); // true
supportsTemperature(caps, 0.7); // false

const chatCaps = registry.getModelCapabilities('gpt-4o');

// gpt-4o supports all temperatures
supportsTemperature(chatCaps, 0.5); // true
supportsTemperature(chatCaps, 1.5); // true
```

## OpenAIModelRegistry Class

Main registry class for managing model configurations.

### getModelRegistry

Get the global registry instance.

```typescript
function getModelRegistry(): OpenAIModelRegistry
```

**Returns:**
- Singleton instance of the registry

**Example:**
```typescript
import { getModelRegistry } from 'mojentic';

const registry = getModelRegistry();
```

### getModelCapabilities

Get capabilities for a specific model.

```typescript
getModelCapabilities(modelName: string): ModelCapabilities
```

**Parameters:**
- `modelName` - OpenAI model identifier

**Returns:**
- Model capabilities object

**Behavior:**
1. Direct lookup for registered models
2. Pattern matching for unknown models (e.g., "o1" prefix)
3. Defaults to chat model capabilities if no match

**Example:**
```typescript
const registry = getModelRegistry();

// Registered model
const caps = registry.getModelCapabilities('gpt-4o');
console.log(caps.modelType);        // 'chat'
console.log(caps.supportsTools);    // true
console.log(caps.maxContextTokens); // 128000

// Check endpoint support
console.log(caps.supportsChatApi);        // true
console.log(caps.supportsCompletionsApi); // false
console.log(caps.supportsResponsesApi);   // false

// Dual-endpoint model
const miniCaps = registry.getModelCapabilities('gpt-4o-mini');
console.log(miniCaps.supportsChatApi);        // true
console.log(miniCaps.supportsCompletionsApi); // true

// Responses-only model
const proCaps = registry.getModelCapabilities('gpt-5-pro');
console.log(proCaps.supportsChatApi);        // false
console.log(proCaps.supportsResponsesApi);   // true

// Unknown model - pattern matching
const unknownCaps = registry.getModelCapabilities('o1-preview-123');
// Matches 'o1' pattern -> reasoning model
console.log(unknownCaps.modelType); // 'reasoning'
```

### isReasoningModel

Check if a model is a reasoning model.

```typescript
isReasoningModel(modelName: string): boolean
```

**Parameters:**
- `modelName` - OpenAI model identifier

**Returns:**
- `true` if the model is a reasoning model
- `false` otherwise

**Example:**
```typescript
const registry = getModelRegistry();

registry.isReasoningModel('o1');      // true
registry.isReasoningModel('gpt-5');   // true
registry.isReasoningModel('gpt-4o');  // false
```

### getRegisteredModels

Get list of all explicitly registered models.

```typescript
getRegisteredModels(): string[]
```

**Returns:**
- Array of registered model names

**Example:**
```typescript
const registry = getModelRegistry();
const models = registry.getRegisteredModels();

console.log(models);
// ['o1', 'o3', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo', ...]
```

### registerModel

Register a custom model with its capabilities.

```typescript
registerModel(modelName: string, capabilities: ModelCapabilities): void
```

**Parameters:**
- `modelName` - Model identifier
- `capabilities` - Model capabilities object

**Example:**
```typescript
import { getModelRegistry, ModelType } from 'mojentic';

const registry = getModelRegistry();

registry.registerModel('custom-llm-v1', {
  modelType: ModelType.CHAT,
  supportsTools: true,
  supportsStreaming: true,
  supportsVision: false,
  maxContextTokens: 8192,
  maxOutputTokens: 2048,
  supportsChatApi: true,
  supportsCompletionsApi: false,
  supportsResponsesApi: false,
});

// Now can use with gateway
const caps = registry.getModelCapabilities('custom-llm-v1');
console.log(caps.maxContextTokens); // 8192
```

### registerPattern

Register a pattern for inferring model types from unknown model names.

```typescript
registerPattern(pattern: string, modelType: ModelType): void
```

**Parameters:**
- `pattern` - String pattern to match in model names
- `modelType` - Model type to infer for matching models

**Example:**
```typescript
import { getModelRegistry, ModelType } from 'mojentic';

const registry = getModelRegistry();

// Register pattern for custom model family
registry.registerPattern('custom-reasoning', ModelType.REASONING);

// Now unknown models matching pattern will be inferred
const caps = registry.getModelCapabilities('custom-reasoning-v2');
console.log(caps.modelType); // 'reasoning'
```

## Model Categories

### Chat-Only Models

Models that only support the Chat API:
- GPT-4 series (gpt-4, gpt-4-turbo)
- GPT-4o series (gpt-4o, excluding gpt-4o-mini)
- GPT-4.1 series (gpt-4.1, gpt-4.1-mini, excluding gpt-4.1-nano)
- o1, o3, o4-mini
- gpt-5, gpt-5-mini, gpt-5-nano
- gpt-3.5-turbo (non-instruct variants)

### Completions-Only Models

Legacy models using the Completions API:
- babbage-002
- davinci-002
- gpt-3.5-turbo-instruct
- gpt-5.1-codex-mini

### Responses-Only Models

Specialized models using the Responses API:
- gpt-5-pro
- codex-mini-latest
- o1-pro
- o3-pro
- o3-deep-research
- o4-mini-deep-research

### Dual-Endpoint Models

Models supporting multiple endpoints:
- gpt-4o-mini (chat + completions)
- gpt-4.1-nano (chat + completions)
- gpt-5.1 (chat + completions)

## Pattern Matching

The registry uses pattern matching to infer capabilities for unknown models. When a model is not explicitly registered, the registry checks if the model name contains any registered patterns.

### Default Patterns

- **o1** - Reasoning models
- **o3** - Reasoning models
- **o4** - Reasoning models
- **gpt-5.2** - Reasoning models
- **gpt-5.1** - Reasoning models
- **gpt-5** - Reasoning models
- **gpt-4.1** - Chat models
- **gpt-4** - Chat models
- **gpt-3.5** - Chat models
- **chatgpt** - Chat models
- **text-embedding** - Embedding models
- **text-moderation** - Moderation models

### Fallback Behavior

If no pattern matches, the model defaults to chat model capabilities with standard features enabled.

## Usage Examples

### Basic Capability Check

```typescript
import { getModelRegistry } from 'mojentic';

const registry = getModelRegistry();

// Check if model supports tools before attempting tool calls
const modelId = 'gpt-4o';
const caps = registry.getModelCapabilities(modelId);

if (caps.supportsTools) {
  // Safe to use tools with this model
  const result = await broker.generate(messages, modelId, {
    tools: [weatherTool]
  });
}
```

### Temperature Validation

```typescript
import { getModelRegistry, supportsTemperature } from 'mojentic';

const registry = getModelRegistry();
const modelId = 'o3';
const caps = registry.getModelCapabilities(modelId);

const requestedTemp = 0.7;

if (!supportsTemperature(caps, requestedTemp)) {
  console.warn(
    `Model ${modelId} does not support temperature ${requestedTemp}`
  );
  // Use default temperature or skip parameter
}
```

### Token Limit Configuration

```typescript
import { getModelRegistry, getTokenLimitParam } from 'mojentic';

const registry = getModelRegistry();
const modelId = 'o1';
const caps = registry.getModelCapabilities(modelId);

// Get correct parameter name
const tokenParam = getTokenLimitParam(caps);

// Build config with correct parameter
const config = {
  [tokenParam]: 1000, // 'max_completion_tokens' for o1
  temperature: 1.0
};
```

### Endpoint Support Check

```typescript
import { getModelRegistry } from 'mojentic';

const registry = getModelRegistry();

// Check endpoint support before routing
function canUseModel(modelId: string, endpoint: string): boolean {
  const caps = registry.getModelCapabilities(modelId);

  switch (endpoint) {
    case 'chat':
      return caps.supportsChatApi;
    case 'completions':
      return caps.supportsCompletionsApi;
    case 'responses':
      return caps.supportsResponsesApi;
    default:
      return false;
  }
}

console.log(canUseModel('gpt-4o', 'chat'));          // true
console.log(canUseModel('babbage-002', 'chat'));     // false
console.log(canUseModel('gpt-5-pro', 'responses'));  // true
console.log(canUseModel('gpt-5.1', 'completions'));  // true
```

### Custom Model Registration

```typescript
import { getModelRegistry, ModelType } from 'mojentic';

const registry = getModelRegistry();

// Register a custom fine-tuned model
registry.registerModel('ft:gpt-4o:company:model-id:suffix', {
  modelType: ModelType.CHAT,
  supportsTools: true,
  supportsStreaming: true,
  supportsVision: true,
  maxContextTokens: 128000,
  maxOutputTokens: 16384,
  supportsChatApi: true,
  supportsCompletionsApi: false,
  supportsResponsesApi: false,
});

// Use the custom model
const caps = registry.getModelCapabilities('ft:gpt-4o:company:model-id:suffix');
console.log(caps.supportsTools); // true
```

### Pattern-Based Model Family

```typescript
import { getModelRegistry, ModelType } from 'mojentic';

const registry = getModelRegistry();

// Register pattern for entire model family
registry.registerPattern('mycompany-reasoning', ModelType.REASONING);

// All matching models will be inferred as reasoning models
const caps1 = registry.getModelCapabilities('mycompany-reasoning-v1');
const caps2 = registry.getModelCapabilities('mycompany-reasoning-large');

console.log(caps1.modelType); // 'reasoning'
console.log(caps2.modelType); // 'reasoning'
```

## See Also

- [OpenAI Gateway](/api/openai-gateway)
- [Broker API](/api/broker)
- [Core API](/api/core)
