/**
 * Adapter for converting LLM messages to OpenAI format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LlmMessage, ToolCall } from '../models';

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
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
      // Check for images in content array
      const imagePaths = extractImagePaths(m);

      if (imagePaths.length > 0) {
        // Create a content structure with text and images
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        // Add text content
        const textContent = typeof m.content === 'string' ? m.content : getTextFromContent(m);
        if (textContent) {
          content.push({ type: 'text', text: textContent });
        }

        // Add each image as a base64-encoded URL
        for (const imagePath of imagePaths) {
          try {
            const binaryData = readFileAsBinary(imagePath);
            const base64Image = encodeBase64(binaryData);
            const imageType = getImageType(imagePath);

            content.push({
              type: 'image_url',
              image_url: {
                url: `data:image/${imageType};base64,${base64Image}`,
              },
            });
          } catch (e) {
            console.error(`Failed to encode image: ${e} (${imagePath})`);
          }
        }

        newMessages.push({ role: 'user', content });
      } else {
        newMessages.push({
          role: 'user',
          content: typeof m.content === 'string' ? m.content : getTextFromContent(m),
        });
      }
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
            arguments: JSON.stringify(tc.function.arguments),
          },
        }));
      }

      newMessages.push(msg);
    } else if (m.role === 'tool') {
      if (m.tool_calls && m.tool_calls.length > 0) {
        newMessages.push({
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : '',
          tool_call_id: m.tool_calls[0].id || '',
        });
      }
    } else {
      console.error(`Unknown message role: ${m.role}`);
    }
  }

  return newMessages;
}

/**
 * Extract image paths from a message.
 */
function extractImagePaths(message: LlmMessage): string[] {
  if (!Array.isArray(message.content)) {
    return [];
  }

  const paths: string[] = [];
  for (const item of message.content) {
    if (item.type === 'image_url' && item.image_url?.url) {
      // If it's a file path (not a data URI or URL), add it
      const url = item.image_url.url;
      if (!url.startsWith('data:') && !url.startsWith('http')) {
        paths.push(url);
      }
    }
  }
  return paths;
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
