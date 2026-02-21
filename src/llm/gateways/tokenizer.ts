/**
 * Tokenizer interface for encoding and decoding text to/from token IDs.
 *
 * Implementations wrap encoding libraries (e.g. gpt-tokenizer) so that
 * ChatSession depends on this interface rather than a concrete class,
 * enabling custom tokenizer injection and simpler testing.
 */
export interface Tokenizer {
  /**
   * Encodes text into an array of token IDs.
   *
   * @param text - The text to encode
   * @returns An array of token IDs
   */
  encode(text: string): number[];

  /**
   * Decodes an array of token IDs back into text.
   *
   * @param tokens - The array of token IDs to decode
   * @returns The decoded text
   */
  decode(tokens: number[]): string;

  /**
   * Releases any resources held by the tokenizer.
   * Implementations backed by pure JS may treat this as a no-op.
   */
  free(): void;
}
