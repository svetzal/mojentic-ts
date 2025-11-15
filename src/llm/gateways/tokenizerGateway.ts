import { Tiktoken, get_encoding } from 'tiktoken';

/**
 * Gateway for tokenizing and detokenizing text using tiktoken.
 *
 * This gateway provides encoding and decoding functionality for text,
 * which is useful for:
 * - Counting tokens to manage context windows
 * - Understanding token usage for cost estimation
 * - Debugging token-related issues
 *
 * @example
 * ```typescript
 * const tokenizer = new TokenizerGateway();
 * const tokens = tokenizer.encode("Hello, world!");
 * const text = tokenizer.decode(tokens);
 * ```
 */
export class TokenizerGateway {
  private tokenizer: Tiktoken;

  /**
   * Creates a new TokenizerGateway instance.
   *
   * @param model - The encoding model to use. Defaults to "cl100k_base" which is used by GPT-4 and GPT-3.5-turbo.
   *                Other options include "p50k_base" (GPT-3), "r50k_base" (older models), etc.
   */
  constructor(model: string = 'cl100k_base') {
    this.tokenizer = get_encoding(model as 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'gpt2');
  }

  /**
   * Encodes text into tokens.
   *
   * @param text - The text to encode
   * @returns An array of token IDs
   *
   * @example
   * ```typescript
   * const tokenizer = new TokenizerGateway();
   * const tokens = tokenizer.encode("Hello, world!");
   * console.log(`Token count: ${tokens.length}`);
   * ```
   */
  encode(text: string): number[] {
    return Array.from(this.tokenizer.encode(text));
  }

  /**
   * Decodes tokens back into text.
   *
   * @param tokens - The array of token IDs to decode
   * @returns The decoded text
   *
   * @example
   * ```typescript
   * const tokenizer = new TokenizerGateway();
   * const tokens = [9906, 11, 1917, 0];
   * const text = tokenizer.decode(tokens);
   * console.log(text); // "Hello, world!"
   * ```
   */
  decode(tokens: number[]): string {
    const decoder = new TextDecoder();
    return decoder.decode(this.tokenizer.decode(new Uint32Array(tokens)));
  }

  /**
   * Frees the tokenizer resources.
   * Call this when you're done using the tokenizer to prevent memory leaks.
   */
  free(): void {
    this.tokenizer.free();
  }
}
