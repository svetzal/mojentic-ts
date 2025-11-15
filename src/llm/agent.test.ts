/**
 * Tests for Agent class
 */

import { Agent } from './agent';
import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { GatewayResponse, Message, MessageRole } from './models';
import { Ok } from '../error';
import { DateResolverTool } from './tools/date-resolver';

describe('Agent', () => {
  let mockGateway: jest.Mocked<LlmGateway>;
  let broker: LlmBroker;

  beforeEach(() => {
    mockGateway = {
      generate: jest.fn(),
      generateStream: jest.fn(),
      listModels: jest.fn(),
      calculateEmbeddings: jest.fn(),
    } as jest.Mocked<LlmGateway>;

    broker = new LlmBroker('test-model', mockGateway);
  });

  describe('constructor', () => {
    it('should create agent with broker, tools, and behavior', () => {
      const tools = [new DateResolverTool()];
      const behavior = 'You are a test agent.';
      const agent = new Agent(broker, tools, behavior);

      expect(agent.getBroker()).toBe(broker);
      expect(agent.getTools()).toEqual(tools);
      expect(agent.getBehavior()).toBe(behavior);
    });

    it('should create agent with default empty tools array', () => {
      const agent = new Agent(broker, undefined, 'Test');
      expect(agent.getTools()).toEqual([]);
    });

    it('should create agent with default behavior', () => {
      const agent = new Agent(broker);
      expect(agent.getBehavior()).toBe('You are a helpful assistant.');
    });
  });

  describe('createInitialMessages', () => {
    it('should create system message with behavior', () => {
      const behavior = 'You are a specialist.';
      const agent = new Agent(broker, [], behavior);

      const messages = agent.createInitialMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe(MessageRole.System);
      expect(messages[0].content).toBe(behavior);
    });
  });

  describe('generate', () => {
    it('should generate response with initial messages and user input', async () => {
      const mockResponse: GatewayResponse = {
        content: 'Test response',
        finishReason: 'stop',
      };

      mockGateway.generate.mockResolvedValue(Ok(mockResponse));

      const agent = new Agent(broker, [], 'Test behavior');
      const result = await agent.generate('Hello');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('Test response');
      }

      // Verify broker was called with correct messages
      expect(mockGateway.generate).toHaveBeenCalledWith(
        'test-model',
        [Message.system('Test behavior'), Message.user('Hello')],
        undefined,
        []
      );
    });

    it('should pass tools to broker', async () => {
      const mockResponse: GatewayResponse = {
        content: 'Response with tools',
        finishReason: 'stop',
      };

      mockGateway.generate.mockResolvedValue(Ok(mockResponse));

      const tools = [new DateResolverTool()];
      const agent = new Agent(broker, tools, 'Test behavior');
      await agent.generate('What day is today?');

      expect(mockGateway.generate).toHaveBeenCalledWith(
        'test-model',
        expect.any(Array),
        undefined,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({
              name: 'resolve_date',
            }),
          }),
        ])
      );
    });

    it('should handle errors from broker', async () => {
      const error = new Error('Generation failed');
      mockGateway.generate.mockResolvedValue({ ok: false, error });

      const agent = new Agent(broker);
      const result = await agent.generate('Hello');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });
  });
});
