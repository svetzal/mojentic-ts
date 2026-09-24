/**
 * Gateway interface and implementations for LLM providers
 */

import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk } from './models';
import { ToolDescriptor } from './tools';
import { Result } from '../error';
import { LlmStreamEvent } from './stream-events';

/**
 * Interface for LLM gateway implementations
 */
export interface LlmGateway {
  /**
   * Generate a completion from the LLM
   */
  generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>>;

  /**
   * Generate a streaming completion from the LLM
   */
  generateStream(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): AsyncGenerator<Result<StreamChunk, Error>>;

  /**
   * Stream one completion as content events ending in exactly one terminal event.
   *
   * Optional: gateways that do not implement it cause `LlmBroker.generateStreamEvents` to fail
   * with `stream_events_unsupported` before any request. Implementations send one HTTP request,
   * supply no tools, and cancel the request when the consumer stops iterating or `signal` aborts.
   */
  generateStreamEvents?(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    signal?: AbortSignal
  ): AsyncGenerator<LlmStreamEvent>;

  /**
   * List available models
   */
  listModels(): Promise<Result<string[], Error>>;

  /**
   * Calculate embeddings for the given text
   */
  calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>>;
}
