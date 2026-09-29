/**
 * Tests for OpenAI Messages Adapter
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { adaptMessagesToOpenAI } from './openai-messages-adapter';
import { Message, MessageRole } from '../models';
import { imageContent, textContent } from '../utils/image';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DATA_URI = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

function imageUrlItem(url: string): { type: 'image_url'; image_url: { url: string } } {
  return { type: 'image_url', image_url: { url } };
}

describe('adaptMessagesToOpenAI', () => {
  describe('tool role messages (Bug #1)', () => {
    it('should include tool messages that use tool_call_id', () => {
      const messages = [Message.tool('result-payload', 'call_abc123', 'get_weather')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_abc123',
        content: 'result-payload',
      });
    });

    it('should correctly map tool_call_id from singular field on LlmMessage', () => {
      const message = Message.tool('{"temperature":22}', 'call_xyz789', 'get_forecast');

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0].tool_call_id).toBe('call_xyz789');
      expect(result[0].role).toBe('tool');
      expect(result[0].content).toBe('{"temperature":22}');
    });

    it('should join text content items with a newline', () => {
      const message = {
        role: MessageRole.Tool,
        content: [textContent('first line'), textContent('second line')],
        tool_call_id: 'call_items',
      };

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_items',
        content: 'first line\nsecond line',
      });
    });

    it('should not send image content items', () => {
      const message = {
        role: MessageRole.Tool,
        content: [textContent('chart attached'), imageUrlItem(PNG_DATA_URI)],
        tool_call_id: 'call_image',
      };

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0].content).toBe('chart attached');
    });
  });

  describe('assistant role with tool_calls (Bug #2)', () => {
    it('should pass through arguments verbatim without double-serializing', () => {
      const messages = [
        {
          role: MessageRole.Assistant,
          content: '',
          tool_calls: [
            {
              id: 'call_abc123',
              type: 'function' as const,
              function: {
                name: 'get_weather',
                arguments: '{"x":1}',
              },
            },
          ],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      const toolCalls = result[0].tool_calls;
      if (!toolCalls) throw new Error('expected tool_calls to be defined');
      expect(toolCalls[0].function.arguments).toBe('{"x":1}');
    });

    it('should not double-serialize complex argument objects', () => {
      const originalArgs = '{"location":"Paris","unit":"celsius"}';
      const messages = [
        {
          role: MessageRole.Assistant,
          content: '',
          tool_calls: [
            {
              id: 'call_def456',
              type: 'function' as const,
              function: {
                name: 'get_weather',
                arguments: originalArgs,
              },
            },
          ],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      const toolCalls = result[0].tool_calls;
      if (!toolCalls) throw new Error('expected tool_calls to be defined');
      expect(toolCalls[0].function.arguments).toBe(originalArgs);
      expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({
        location: 'Paris',
        unit: 'celsius',
      });
    });
  });

  describe('system role messages', () => {
    it('should adapt system messages', () => {
      const messages = [Message.system('You are a helpful assistant.')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    });

    it('should join text content items with a newline', () => {
      const message = {
        role: MessageRole.System,
        content: [textContent('You are terse.'), textContent('Answer in French.')],
      };

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0]).toEqual({ role: 'system', content: 'You are terse.\nAnswer in French.' });
    });

    it('should not send image content items', () => {
      const message = {
        role: MessageRole.System,
        content: [textContent('Describe images briefly.'), imageUrlItem(PNG_DATA_URI)],
      };

      const result = adaptMessagesToOpenAI([message]);

      expect(result[0].content).toBe('Describe images briefly.');
    });
  });

  describe('user role messages', () => {
    it('should adapt user messages', () => {
      const messages = [Message.user('Hello!')];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello!' });
    });
  });

  describe('user messages with images', () => {
    let tempDir: string;
    let pngPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openai-adapter-test-'));
      pngPath = path.join(tempDir, 'pixel.png');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test setup with controlled tempDir path
      fs.writeFileSync(pngPath, PNG_BYTES);
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      jest.restoreAllMocks();
    });

    it('should pass a data URI image through unchanged', () => {
      const dataUri = 'data:image/jpeg;base64,/9j/4AAQ';
      const messages = [
        { role: MessageRole.User, content: [textContent('What is this?'), imageUrlItem(dataUri)] },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ]);
    });

    it.each(['https://example.com/cat.png', 'http://example.com/cat.png'])(
      'should pass the URL %s through unchanged',
      (url) => {
        const messages = [
          { role: MessageRole.User, content: [textContent('What is this?'), imageUrlItem(url)] },
        ];

        const result = adaptMessagesToOpenAI(messages);

        expect(result[0].content).toEqual([
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url } },
        ]);
      }
    );

    it('should encode a local file path as a data URI', () => {
      const messages = [
        { role: MessageRole.User, content: [textContent('What is this?'), imageUrlItem(pngPath)] },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result[0].content).toEqual([
        { type: 'text', text: 'What is this?' },
        { type: 'image_url', image_url: { url: PNG_DATA_URI } },
      ]);
    });

    it('should send an image made by imageContent', () => {
      const messages = [
        { role: MessageRole.User, content: [textContent('What is this?'), imageContent(pngPath)] },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result).toEqual([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: PNG_DATA_URI } },
          ],
        },
      ]);
    });

    it('should keep text and image parts in the order given', () => {
      const messages = [
        {
          role: MessageRole.User,
          content: [
            textContent('Compare these two images:'),
            imageUrlItem('https://example.com/before.png'),
            imageUrlItem(pngPath),
            textContent('What are the key differences?'),
          ],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result[0].content).toEqual([
        { type: 'text', text: 'Compare these two images:' },
        { type: 'image_url', image_url: { url: 'https://example.com/before.png' } },
        { type: 'image_url', image_url: { url: PNG_DATA_URI } },
        { type: 'text', text: 'What are the key differences?' },
      ]);
    });

    it('should skip an image file that cannot be read and log the failure', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const missingPath = path.join(tempDir, 'missing.png');
      const messages = [
        {
          role: MessageRole.User,
          content: [textContent('What is this?'), imageUrlItem(missingPath)],
        },
      ];

      const result = adaptMessagesToOpenAI(messages);

      expect(result[0].content).toEqual([{ type: 'text', text: 'What is this?' }]);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(missingPath));
    });
  });
});
