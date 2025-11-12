/**
 * Tests for image utilities
 */

import { imageToDataUri, imageContent, textContent } from './image';
import { readFileSync } from 'node:fs';

// Mock fs module
jest.mock('node:fs');

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;

describe('imageToDataUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert JPEG image to data URI', () => {
    const mockBuffer = Buffer.from('fake-image-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/image.jpg');

    expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/image.jpg');
    expect(result).toBe(`data:image/jpeg;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle .jpeg extension', () => {
    const mockBuffer = Buffer.from('jpeg-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/photo.jpeg');

    expect(result).toBe(`data:image/jpeg;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle PNG images', () => {
    const mockBuffer = Buffer.from('png-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/image.png');

    expect(result).toBe(`data:image/png;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle GIF images', () => {
    const mockBuffer = Buffer.from('gif-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/animation.gif');

    expect(result).toBe(`data:image/gif;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle WebP images', () => {
    const mockBuffer = Buffer.from('webp-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/image.webp');

    expect(result).toBe(`data:image/webp;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle BMP images', () => {
    const mockBuffer = Buffer.from('bmp-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/image.bmp');

    expect(result).toBe(`data:image/bmp;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle SVG images', () => {
    const mockBuffer = Buffer.from('svg-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/graphic.svg');

    expect(result).toBe(`data:image/svg+xml;base64,${mockBuffer.toString('base64')}`);
  });

  it('should default to image/jpeg for unknown extensions', () => {
    const mockBuffer = Buffer.from('unknown-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/file.xyz');

    expect(result).toBe(`data:image/jpeg;base64,${mockBuffer.toString('base64')}`);
  });

  it('should handle uppercase extensions', () => {
    const mockBuffer = Buffer.from('uppercase-data');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageToDataUri('/path/to/IMAGE.PNG');

    expect(result).toBe(`data:image/png;base64,${mockBuffer.toString('base64')}`);
  });
});

describe('imageContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create image content item', () => {
    const mockBuffer = Buffer.from('test-image');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageContent('/path/to/image.jpg');

    expect(result).toEqual({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${mockBuffer.toString('base64')}`,
      },
    });
  });

  it('should handle different image formats', () => {
    const mockBuffer = Buffer.from('png-image');
    mockReadFileSync.mockReturnValue(mockBuffer);

    const result = imageContent('/path/to/image.png');

    expect(result.type).toBe('image_url');
    expect(result.image_url.url).toContain('data:image/png;base64,');
  });
});

describe('textContent', () => {
  it('should create text content item', () => {
    const result = textContent('Hello, world!');

    expect(result).toEqual({
      type: 'text',
      text: 'Hello, world!',
    });
  });

  it('should handle empty text', () => {
    const result = textContent('');

    expect(result).toEqual({
      type: 'text',
      text: '',
    });
  });

  it('should handle multiline text', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = textContent(text);

    expect(result).toEqual({
      type: 'text',
      text,
    });
  });
});
