/** Semantic frame parsing and progress accounting; no HTTP or retry side effects. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Ok, Result } from '../error';
import { StreamChunk, ToolCall } from './models';
import { RecoveryProvider, SemanticProgress } from './recovery';
import { observeCompletionPrefix } from './recovery-progress';
import { CompletionEvidence, LlmStreamEvent, StreamEventError } from './stream-events';
import { isKeepAliveLine } from './gateways/omlx-stream-protocol';
import { LineParser } from './gateways/stream-event-transport';
export const NO_EVIDENCE: CompletionEvidence = {
  finishReason: null,
  usage: null,
  providerModel: null,
  metadata: null,
};
export const zero = (): SemanticProgress =>
  Object.freeze({
    contentBytes: 0,
    reasoningBytes: 0,
    toolFragments: 0,
    completedToolCalls: 0,
  });
export function add(a: SemanticProgress, b: SemanticProgress): SemanticProgress {
  return Object.freeze({
    contentBytes: a.contentBytes + b.contentBytes,
    reasoningBytes: a.reasoningBytes + b.reasoningBytes,
    toolFragments: a.toolFragments + b.toolFragments,
    completedToolCalls: a.completedToolCalls + b.completedToolCalls,
  });
}
/** Observe prefixes independently of decoding and capture, including incomplete frames. */
export class StreamingProgressObserver {
  private readonly decoder = new TextDecoder();
  private complete = zero();
  private pending = '';
  constructor(private readonly provider: RecoveryProvider) {}

  private frame(line: string): SemanticProgress {
    const trimmed = line.trimStart();
    if (this.provider !== 'ollama' && !trimmed.startsWith('data:')) return zero();
    const payload = this.provider === 'ollama' ? trimmed : trimmed.replace(/^data:\s*/, '');
    return {
      ...observeCompletionPrefix(new TextEncoder().encode(payload), true),
      completedToolCalls: 0,
    };
  }

  observe(bytes: Uint8Array): SemanticProgress {
    this.pending += this.decoder.decode(bytes, { stream: true });
    const lines = this.pending.split('\n');
    this.pending = lines.pop() ?? '';
    for (const line of lines) this.complete = add(this.complete, this.frame(line));
    return add(this.complete, this.frame(this.pending));
  }
}
interface Delivery<T> {
  readonly value: T;
  readonly semantic: SemanticProgress;
}
export interface Frame<T> {
  readonly deliveries: readonly Delivery<T>[];
  readonly terminal?: T;
  readonly error?: StreamEventError;
  readonly evidence: CompletionEvidence;
  readonly valid: boolean;
  readonly done: boolean;
  readonly completedToolCalls?: number;
  readonly metrics?: Readonly<Record<string, number | boolean>>;
}
export interface Parser<T> {
  parse(line: string): Frame<T>;
}
export function safeEvidence(
  evidence: CompletionEvidence,
  sensitive: (value: string) => boolean
): CompletionEvidence {
  return {
    finishReason:
      evidence.finishReason &&
      ['stop', 'length', 'tool_calls', 'content_filter'].includes(evidence.finishReason)
        ? evidence.finishReason
        : null,
    usage: evidence.usage,
    providerModel:
      evidence.providerModel && !sensitive(evidence.providerModel) ? evidence.providerModel : null,
    metadata: numericMetrics(evidence),
  };
}
function numericMetrics(evidence: CompletionEvidence): Readonly<Record<string, number | boolean>> {
  const metrics = new Map<string, number | boolean>();
  for (const [key, value] of Object.entries(evidence.metadata ?? {})) {
    if (
      ['total_duration', 'load_duration', 'prompt_eval_duration', 'eval_duration'].includes(key) &&
      (typeof value === 'number' || typeof value === 'boolean')
    )
      metrics.set(key, value);
  }
  if (evidence.usage) {
    metrics.set('promptTokens', evidence.usage.promptTokens);
    metrics.set('completionTokens', evidence.usage.completionTokens);
    metrics.set('totalTokens', evidence.usage.totalTokens);
  }
  return Object.freeze(Object.fromEntries(metrics));
}
function validFrame(line: string, provider: RecoveryProvider): boolean {
  if (!line.trim() || (provider !== 'ollama' && !line.startsWith('data:'))) return false;
  try {
    return typeof JSON.parse(provider === 'ollama' ? line : line.slice(5)) === 'object';
  } catch {
    return false;
  }
}

const toolDelta = z.object({
  index: z.number().int().nonnegative().optional(),
  id: z.string().optional(),
  function: z.object({
    name: z.string().optional(),
    arguments: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  }),
});
const deltaSchema = z.object({
  content: z.string().nullish(),
  thinking: z.string().nullish(),
  reasoning_content: z.string().nullish(),
  tool_calls: z.array(toolDelta).nullish(),
});
const ollamaFrame = z.object({
  message: deltaSchema.optional(),
  done: z.boolean(),
  done_reason: z.string().optional(),
});
const sseFrame = z.object({
  choices: z.array(z.object({ delta: deltaSchema, finish_reason: z.string().nullish() })).max(1),
});
interface PendingTool {
  id: string;
  name: string;
  arguments: string;
}
export function streamParser(
  provider: RecoveryProvider,
  parseLine: LineParser
): Parser<Result<StreamChunk, Error>> {
  let evidence = NO_EVIDENCE;
  const tools = new Map<number, PendingTool>();
  let frameIndex = 0;
  const completeTools = (): ToolCall[] =>
    Array.from(tools.entries())
      .sort(([a], [b]) => a - b)
      .map(([, tool]) => {
        if (tool.name.length === 0)
          throw new StreamEventError('invalid_stream_event', 'Tool name is missing');
        const argumentsValue: unknown = JSON.parse(tool.arguments);
        if (
          typeof argumentsValue !== 'object' ||
          argumentsValue === null ||
          Array.isArray(argumentsValue)
        )
          throw new StreamEventError('invalid_stream_event', 'Tool arguments must be an object');
        return {
          id: tool.id || randomUUID(),
          type: 'function',
          function: { name: tool.name, arguments: tool.arguments },
        };
      });
  return {
    parse: (line) => {
      const empty: Frame<Result<StreamChunk, Error>> = {
        deliveries: [],
        evidence,
        valid: false,
        done: false,
      };
      const trimmed = line.trim();
      if (
        !trimmed ||
        (provider !== 'ollama' && !trimmed.startsWith('data:')) ||
        (provider === 'omlx' && isKeepAliveLine(line))
      )
        return empty;
      const outcome = parseLine(line, evidence);
      evidence = outcome.evidence;
      const parserError = outcome.events.find((event) => event.type === 'error');
      const error = parserError?.type === 'error' ? parserError.error : undefined;
      if (
        error &&
        error.reason !== 'unexpected_tool_calls' &&
        error.reason !== 'incomplete_completion'
      )
        return { ...empty, evidence, error };
      const doneMarker = trimmed === 'data: [DONE]';
      let delta: z.infer<typeof deltaSchema> | undefined;
      let done = doneMarker;
      let finish = evidence.finishReason;
      if (!doneMarker) {
        const json: unknown = JSON.parse(provider === 'ollama' ? trimmed : trimmed.slice(5));
        if (provider === 'ollama') {
          const parsed = ollamaFrame.safeParse(json);
          if (!parsed.success)
            return {
              ...empty,
              error: new StreamEventError('invalid_stream_event', 'Invalid stream frame'),
            };
          delta = parsed.data.message;
          done = parsed.data.done;
          finish = parsed.data.done_reason ?? null;
        } else {
          const parsed = sseFrame.safeParse(json);
          if (!parsed.success)
            return {
              ...empty,
              error: new StreamEventError('invalid_stream_event', 'Invalid stream frame'),
            };
          delta = parsed.data.choices[0]?.delta;
          finish = parsed.data.choices[0]?.finish_reason ?? finish;
        }
      }
      if (!doneMarker) frameIndex++;
      const deliveries: Delivery<Result<StreamChunk, Error>>[] = [];
      const reasoning = delta?.thinking ?? delta?.reasoning_content;
      if (reasoning)
        deliveries.push({
          value: Ok({ done: false, reasoning }),
          semantic: { ...zero(), reasoningBytes: Buffer.byteLength(reasoning) },
        });
      if (delta?.content)
        deliveries.push({
          value: Ok({ done: false, content: delta.content }),
          semantic: { ...zero(), contentBytes: Buffer.byteLength(delta.content) },
        });
      for (const fragment of delta?.tool_calls ?? []) {
        const index = provider === 'ollama' ? tools.size : fragment.index;
        if (index === undefined)
          return {
            ...empty,
            evidence,
            error: new StreamEventError('invalid_stream_event', 'Tool index missing'),
          };
        const known = tools.get(index) ?? { id: '', name: '', arguments: '' };
        known.id += fragment.id ?? '';
        known.name += fragment.function.name ?? '';
        const args = fragment.function.arguments;
        known.arguments +=
          typeof args === 'string' ? args : args === undefined ? '' : JSON.stringify(args);
        tools.set(index, known);
        deliveries.push({
          value: Ok({ done: false, toolCallFragments: [fragment], frameIndex }),
          semantic: { ...zero(), toolFragments: 1 },
        });
      }
      if (done && finish !== 'stop' && (provider === 'ollama' || finish !== 'tool_calls')) {
        return {
          deliveries: [],
          evidence,
          valid: !doneMarker,
          done,
          metrics: numericMetrics(evidence),
          error: new StreamEventError(
            'incomplete_completion',
            'Provider did not report successful completion',
            { evidence }
          ),
        };
      }
      const terminal = done
        ? Ok<StreamChunk>({
            done: true,
            finishReason: finish ?? undefined,
            toolCalls: tools.size > 0 ? completeTools() : undefined,
            evidence,
          })
        : undefined;
      return {
        deliveries,
        evidence,
        valid: !doneMarker,
        done,
        metrics: numericMetrics(evidence),
        terminal,
        completedToolCalls: terminal === undefined ? undefined : tools.size,
      };
    },
  };
}

/** Fold single-turn frames through the existing provider parser without allowing tools. */
export function eventStreamParser(
  provider: RecoveryProvider,
  parseLine: LineParser
): Parser<LlmStreamEvent> {
  let evidence = NO_EVIDENCE;
  return {
    parse: (line) => {
      const result = parseLine(line, evidence);
      evidence = result.evidence;
      const terminal = result.events.find((event) => event.type === 'completed');
      const error = result.events.find((event) => event.type === 'error');
      return {
        evidence,
        terminal,
        error: error?.type === 'error' ? error.error : undefined,
        valid:
          validFrame(line, provider) &&
          (error === undefined ||
            error.error.reason === 'incomplete_completion' ||
            error.error.reason === 'unexpected_tool_calls'),
        done: terminal !== undefined || evidence.finishReason !== null,
        metrics: numericMetrics(evidence),
        deliveries: (error === undefined ? result.events : [])
          .filter((event) => event.type === 'content')
          .map((value) => ({
            value,
            semantic: {
              ...zero(),
              contentBytes: value.type === 'content' ? Buffer.byteLength(value.text) : 0,
            },
          })),
      };
    },
  };
}
