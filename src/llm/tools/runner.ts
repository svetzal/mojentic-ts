/**
 * Tool runner abstraction for executing batches of tool calls.
 *
 * Provides pluggable execution strategies (serial, parallel) so brokers
 * can stay independent of concurrency policy.
 */

import { Result, isOk } from '../../error';
import { LlmTool, ToolArgs, ToolResult } from './tool';

/**
 * A single tool call to execute, identified by an opaque id.
 *
 * The id is preserved on the matching {@link ToolCallOutcome} so callers can
 * pair calls and outcomes deterministically.
 */
export interface ToolCallExecution {
  id: string;
  name: string;
  args: ToolArgs;
}

/**
 * Outcome of executing a single tool call.
 *
 * Discriminated by the `ok` flag — `true` means the tool returned a result,
 * `false` means the tool returned an error or threw.
 */
export type ToolCallOutcome =
  | { id: string; name: string; ok: true; result: ToolResult; durationMs: number }
  | { id: string; name: string; ok: false; error: Error; durationMs: number };

/**
 * Context passed to a tool runner for a single batch.
 */
export interface ToolRunContext {
  /** Optional signal used to cancel in-flight tool execution. */
  signal?: AbortSignal;
  /** Correlation id propagated to per-tool tracing. */
  correlationId?: string;
  /** Source identifier propagated to per-tool tracing. */
  source?: string;
  /**
   * Optional per-call hook fired when a tool starts running.
   * Useful for emitting `tool_call_dispatched`-style events.
   */
  onCallStart?: (call: ToolCallExecution) => void;
  /**
   * Optional per-call hook fired when a tool produces an outcome.
   * Useful for emitting per-tool tracer events from the runner.
   */
  onCallComplete?: (outcome: ToolCallOutcome) => void;
}

/**
 * Strategy for executing a batch of tool calls.
 *
 * Implementations decide concurrency, ordering, and cancellation semantics.
 * Output order must match input order regardless of execution order.
 */
export interface ToolRunner {
  runBatch(
    calls: readonly ToolCallExecution[],
    tools: readonly LlmTool[],
    context?: ToolRunContext
  ): Promise<ToolCallOutcome[]>;
}

const NOT_FOUND_ERROR = (name: string): Error => new Error(`Tool ${name} not found`);

async function executeOne(
  call: ToolCallExecution,
  tools: readonly LlmTool[],
  context: ToolRunContext | undefined
): Promise<ToolCallOutcome> {
  const start = Date.now();
  context?.onCallStart?.(call);

  const tool = tools.find((t) => t.matches(call.name));
  if (!tool) {
    const outcome: ToolCallOutcome = {
      id: call.id,
      name: call.name,
      ok: false,
      error: NOT_FOUND_ERROR(call.name),
      durationMs: Date.now() - start,
    };
    context?.onCallComplete?.(outcome);
    return outcome;
  }

  try {
    const ctx = { signal: context?.signal };
    const result: Result<ToolResult, Error> = await tool.run(call.args, ctx);
    const durationMs = Date.now() - start;
    const outcome: ToolCallOutcome = isOk(result)
      ? { id: call.id, name: call.name, ok: true, result: result.value, durationMs }
      : { id: call.id, name: call.name, ok: false, error: result.error, durationMs };
    context?.onCallComplete?.(outcome);
    return outcome;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const outcome: ToolCallOutcome = {
      id: call.id,
      name: call.name,
      ok: false,
      error,
      durationMs: Date.now() - start,
    };
    context?.onCallComplete?.(outcome);
    return outcome;
  }
}

/**
 * Executes tool calls one at a time in input order.
 *
 * This is the default for {@link LlmBroker} for backward compatibility and
 * for cases where you want predictable, stepwise debugging.
 */
export class SerialToolRunner implements ToolRunner {
  async runBatch(
    calls: readonly ToolCallExecution[],
    tools: readonly LlmTool[],
    context?: ToolRunContext
  ): Promise<ToolCallOutcome[]> {
    const outcomes: ToolCallOutcome[] = [];
    for (const call of calls) {
      if (context?.signal?.aborted) {
        outcomes.push({
          id: call.id,
          name: call.name,
          ok: false,
          error: new Error('Tool batch aborted'),
          durationMs: 0,
        });
        continue;
      }
      outcomes.push(await executeOne(call, tools, context));
    }
    return outcomes;
  }
}

/**
 * Executes tool calls concurrently with a bounded fan-out.
 *
 * `maxConcurrency` defaults to 4 — high enough to win on typical realtime
 * turns (2–3 concurrent function calls) but low enough that unbounded fan-out
 * into rate-limited APIs (web search, embeddings) doesn't punish users.
 */
export class ParallelToolRunner implements ToolRunner {
  constructor(private readonly maxConcurrency: number = 4) {
    if (!Number.isFinite(maxConcurrency) || maxConcurrency < 1) {
      throw new Error(`maxConcurrency must be a positive integer, got ${maxConcurrency}`);
    }
  }

  async runBatch(
    calls: readonly ToolCallExecution[],
    tools: readonly LlmTool[],
    context?: ToolRunContext
  ): Promise<ToolCallOutcome[]> {
    if (calls.length === 0) {
      return [];
    }

    const outcomes: ToolCallOutcome[] = new Array(calls.length);
    let cursor = 0;

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(this.maxConcurrency, calls.length);

    for (let w = 0; w < workerCount; w++) {
      workers.push(
        (async (): Promise<void> => {
          while (true) {
            const idx = cursor++;
            if (idx >= calls.length) {
              return;
            }
            // idx is bounded by calls.length above; safe array access.
            // eslint-disable-next-line security/detect-object-injection
            const call = calls[idx];
            if (context?.signal?.aborted) {
              // eslint-disable-next-line security/detect-object-injection
              outcomes[idx] = {
                id: call.id,
                name: call.name,
                ok: false,
                error: new Error('Tool batch aborted'),
                durationMs: 0,
              };
              continue;
            }
            // eslint-disable-next-line security/detect-object-injection
            outcomes[idx] = await executeOne(call, tools, context);
          }
        })()
      );
    }

    await Promise.all(workers);
    return outcomes;
  }
}
