/**
 * Tests for tool runners (serial + parallel).
 */

import { ParallelToolRunner, SerialToolRunner, ToolCallExecution } from './runner';
import { BaseTool, LlmTool, ToolArgs, ToolDescriptor, ToolResult, ToolRunCtx } from './tool';
import { Err, Ok, Result } from '../../error';

class SpyTool extends BaseTool {
  startedAt: number = -1;
  completedAt: number = -1;
  receivedSignal?: AbortSignal;

  constructor(
    private readonly toolName: string,
    private readonly delayMs: number,
    private readonly outcome: Result<ToolResult, Error> = Ok({ from: 'tool' })
  ) {
    super();
  }

  async run(_args: ToolArgs, ctx?: ToolRunCtx): Promise<Result<ToolResult, Error>> {
    this.startedAt = Date.now();
    this.receivedSignal = ctx?.signal;
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.completedAt = Date.now();
    return this.outcome;
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: this.toolName,
        description: 'spy',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }
}

class ThrowingTool extends BaseTool {
  async run(): Promise<Result<ToolResult, Error>> {
    throw new Error('boom');
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'throws',
        description: 'always throws',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }
}

const exec = (id: string, name: string, args: ToolArgs = {}): ToolCallExecution => ({
  id,
  name,
  args,
});

describe('SerialToolRunner', () => {
  test('executes calls one at a time in input order', async () => {
    const a = new SpyTool('a', 30);
    const b = new SpyTool('b', 30);
    const runner = new SerialToolRunner();

    const outcomes = await runner.runBatch([exec('1', 'a'), exec('2', 'b')], [a, b]);

    expect(outcomes.map((o) => o.id)).toEqual(['1', '2']);
    expect(b.startedAt).toBeGreaterThanOrEqual(a.completedAt);
  });

  test('preserves outcome order matching input order', async () => {
    const slow = new SpyTool('slow', 40);
    const fast = new SpyTool('fast', 5);
    const runner = new SerialToolRunner();

    const outcomes = await runner.runBatch(
      [exec('first', 'slow'), exec('second', 'fast')],
      [slow, fast]
    );

    expect(outcomes[0].id).toBe('first');
    expect(outcomes[1].id).toBe('second');
  });

  test('reports missing tools as failure', async () => {
    const runner = new SerialToolRunner();

    const outcomes = await runner.runBatch([exec('1', 'missing')], []);

    expect(outcomes[0].ok).toBe(false);
    if (!outcomes[0].ok) {
      expect(outcomes[0].error.message).toContain('missing');
    }
  });

  test('captures thrown errors as failure outcomes', async () => {
    const runner = new SerialToolRunner();
    const outcomes = await runner.runBatch([exec('1', 'throws')], [new ThrowingTool()]);

    expect(outcomes[0].ok).toBe(false);
    if (!outcomes[0].ok) {
      expect(outcomes[0].error.message).toBe('boom');
    }
  });
});

describe('ParallelToolRunner', () => {
  test('dispatches calls concurrently up to maxConcurrency', async () => {
    const a = new SpyTool('a', 50);
    const b = new SpyTool('b', 50);
    const runner = new ParallelToolRunner(4);

    const start = Date.now();
    await runner.runBatch([exec('1', 'a'), exec('2', 'b')], [a, b]);
    const elapsed = Date.now() - start;

    // Sequential would take ~100ms; parallel should take ~50ms.
    expect(elapsed).toBeLessThan(95);
    expect(Math.abs(a.startedAt - b.startedAt)).toBeLessThan(20);
  });

  test('respects maxConcurrency = 1 (effectively serial)', async () => {
    const a = new SpyTool('a', 30);
    const b = new SpyTool('b', 30);
    const runner = new ParallelToolRunner(1);

    await runner.runBatch([exec('1', 'a'), exec('2', 'b')], [a, b]);

    expect(b.startedAt).toBeGreaterThanOrEqual(a.completedAt);
  });

  test('preserves outcome order matching input order regardless of completion order', async () => {
    const slow = new SpyTool('slow', 50);
    const fast = new SpyTool('fast', 5);
    const runner = new ParallelToolRunner(4);

    const outcomes = await runner.runBatch(
      [exec('first', 'slow'), exec('second', 'fast')],
      [slow, fast]
    );

    expect(outcomes[0].id).toBe('first');
    expect(outcomes[1].id).toBe('second');
  });

  test('passes AbortSignal to tools', async () => {
    const controller = new AbortController();
    const tool = new SpyTool('a', 10);
    const runner = new ParallelToolRunner(2);

    await runner.runBatch([exec('1', 'a')], [tool], { signal: controller.signal });

    expect(tool.receivedSignal).toBe(controller.signal);
  });

  test('short-circuits queued calls once signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const tool = new SpyTool('a', 10);
    const runner = new ParallelToolRunner(2);

    const outcomes = await runner.runBatch([exec('1', 'a')], [tool], {
      signal: controller.signal,
    });

    expect(outcomes[0].ok).toBe(false);
    expect(tool.startedAt).toBe(-1);
  });

  test('invokes onCallStart and onCallComplete hooks', async () => {
    const started: string[] = [];
    const completed: string[] = [];
    const runner = new ParallelToolRunner(2);

    await runner.runBatch(
      [exec('1', 'a'), exec('2', 'b')],
      [new SpyTool('a', 5), new SpyTool('b', 5)],
      {
        onCallStart: (c) => started.push(c.id),
        onCallComplete: (o) => completed.push(o.id),
      }
    );

    expect(started.sort()).toEqual(['1', '2']);
    expect(completed.sort()).toEqual(['1', '2']);
  });

  test('rejects non-positive maxConcurrency at construction', () => {
    expect(() => new ParallelToolRunner(0)).toThrow();
    expect(() => new ParallelToolRunner(-1)).toThrow();
  });

  test('handles empty batches', async () => {
    const runner = new ParallelToolRunner();
    const outcomes = await runner.runBatch([], []);
    expect(outcomes).toEqual([]);
  });

  test('propagates Err results from tools as failure outcomes', async () => {
    const tool = new SpyTool('a', 1, Err(new Error('rejected')));
    const runner = new ParallelToolRunner();

    const outcomes = await runner.runBatch([exec('1', 'a')], [tool as LlmTool]);

    expect(outcomes[0].ok).toBe(false);
    if (!outcomes[0].ok) {
      expect(outcomes[0].error.message).toBe('rejected');
    }
  });
});
