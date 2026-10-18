/**
 * Core data models for LLM interactions
 */

/**
 * Role of a message in a conversation
 */
export enum MessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool',
}

/**
 * Content item in a message (text or image)
 */
export interface ContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

/**
 * Tool call request from the LLM
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Message in a conversation with an LLM
 */
export interface LlmMessage {
  role: MessageRole;
  content: string | ContentItem[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/**
 * Helper functions for creating messages
 */
export class Message {
  static system(content: string): LlmMessage {
    return {
      role: MessageRole.System,
      content,
    };
  }

  static user(content: string): LlmMessage {
    return {
      role: MessageRole.User,
      content,
    };
  }

  static assistant(content: string, toolCalls?: ToolCall[]): LlmMessage {
    return {
      role: MessageRole.Assistant,
      content,
      tool_calls: toolCalls,
    };
  }

  static tool(content: string, toolCallId: string, name: string): LlmMessage {
    return {
      role: MessageRole.Tool,
      content,
      tool_call_id: toolCallId,
      name,
    };
  }
}

/**
 * Native reasoning control. Boolean enablement and named levels are distinct;
 * omission leaves provider/model defaults unknown.
 */
export type ReasoningEffort = 'disabled' | 'enabled' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Configuration for LLM completion requests
 */
export interface CompletionConfig {
  /** Opt-in recovery for a single completion (including streaming). Omit for legacy behavior. */
  recovery?: import('./recovery').RecoveryOptions;
  /** Sampling temperature. Omit to use provider/model settings; explicit values may be adapted by the model registry. */
  temperature?: number;
  /** Output token limit. Omit to use provider/model limits; no library fallback is sent. */
  maxTokens?: number;
  topP?: number;
  topK?: number;
  /** Ollama context size. Omit to use model/server settings; other maintained gateways do not send it. */
  numCtx?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  responseFormat?: {
    type: 'json_object' | 'text';
    schema?: Record<string, unknown>;
  };
  /** Native reasoning control; supported values depend on the provider and model. */
  reasoningEffort?: ReasoningEffort;
  /** Maximum recursive tool iterations (default: 10); null allows unlimited execution. */
  maxToolIterations?: number | null;
}

/**
 * Why the provider stopped generating.
 *
 * The named values are the common OpenAI-compatible reasons. Providers may report others
 * (for example Ollama's `load`), which pass through unchanged.
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | (string & {});

/**
 * Token usage as reported by the provider. Never estimated.
 */
export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Response from an LLM gateway
 */
export interface GatewayResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: FinishReason;
  usage?: CompletionUsage;
  /** Model name the provider reported, which can differ from the requested model. */
  model?: string;
  thinking?: string;
  /** Other provider-reported response fields, such as response ids or timings. */
  metadata?: Record<string, unknown>;
}

/**
 * Stream chunk from an LLM gateway
 */
export interface StreamChunk {
  /** Opt-in recovery exposes observed reasoning and partial calls without executing them. */
  reasoning?: string;
  toolCallFragments?: readonly unknown[];
  frameIndex?: number;
  /** Terminal evidence includes monotonic client timing alongside provider metrics. */
  evidence?: import('./stream-events').CompletionEvidence;
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: FinishReason;
  done: boolean;
}
