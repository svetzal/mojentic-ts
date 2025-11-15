/**
 * Image utilities for converting file paths to base64 data URIs
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

/**
 * Read an image file and convert it to a base64 data URI
 *
 * @param filePath - Path to the image file
 * @returns Base64 data URI string (e.g., "data:image/jpeg;base64,...")
 */
export function imageToDataUri(filePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- User-provided image paths expected for multimodal LLM input
  const imageBuffer = readFileSync(filePath);
  const base64 = imageBuffer.toString('base64');

  // Determine MIME type from file extension
  const ext = extname(filePath).toLowerCase();
  const mimeType = getMimeType(ext);

  return `data:${mimeType};base64,${base64}`;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };

  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Create a message content item for an image
 *
 * @param filePath - Path to the image file
 * @returns ContentItem for the image
 */
export function imageContent(filePath: string) {
  return {
    type: 'image_url' as const,
    image_url: {
      url: imageToDataUri(filePath),
    },
  };
}

/**
 * Create a message content item for text
 */
export function textContent(text: string) {
  return {
    type: 'text' as const,
    text,
  };
}
