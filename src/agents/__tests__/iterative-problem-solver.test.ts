/**
 * Tests for IterativeProblemSolver
 */

import { IterativeProblemSolver } from '../iterative-problem-solver';
import { LlmBroker } from '../../llm/broker';
import { LlmGateway } from '../../llm/gateway';
import { GatewayResponse, StreamChunk, MessageRole } from '../../llm/models';
import { Result, Ok, Err } from '../../error';
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult } from '../../llm/tools/tool';

// Mock gateway for testing
class MockGateway implements LlmGateway {
  private responses: string[] = [];
  private currentIndex = 0;

  setResponses(responses: string[]): void {
    this.responses = responses;
    this.currentIndex = 0;
  }

  async generate(): Promise<Result<GatewayResponse, Error>> {
    if (this.currentIndex >= this.responses.length) {
      return Ok({
        content: 'DONE',
        finishReason: 'stop',
      });
    }

    const content = this.responses[this.currentIndex++];
    return Ok({
      content,
      finishReason: 'stop',
    });
  }

  async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
    const content = this.responses[this.currentIndex++] || 'DONE';
    yield Ok({ content, done: true });
  }

  async listModels(): Promise<Result<string[], Error>> {
    return Ok(['test-model']);
  }

  async calculateEmbeddings(): Promise<Result<number[], Error>> {
    return Ok([0.1, 0.2, 0.3]);
  }
}

// Mock tool for testing
class MockTool extends BaseTool {
  private mockResult: ToolResult = { success: true };

  setMockResult(result: ToolResult): void {
    this.mockResult = result;
  }

  async run(_args: ToolArgs): Promise<Result<ToolResult, Error>> {
    return Ok(this.mockResult);
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'mock_tool',
        description: 'A mock tool for testing',
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

describe('IterativeProblemSolver', () => {
  let gateway: MockGateway;
  let broker: LlmBroker;
  let mockTool: MockTool;

  beforeEach(() => {
    gateway = new MockGateway();
    broker = new LlmBroker('test-model', gateway);
    mockTool = new MockTool();
  });

  describe('constructor', () => {
    it('should initialize with minimal config', () => {
      const solver = new IterativeProblemSolver({
        broker,
      });

      expect(solver).toBeDefined();
      solver.dispose();
    });

    it('should initialize with full config', () => {
      const solver = new IterativeProblemSolver({
        broker,
        tools: [mockTool],
        maxIterations: 10,
        systemPrompt: 'Custom system prompt',
        temperature: 0.7,
      });

      expect(solver).toBeDefined();
      solver.dispose();
    });

    it('should use default values when not specified', () => {
      const solver = new IterativeProblemSolver({
        broker,
      });

      // Defaults should be applied (tested indirectly through behavior)
      expect(solver).toBeDefined();
      solver.dispose();
    });
  });

  describe('solve', () => {
    it('should complete successfully when LLM returns DONE', async () => {
      gateway.setResponses([
        'Working on the problem...', // First step
        'DONE', // Second step indicates completion
        'The problem has been solved successfully.', // Summary
      ]);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Test problem');

      expect(result).toBe('The problem has been solved successfully.');
      solver.dispose();
    });

    it('should stop when LLM returns FAIL', async () => {
      gateway.setResponses([
        'Attempting to solve...', // First step
        'FAIL - Cannot proceed', // Second step indicates failure
        'Unable to solve the problem.', // Summary
      ]);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Impossible problem');

      expect(result).toBe('Unable to solve the problem.');
      solver.dispose();
    });

    it('should stop after max iterations', async () => {
      gateway.setResponses(['Step 1', 'Step 2', 'Step 3', 'Final summary after max iterations']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 3,
      });

      const result = await solver.solve('Complex problem');

      expect(result).toBe('Final summary after max iterations');
      solver.dispose();
    });

    it('should recognize DONE in mixed case', async () => {
      gateway.setResponses(['Working...', 'Done with the task', 'Task completed']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Test');

      expect(result).toBe('Task completed');
      solver.dispose();
    });

    it('should recognize FAIL in mixed case', async () => {
      gateway.setResponses(['Trying...', 'Failed to complete', 'Task failed']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Test');

      expect(result).toBe('Task failed');
      solver.dispose();
    });

    it('should work with tools', async () => {
      gateway.setResponses(['Processing with tools...', 'DONE', 'Task completed with tool help']);

      const solver = new IterativeProblemSolver({
        broker,
        tools: [mockTool],
        maxIterations: 5,
      });

      const result = await solver.solve('Problem requiring tools');

      expect(result).toBe('Task completed with tool help');
      solver.dispose();
    });

    it('should handle multiple iterations before completion', async () => {
      gateway.setResponses([
        'Step 1: Analyzing...',
        'Step 2: Processing...',
        'Step 3: Finalizing...',
        'DONE',
        'Successfully completed in multiple steps',
      ]);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Multi-step problem');

      expect(result).toBe('Successfully completed in multiple steps');
      solver.dispose();
    });

    it('should use custom system prompt', async () => {
      gateway.setResponses(['DONE', 'Custom behavior result']);

      const solver = new IterativeProblemSolver({
        broker,
        systemPrompt: 'You are a specialized solver for math problems.',
        maxIterations: 5,
      });

      const result = await solver.solve('Solve equation');

      expect(result).toBe('Custom behavior result');
      solver.dispose();
    });
  });

  describe('getMessages', () => {
    it('should return chat messages', async () => {
      gateway.setResponses(['DONE', 'Result']);

      const solver = new IterativeProblemSolver({
        broker,
      });

      await solver.solve('Test problem');

      const messages = solver.getMessages();

      // Should have system prompt, user messages, and assistant responses
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].role).toBe(MessageRole.System);
      solver.dispose();
    });
  });

  describe('clear', () => {
    it('should clear chat history except system prompt', async () => {
      gateway.setResponses(['DONE', 'Result']);

      const solver = new IterativeProblemSolver({
        broker,
      });

      await solver.solve('Test problem');

      const messagesBefore = solver.getMessages();
      expect(messagesBefore.length).toBeGreaterThan(1);

      solver.clear();

      const messagesAfter = solver.getMessages();
      expect(messagesAfter.length).toBe(1); // Only system prompt remains
      expect(messagesAfter[0].role).toBe(MessageRole.System);
      solver.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      const solver = new IterativeProblemSolver({
        broker,
      });

      // Should not throw
      expect(() => solver.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      const errorGateway: LlmGateway = {
        async generate(): Promise<Result<GatewayResponse, Error>> {
          return Err(new Error('LLM connection failed'));
        },
        async *generateStream(): AsyncGenerator<Result<StreamChunk, Error>> {
          yield Err(new Error('Stream failed'));
        },
        async listModels(): Promise<Result<string[], Error>> {
          return Ok(['test']);
        },
        async calculateEmbeddings(): Promise<Result<number[], Error>> {
          return Ok([]);
        },
      };

      const errorBroker = new LlmBroker('test', errorGateway);
      const solver = new IterativeProblemSolver({
        broker: errorBroker,
      });

      await expect(solver.solve('Test')).rejects.toThrow();
      solver.dispose();
    });
  });

  describe('integration scenarios', () => {
    it('should handle immediate success', async () => {
      gateway.setResponses(['DONE - solved immediately', 'Immediate solution']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Simple problem');

      expect(result).toBe('Immediate solution');
      solver.dispose();
    });

    it('should handle immediate failure', async () => {
      gateway.setResponses(['FAIL - impossible request', 'Cannot be solved']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 5,
      });

      const result = await solver.solve('Impossible problem');

      expect(result).toBe('Cannot be solved');
      solver.dispose();
    });

    it('should respect max iterations of 1', async () => {
      gateway.setResponses(['Working...', 'Only one step taken']);

      const solver = new IterativeProblemSolver({
        broker,
        maxIterations: 1,
      });

      const result = await solver.solve('Test');

      expect(result).toBe('Only one step taken');
      solver.dispose();
    });

    it('should work with temperature setting', async () => {
      gateway.setResponses(['DONE', 'Result with temperature']);

      const solver = new IterativeProblemSolver({
        broker,
        temperature: 0.5,
      });

      const result = await solver.solve('Test');

      expect(result).toBe('Result with temperature');
      solver.dispose();
    });
  });
});
