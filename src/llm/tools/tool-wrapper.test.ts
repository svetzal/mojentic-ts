/**
 * Tests for ToolWrapper
 */

import { ToolWrapper } from './tool-wrapper';
import { Agent } from '../agent';
import { LlmBroker } from '../broker';
import { LlmGateway } from '../gateway';
import { GatewayResponse, Message, MessageRole } from '../models';
import { Ok } from '../../error';
import { DateResolverTool } from './date-resolver';

describe('ToolWrapper', () => {
  let mockGateway: jest.Mocked<LlmGateway>;
  let broker: LlmBroker;
  let agent: Agent;

  beforeEach(() => {
    mockGateway = {
      generate: jest.fn(),
      generateStream: jest.fn(),
      listModels: jest.fn(),
      calculateEmbeddings: jest.fn(),
    } as jest.Mocked<LlmGateway>;

    broker = new LlmBroker('test-model', mockGateway);
    agent = new Agent(broker, [new DateResolverTool()], 'You are a temporal specialist.');
  });

  describe('constructor', () => {
    it('should create wrapper with agent, name, and description', () => {
      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test description');
      expect(wrapper.name()).toBe('test_tool');
    });
  });

  describe('descriptor', () => {
    it('should return tool descriptor with function type', () => {
      const wrapper = new ToolWrapper(agent, 'temporal_specialist', 'A temporal specialist');
      const descriptor = wrapper.descriptor();

      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('temporal_specialist');
      expect(descriptor.function.description).toBe('A temporal specialist');
    });

    it('should have input parameter', () => {
      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test');
      const descriptor = wrapper.descriptor();

      expect(descriptor.function.parameters.type).toBe('object');
      expect(descriptor.function.parameters.properties).toHaveProperty('input');
      expect(descriptor.function.parameters.properties?.input).toEqual({
        type: 'string',
        description: 'Instructions for this agent.',
      });
    });

    it('should require input parameter', () => {
      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test');
      const descriptor = wrapper.descriptor();

      expect(descriptor.function.parameters.required).toEqual(['input']);
    });
  });

  describe('name', () => {
    it('should return tool name from descriptor', () => {
      const wrapper = new ToolWrapper(agent, 'custom_name', 'Test');
      expect(wrapper.name()).toBe('custom_name');
    });
  });

  describe('run', () => {
    it('should handle missing input parameter', async () => {
      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test');
      const result = await wrapper.run({});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ error: 'input is required' });
      }
    });

    it('should call agent broker with initial messages and input', async () => {
      const mockResponse: GatewayResponse = {
        content: 'Agent response',
        finishReason: 'stop',
      };

      mockGateway.generate.mockResolvedValue(Ok(mockResponse));

      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test');
      const result = await wrapper.run({ input: 'What day is next Friday?' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('Agent response');
      }

      // Verify broker was called with correct messages
      expect(mockGateway.generate).toHaveBeenCalledWith(
        'test-model',
        [
          Message.system('You are a temporal specialist.'),
          Message.user('What day is next Friday?'),
        ],
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

    it('should pass agent tools to broker', async () => {
      const mockResponse: GatewayResponse = {
        content: 'Response',
        finishReason: 'stop',
      };

      mockGateway.generate.mockResolvedValue(Ok(mockResponse));

      const tools = [new DateResolverTool()];
      const agentWithTools = new Agent(broker, tools, 'Test');
      const wrapper = new ToolWrapper(agentWithTools, 'test_tool', 'Test');

      await wrapper.run({ input: 'Test input' });

      // Verify tools were passed
      const callArgs = mockGateway.generate.mock.calls[0];
      expect(callArgs[3]).toHaveLength(1);
      expect(callArgs[3]?.[0]).toMatchObject({
        type: 'function',
        function: {
          name: 'resolve_date',
        },
      });
    });

    it('should handle broker errors', async () => {
      const error = new Error('Broker failed');
      mockGateway.generate.mockResolvedValue({ ok: false, error });

      const wrapper = new ToolWrapper(agent, 'test_tool', 'Test');
      const result = await wrapper.run({ input: 'Test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('should create proper message flow', async () => {
      const mockResponse: GatewayResponse = {
        content: 'Final response',
        finishReason: 'stop',
      };

      mockGateway.generate.mockResolvedValue(Ok(mockResponse));

      const behavior = 'You are a specialist in history.';
      const historianAgent = new Agent(broker, [], behavior);
      const wrapper = new ToolWrapper(historianAgent, 'historian', 'History expert');

      await wrapper.run({ input: 'Tell me about ancient Rome' });

      // Verify message structure
      const messages = mockGateway.generate.mock.calls[0][1];
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        role: MessageRole.System,
        content: behavior,
      });
      expect(messages[1]).toMatchObject({
        role: MessageRole.User,
        content: 'Tell me about ancient Rome',
      });
    });
  });
});
