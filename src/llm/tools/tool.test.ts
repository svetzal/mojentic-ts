/**
 * Tests for tool system
 */

import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from './tool';
import { Ok, Err, Result } from '../../error';

class TestTool extends BaseTool {
  constructor(
    private toolName: string,
    private shouldSucceed: boolean = true
  ) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    if (!this.shouldSucceed) {
      return Err(new Error('Tool execution failed'));
    }
    return Ok({ result: 'success', args });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: this.toolName,
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Test input',
            },
          },
          required: ['input'],
        },
      },
    };
  }
}

describe('BaseTool', () => {
  describe('name', () => {
    it('should return the tool name from descriptor', () => {
      const tool = new TestTool('test_tool');
      expect(tool.name()).toBe('test_tool');
    });

    it('should return different names for different tools', () => {
      const tool1 = new TestTool('tool_one');
      const tool2 = new TestTool('tool_two');
      expect(tool1.name()).toBe('tool_one');
      expect(tool2.name()).toBe('tool_two');
    });
  });

  describe('run', () => {
    it('should execute successfully', async () => {
      const tool = new TestTool('test_tool');
      const result = await tool.run({ input: 'test' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ result: 'success', args: { input: 'test' } });
      }
    });

    it('should handle errors', async () => {
      const tool = new TestTool('test_tool', false);
      const result = await tool.run({ input: 'test' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Tool execution failed');
      }
    });
  });

  describe('descriptor', () => {
    it('should return tool descriptor', () => {
      const tool = new TestTool('test_tool');
      const descriptor = tool.descriptor();
      expect(descriptor.type).toBe('function');
      expect(descriptor.function.name).toBe('test_tool');
      expect(descriptor.function.description).toBe('A test tool');
    });

    it('should include parameter schema', () => {
      const tool = new TestTool('test_tool');
      const descriptor = tool.descriptor();
      expect(descriptor.function.parameters.type).toBe('object');
      expect(descriptor.function.parameters.properties).toBeDefined();
      expect(descriptor.function.parameters.required).toEqual(['input']);
    });
  });

  describe('matches', () => {
    it('should return true when name matches', () => {
      const tool = new TestTool('test_tool');
      expect(tool.matches('test_tool')).toBe(true);
    });

    it('should return false when name does not match', () => {
      const tool = new TestTool('test_tool');
      expect(tool.matches('other_tool')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const tool = new TestTool('test_tool');
      expect(tool.matches('Test_Tool')).toBe(false);
      expect(tool.matches('TEST_TOOL')).toBe(false);
    });

    it('should handle empty string', () => {
      const tool = new TestTool('test_tool');
      expect(tool.matches('')).toBe(false);
    });
  });
});
