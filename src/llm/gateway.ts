/**
 * Gateway interface and implementations for LLM providers
 */

import { LlmMessage, CompletionConfig, GatewayResponse, StreamChunk } from './models';
import { ToolDescriptor } from './tools';
import { Result } from '../error';

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
   * List available models
   */
  listModels(): Promise<Result<string[], Error>>;

  /**
   * Calculate embeddings for the given text
   */
  calculateEmbeddings(text: string, model?: string): Promise<Result<number[], Error>>;
}
