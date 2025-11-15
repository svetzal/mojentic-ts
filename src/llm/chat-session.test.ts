/**
 * Tests for ChatSession
 */

import { ChatSession } from './chat-session';
import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { MessageRole, GatewayResponse, StreamChunk } from './models';
import { Result, Ok } from '../error';
import { DateResolverTool } from './tools/date-resolver';

// Mock gateway for testing
class MockGateway implements LlmGateway {
  private responses: string[] = [];
  private currentIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async generate(): Promise<Result<GatewayResponse, Error>> {
    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    return Ok({
      content: response,
      finishReason: 'stop',
    });
  }

  async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    yield Ok({ content: response, done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['test-model']);
  }

  async calculateEmbeddings(): Promise<Result<number[], Error>> {
    return Ok([0.1, 0.2, 0.3]);
  }
}

describe('ChatSession', () => {
  describe('basic functionality', () => {
    it('should create a session with system prompt', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker);

      const messages = session.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe(MessageRole.System);
      expect(messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should create a session with custom system prompt', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker, {
        systemPrompt: 'You are a coding assistant.',
      });

      const messages = session.getMessages();
      expect(messages[0].content).toBe('You are a coding assistant.');
    });

    it('should add user and assistant messages', async () => {
      const gateway = new MockGateway(['Hello! How can I help?']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker);

      const response = await session.send('Hi there!');

      expect(response).toBe('Hello! How can I help?');

      const messages = session.getMessages();
      expect(messages).toHaveLength(3); // system, user, assistant
      expect(messages[1].role).toBe(MessageRole.User);
      expect(messages[1].content).toBe('Hi there!');
      expect(messages[2].role).toBe(MessageRole.Assistant);
      expect(messages[2].content).toBe('Hello! How can I help?');
    });

    it('should maintain conversation history', async () => {
      const gateway = new MockGateway(['First response', 'Second response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker);

      await session.send('First query');
      await session.send('Second query');

      const messages = session.getMessages();
      expect(messages).toHaveLength(5); // system + 2 exchanges
    });

    it('should clear messages except system prompt', async () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker);

      await session.send('Test query');
      expect(session.getMessages()).toHaveLength(3);

      session.clear();
      expect(session.getMessages()).toHaveLength(1);
      expect(session.getMessages()[0].role).toBe(MessageRole.System);
    });
  });

  describe('context management', () => {
    it('should remove old messages when context limit exceeded', async () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);

      // Create session with very small context window
      const session = new ChatSession(broker, {
        maxContext: 50, // Very small limit
      });

      // Send multiple messages
      await session.send('First message');
      await session.send('Second message');
      await session.send('Third message');

      const messages = session.getMessages();

      // Should have system prompt and only the most recent messages
      expect(messages[0].role).toBe(MessageRole.System);
      expect(messages.length).toBeGreaterThan(1);
    });

    it('should keep system prompt when removing old messages', async () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);

      const session = new ChatSession(broker, {
        maxContext: 50,
      });

      // Send enough messages to trigger removal
      for (let i = 0; i < 5; i++) {
        await session.send(`Message ${i}`);
      }

      const messages = session.getMessages();

      // First message should always be system prompt
      expect(messages[0].role).toBe(MessageRole.System);
    });
  });

  describe('configuration', () => {
    it('should accept custom temperature', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker, {
        temperature: 0.5,
      });

      expect(session).toBeDefined();
    });

    it('should accept tools', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker, {
        tools: [new DateResolverTool()],
      });

      expect(session).toBeDefined();
    });

    it('should accept custom max context', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker, {
        maxContext: 4096,
      });

      expect(session).toBeDefined();
    });
  });

  describe('resource cleanup', () => {
    it('should dispose without error', () => {
      const gateway = new MockGateway(['response']);
      const broker = new LlmBroker('test-model', gateway);
      const session = new ChatSession(broker);

      expect(() => session.dispose()).not.toThrow();
    });
  });
});
