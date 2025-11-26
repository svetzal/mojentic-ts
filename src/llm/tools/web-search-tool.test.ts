/**
 * Tests for WebSearchTool
 */

import { WebSearchTool } from './web-search-tool';
import { isOk, isErr } from '../../error';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('WebSearchTool', () => {
  let tool: WebSearchTool;

  beforeEach(() => {
    tool = new WebSearchTool();
    mockFetch.mockClear();
  });

  describe('descriptor', () => {
    it('returns valid tool descriptor', () => {
      const descriptor = tool.descriptor();

      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('web_search');
      expect(descriptor.function.description).toContain('Search the web');
      expect(descriptor.function.description).toContain('DuckDuckGo');
      expect(descriptor.function.parameters.type).toBe('object');
      expect(descriptor.function.parameters.properties).toHaveProperty('query');
      expect(descriptor.function.parameters.required).toEqual(['query']);
    });
  });

  describe('name', () => {
    it('returns correct tool name', () => {
      expect(tool.name()).toBe('web_search');
    });
  });

  describe('run', () => {
    it('returns search results for valid query', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td valign="top">1.</td><td><a rel="nofollow" href="https://example.com/page1">Example Page 1</a><br>This is a snippet about example page 1</td></tr>
              <tr><td valign="top">2.</td><td><a rel="nofollow" href="https://example.com/page2">Example Page 2</a><br>This is a snippet about example page 2</td></tr>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test query' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(2);

        expect(results[0]).toEqual({
          title: 'Example Page 1',
          url: 'https://example.com/page1',
          snippet: 'This is a snippet about example page 1',
        });

        expect(results[1]).toEqual({
          title: 'Example Page 2',
          url: 'https://example.com/page2',
          snippet: 'This is a snippet about example page 2',
        });
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lite.duckduckgo.com/lite/?q=test%20query'
      );
    });

    it('encodes query parameters correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
      });

      await tool.run({ query: 'test & special chars?' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lite.duckduckgo.com/lite/?q=test%20%26%20special%20chars%3F'
      );
    });

    it('limits results to maximum of 10', async () => {
      let mockHtml = '<html><body><table>';
      for (let i = 1; i <= 15; i++) {
        mockHtml += `<tr><td valign="top">${i}.</td><td><a rel="nofollow" href="https://example.com/page${i}">Page ${i}</a><br>Snippet ${i}</td></tr>`;
      }
      mockHtml += '</table></body></html>';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results).toHaveLength(10);
      }
    });

    it('strips HTML tags from title and snippet', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td valign="top">1.</td><td><a rel="nofollow" href="https://example.com">Page with <b>bold</b> text</a><br>Snippet with <em>italic</em> text</td></tr>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results[0].title).toBe('Page with bold text');
        expect(results[0].snippet).toBe('Snippet with italic text');
      }
    });

    it('decodes HTML entities', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td valign="top">1.</td><td><a rel="nofollow" href="https://example.com?x=1&amp;y=2">Title &amp; More</a><br>Snippet with &quot;quotes&quot; &amp; ampersands</td></tr>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results[0].title).toBe('Title & More');
        expect(results[0].url).toBe('https://example.com?x=1&y=2');
        expect(results[0].snippet).toBe('Snippet with "quotes" & ampersands');
      }
    });

    it('returns empty array when no results found', async () => {
      const mockHtml = '<html><body><p>No results</p></body></html>';

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results).toEqual([]);
      }
    });

    it('trims whitespace from query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<html></html>',
      });

      await tool.run({ query: '  test query  ' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lite.duckduckgo.com/lite/?q=test%20query'
      );
    });

    it('returns error when query is missing', async () => {
      const result = await tool.run({});

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Query parameter is required');
      }
    });

    it('returns error when query is empty string', async () => {
      const result = await tool.run({ query: '' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Query parameter is required');
      }
    });

    it('returns error when query is only whitespace', async () => {
      const result = await tool.run({ query: '   ' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Query parameter is required');
      }
    });

    it('returns error when query is not a string', async () => {
      const result = await tool.run({ query: 123 });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Query parameter is required');
      }
    });

    it('returns error when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await tool.run({ query: 'test' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Search request failed with status 500');
      }
    });

    it('returns error when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await tool.run({ query: 'test' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toBe('Network error');
      }
    });

    it('returns error when fetch throws non-Error', async () => {
      mockFetch.mockRejectedValue('Unknown error');

      const result = await tool.run({ query: 'test' });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.message).toContain('Unknown error during web search');
      }
    });

    it('handles results with multiline snippets', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td valign="top">1.</td><td><a rel="nofollow" href="https://example.com">Title</a><br>First line
Second line
Third line</td></tr>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results[0].snippet).toContain('First line');
        expect(results[0].snippet).toContain('Second line');
      }
    });

    it('filters out results missing required fields', async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td valign="top">1.</td><td><a rel="nofollow" href="https://example.com">Title</a><br>Snippet</td></tr>
              <tr><td valign="top">2.</td><td><a rel="nofollow" href="">No URL</a><br>Snippet</td></tr>
              <tr><td valign="top">3.</td><td><a rel="nofollow" href="https://example2.com"></a><br>No title</td></tr>
              <tr><td valign="top">4.</td><td><a rel="nofollow" href="https://example3.com">Title</a><br></td></tr>
              <tr><td valign="top">5.</td><td><a rel="nofollow" href="https://example4.com">Good Title</a><br>Good snippet</td></tr>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => mockHtml,
      });

      const result = await tool.run({ query: 'test' });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const results = JSON.parse(result.value as string);
        expect(results).toHaveLength(2);
        expect(results[0].title).toBe('Title');
        expect(results[1].title).toBe('Good Title');
      }
    });
  });
});
