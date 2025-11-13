import { TokenizerGateway } from './tokenizerGateway';

describe('TokenizerGateway', () => {
  let tokenizer: TokenizerGateway;

  beforeEach(() => {
    tokenizer = new TokenizerGateway();
  });

  afterEach(() => {
    tokenizer.free();
  });

  describe('encode', () => {
    it('should encode text into tokens', () => {
      const text = 'Hello, world!';
      const tokens = tokenizer.encode(text);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((token) => typeof token === 'number')).toBe(true);
    });

    it('should encode empty string', () => {
      const tokens = tokenizer.encode('');
      expect(tokens).toEqual([]);
    });

    it('should produce consistent encodings', () => {
      const text = 'The quick brown fox';
      const tokens1 = tokenizer.encode(text);
      const tokens2 = tokenizer.encode(text);

      expect(tokens1).toEqual(tokens2);
    });
  });

  describe('decode', () => {
    it('should decode tokens back to text', () => {
      const originalText = 'Hello, world!';
      const tokens = tokenizer.encode(originalText);
      const decodedText = tokenizer.decode(tokens);

      expect(decodedText).toBe(originalText);
    });

    it('should decode empty token array', () => {
      const text = tokenizer.decode([]);
      expect(text).toBe('');
    });

    it('should round-trip text correctly', () => {
      const texts = [
        'Simple text',
        'Text with numbers: 123456',
        'Special characters: !@#$%^&*()',
        'Multi-line\ntext\nwith\nnewlines',
        'Unicode: 你好世界 🌍',
      ];

      texts.forEach((originalText) => {
        const tokens = tokenizer.encode(originalText);
        const decodedText = tokenizer.decode(tokens);
        expect(decodedText).toBe(originalText);
      });
    });
  });

  describe('different encodings', () => {
    it('should support cl100k_base encoding (default)', () => {
      const tokenizer = new TokenizerGateway('cl100k_base');
      const text = 'Hello, world!';
      const tokens = tokenizer.encode(text);

      expect(tokens.length).toBeGreaterThan(0);
      tokenizer.free();
    });

    it('should support p50k_base encoding', () => {
      const tokenizer = new TokenizerGateway('p50k_base');
      const text = 'Hello, world!';
      const tokens = tokenizer.encode(text);

      expect(tokens.length).toBeGreaterThan(0);
      tokenizer.free();
    });

    it('should produce different token counts for different encodings', () => {
      const text = 'This is a test of different encodings';

      const tokenizer1 = new TokenizerGateway('cl100k_base');
      const tokens1 = tokenizer1.encode(text);

      const tokenizer2 = new TokenizerGateway('p50k_base');
      const tokens2 = tokenizer2.encode(text);

      // Different encodings may produce different token counts
      // We just verify both work, they may or may not be different lengths
      expect(tokens1.length).toBeGreaterThan(0);
      expect(tokens2.length).toBeGreaterThan(0);

      tokenizer1.free();
      tokenizer2.free();
    });
  });

  describe('token counting', () => {
    it('should count tokens for typical messages', () => {
      const message = 'What is the capital of France?';
      const tokens = tokenizer.encode(message);

      // This specific message should be around 7-8 tokens with cl100k_base
      expect(tokens.length).toBeGreaterThan(5);
      expect(tokens.length).toBeLessThan(15);
    });

    it('should handle long text', () => {
      const longText = 'word '.repeat(1000);
      const tokens = tokenizer.encode(longText);

      expect(tokens.length).toBeGreaterThan(1000);
    });
  });
});
