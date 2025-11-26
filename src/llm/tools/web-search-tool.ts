/**
 * Web search tool - searches the web using DuckDuckGo
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Err, Result } from '../../error';

/**
 * Search result interface
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Tool that searches the web using DuckDuckGo Lite
 */
export class WebSearchTool extends BaseTool {
  private readonly baseUrl = 'https://lite.duckduckgo.com/lite/';
  private readonly maxResults = 10;

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const query = args.query as string;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return Err(new Error('Query parameter is required and must be a non-empty string'));
    }

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const url = `${this.baseUrl}?q=${encodedQuery}`;

      const response = await fetch(url);

      if (!response.ok) {
        return Err(new Error(`Search request failed with status ${response.status}`));
      }

      const html = await response.text();
      const results = this.parseResults(html);

      return Ok(JSON.stringify(results, null, 2));
    } catch (error) {
      return Err(error instanceof Error ? error : new Error('Unknown error during web search'));
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          'Search the web for information using DuckDuckGo. Returns organic search results.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
          },
          required: ['query'],
        },
      },
    };
  }

  /**
   * Parse search results from DuckDuckGo Lite HTML
   */
  private parseResults(html: string): SearchResult[] {
    const results: SearchResult[] = [];

    // DuckDuckGo Lite uses table rows for results
    // Each result has a structure like:
    // <tr><td>...</td></tr> (ad/info rows)
    // <tr><td valign="top">N.</td><td><a rel="nofollow" href="URL">Title</a><br>Snippet</td></tr>

    // Match result rows with numbered entries
    // Using [\s\S] instead of . with 's' flag for better compatibility
    const resultPattern =
      /<tr>\s*<td[^>]*valign="top"[^>]*>\d+\.<\/td>\s*<td[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>(?:<br\s*\/?>|\s*)([\s\S]*?)<\/td>\s*<\/tr>/gi;

    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < this.maxResults) {
      const url = this.decodeHtmlEntities(match[1].trim());
      const title = this.stripHtmlTags(this.decodeHtmlEntities(match[2].trim()));
      const snippet = this.stripHtmlTags(this.decodeHtmlEntities(match[3].trim()));

      // Only include results with meaningful content
      if (url && title && snippet) {
        results.push({ title, url, snippet });
      }
    }

    return results;
  }

  /**
   * Strip HTML tags from a string
   */
  private stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      // eslint-disable-next-line security/detect-non-literal-regexp -- Entity patterns are from controlled set
      result = result.replace(new RegExp(entity, 'g'), char);
    }

    return result;
  }
}
