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
 * Reasoning effort level for extended thinking
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Configuration for LLM completion requests
 */
export interface CompletionConfig {
  temperature?: number;
  maxTokens?: number;
  numPredict?: number;
  topP?: number;
  topK?: number;
  numCtx?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  responseFormat?: {
    type: 'json_object' | 'text';
    schema?: Record<string, unknown>;
  };
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
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: FinishReason;
  done: boolean;
}
