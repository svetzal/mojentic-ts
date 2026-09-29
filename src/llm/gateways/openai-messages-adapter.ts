/**
 * Adapter for converting LLM messages to OpenAI format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContentItem, LlmMessage, ToolCall } from '../models';

type OpenAIContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

interface OpenAIMessage {
  role: string;
  content: string | OpenAIContentPart[];
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * Read a file as binary data.
 * Note: This function intentionally accepts dynamic file paths as it needs to read
 * user-specified image files for multimodal API requests.
 */
function readFileAsBinary(filePath: string): Buffer {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.readFileSync(filePath);
}

/**
 * Encode binary data as base64 string.
 */
function encodeBase64(data: Buffer): string {
  return data.toString('base64');
}

/**
 * Determine image type from file extension.
 */
function getImageType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);

  // Convert 'jpg' to 'jpeg'
  if (ext === 'jpg') {
    return 'jpeg';
  }

  // Use 'jpeg' for unknown extensions, otherwise use the detected type
  const validTypes = ['jpeg', 'png', 'gif', 'webp'];
  return validTypes.includes(ext) ? ext : 'jpeg';
}

/**
 * Adapt LLM messages to OpenAI format.
 */
export function adaptMessagesToOpenAI(messages: LlmMessage[]): OpenAIMessage[] {
  const newMessages: OpenAIMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      newMessages.push({
        role: 'system',
        content: typeof m.content === 'string' ? m.content : '',
      });
    } else if (m.role === 'user') {
      newMessages.push({ role: 'user', content: adaptUserContent(m) });
    } else if (m.role === 'assistant') {
      const msg: OpenAIMessage = {
        role: 'assistant',
        content: typeof m.content === 'string' ? m.content : getTextFromContent(m) || '',
      };

      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.map((tc: ToolCall) => ({
          id: tc.id || '',
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      newMessages.push(msg);
    } else if (m.role === 'tool') {
      if (m.tool_call_id) {
        newMessages.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : '',
          tool_call_id: m.tool_call_id,
        });
      }
    } else {
      console.error(`Unknown message role: ${m.role}`);
    }
  }

  return newMessages;
}

/**
 * Adapt the content of a user message.
 *
 * A message with image items becomes a list of content parts in the order given.
 * A message without image items becomes plain text.
 */
function adaptUserContent(message: LlmMessage): string | OpenAIContentPart[] {
  if (!Array.isArray(message.content) || !message.content.some(isImageItem)) {
    return getTextFromContent(message);
  }

  return message.content.flatMap(toContentParts);
}

function isImageItem(item: ContentItem): boolean {
  return item.type === 'image_url' && Boolean(item.image_url?.url);
}

/**
 * Convert one content item to zero or one OpenAI content parts.
 */
function toContentParts(item: ContentItem): OpenAIContentPart[] {
  if (item.type === 'text') {
    return item.text ? [{ type: 'text', text: item.text }] : [];
  }

  const url = item.image_url?.url;
  if (!url) {
    return [];
  }

  const imageUrl = resolveImageUrl(url);
  return imageUrl === null ? [] : [{ type: 'image_url', image_url: { url: imageUrl } }];
}

/**
 * Resolve an image reference to a URL that OpenAI accepts.
 *
 * Data URIs and http(s) URLs pass through unchanged. Any other value is a local
 * file path: it is read and encoded as a base64 data URI. A file that cannot be
 * read is logged and gives null, so the image is skipped.
 */
function resolveImageUrl(url: string): string | null {
  if (isDataUri(url) || isHttpUrl(url)) {
    return url;
  }

  try {
    const base64Image = encodeBase64(readFileAsBinary(url));
    return `data:image/${getImageType(url)};base64,${base64Image}`;
  } catch (e) {
    console.error(`Failed to encode image: ${e} (${url})`);
    return null;
  }
}

function isDataUri(url: string): boolean {
  return /^data:/i.test(url);
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Get text content from a message with array content.
 */
function getTextFromContent(message: LlmMessage): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (!Array.isArray(message.content)) {
    return '';
  }

  const textParts: string[] = [];
  for (const item of message.content) {
    if (item.type === 'text' && item.text) {
      textParts.push(item.text);
    }
  }
  return textParts.join('\n');
}
