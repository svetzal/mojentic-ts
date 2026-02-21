// Use cjs/ sub-paths directly — the project uses moduleResolution:"node" which
// does not process package.json "exports" fields, so the advertised subpath
// aliases (e.g. 'gpt-tokenizer/encoding/p50k_base') are not visible to tsc.
// The cjs/ directory is physically present under node_modules and is resolved
// by the classic Node resolver without any exports-field support.
import {
  encode as encodeCl100k,
  decode as decodeCl100k,
} from 'gpt-tokenizer/cjs/encoding/cl100k_base';
import { encode as encodeP50k, decode as decodeP50k } from 'gpt-tokenizer/cjs/encoding/p50k_base';
import { encode as encodeR50k, decode as decodeR50k } from 'gpt-tokenizer/cjs/encoding/r50k_base';
import {
  encode as encodeO200k,
  decode as decodeO200k,
} from 'gpt-tokenizer/cjs/encoding/o200k_base';

import { Tokenizer } from './tokenizer';

type SupportedEncoding = 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'o200k_base';

/**
 * Gateway for tokenizing and detokenizing text using gpt-tokenizer.
 *
 * A pure-TypeScript BPE tokenizer with no WebAssembly dependency — safe to
 * use in any JavaScript runtime, including Cloudflare Workers, Next.js Edge,
 * and Deno.
 *
 * Implements the {@link Tokenizer} interface so it can be injected wherever
 * a tokenizer is needed (e.g. {@link ChatSession}).
 *
 * @example
 * ```typescript
 * const tokenizer = new TokenizerGateway();
 * const tokens = tokenizer.encode("Hello, world!");
 * const text = tokenizer.decode(tokens);
 * tokenizer.free(); // no-op for pure-JS tokenizers, safe to call
 * ```
 */
export class TokenizerGateway implements Tokenizer {
  private readonly encodeText: (text: string) => number[];
  private readonly decodeTokens: (tokens: Iterable<number>) => string;

  /**
   * Creates a new TokenizerGateway instance.
   *
   * @param encoding - The BPE encoding to use. Defaults to `"cl100k_base"`
   *   (used by GPT-4 and GPT-3.5-turbo). Other supported values:
   *   `"p50k_base"` (GPT-3), `"r50k_base"` (older models),
   *   `"o200k_base"` (GPT-4o).
   */
  constructor(encoding: string = 'cl100k_base') {
    const { encodeText, decodeTokens } = TokenizerGateway.selectEncoding(
      encoding as SupportedEncoding
    );
    this.encodeText = encodeText;
    this.decodeTokens = decodeTokens;
  }

  private static selectEncoding(encoding: SupportedEncoding): {
    encodeText: (text: string) => number[];
    decodeTokens: (tokens: Iterable<number>) => string;
  } {
    switch (encoding) {
      case 'p50k_base':
        return { encodeText: encodeP50k, decodeTokens: decodeP50k };
      case 'r50k_base':
        return { encodeText: encodeR50k, decodeTokens: decodeR50k };
      case 'o200k_base':
        return { encodeText: encodeO200k, decodeTokens: decodeO200k };
      default:
        return { encodeText: encodeCl100k, decodeTokens: decodeCl100k };
    }
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
    return this.encodeText(text);
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
    return this.decodeTokens(tokens);
  }

  /**
   * No-op for pure-JavaScript tokenizers — there is no WebAssembly memory
   * to release. Exists so that code written against the {@link Tokenizer}
   * interface continues to work without modification.
   */
  free(): void {
    // pure-JS tokenizer — nothing to release
  }
}
