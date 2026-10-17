import { MonotonicClockGateway } from './monotonic-clock-gateway';
import type { LineParser } from './gateways/stream-event-transport';
import { z } from 'zod';
import { Result } from '../error';
import { StreamChunk } from './models';
import { CompletionEvidence, LlmStreamEvent } from './stream-events';

const deltaSchema = z.object({
  content: z.string().nullish(),
  thinking: z.string().nullish(),
  reasoning_content: z.string().nullish(),
  function_call: z.object({ arguments: z.string().optional() }).nullish(),
  tool_calls: z
    .array(
      z.object({
        function: z
          .object({
            arguments: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
          })
          .optional(),
      })
    )
    .nullish(),
});
const frameSchema = z.object({
  model: z.string().optional(),
  message: deltaSchema.optional(),
  choices: z.array(z.object({ delta: deltaSchema.optional() })).optional(),
});

type FirstTokenKind = 'content' | 'thinking' | 'tool_call';

/** Client observations, independent of provider durations and public delta delivery. */
export class StreamTiming {
  private reported: CompletionEvidence = {
    finishReason: null,
    usage: null,
    providerModel: null,
    metadata: null,
  };

  constructor(private readonly parseLine?: LineParser) {}

  private readonly clock = new MonotonicClockGateway();
  private started?: number;
  private first?: { readonly elapsed: number; readonly kind: FirstTokenKind };

  /** Call immediately before dispatch; retries retain the original request origin. */
  start(): void {
    this.started ??= this.clock.now();
  }

  /** Inspect a complete wire line before parsers can discard thinking or tool arguments. */
  observe(line: string): void {
    if (this.parseLine) this.reported = this.parseLine(line, this.reported).evidence;
    if (this.first !== undefined || this.started === undefined) return;
    const payload = line.trim().replace(/^data:\s*/, '');
    let json: unknown;
    try {
      json = JSON.parse(payload) as unknown;
    } catch {
      return;
    }
    const parsed = frameSchema.safeParse(json);
    if (!parsed.success || parsed.data.model === 'keepalive') return;
    const delta = parsed.data.message ?? parsed.data.choices?.[0]?.delta;
    const argumentsPresent =
      (delta?.function_call?.arguments?.length ?? 0) > 0 ||
      delta?.tool_calls?.some((call) => {
        const args = call.function?.arguments;
        return typeof args === 'string' ? args.length > 0 : args !== undefined;
      });
    const kind =
      delta?.thinking || delta?.reasoning_content
        ? 'thinking'
        : delta?.content
          ? 'content'
          : argumentsPresent
            ? 'tool_call'
            : undefined;
    if (kind !== undefined) this.first = { elapsed: this.clock.now() - this.started, kind };
  }

  /** Observe legacy lines without changing parsing, delivery, or cancellation. */
  async *lines(lines: AsyncIterable<string>): AsyncGenerator<string> {
    for await (const line of lines) {
      this.observe(line);
      yield line;
    }
  }

  /** Preserve provider evidence while adding the client's monotonic millisecond metrics. */
  evidence(evidence: CompletionEvidence = this.reported): CompletionEvidence {
    return {
      ...evidence,
      metadata: {
        ...evidence?.metadata,
        ...(this.started === undefined
          ? {}
          : { request_duration_ms: this.clock.now() - this.started }),
        ...(this.first === undefined
          ? {}
          : {
              time_to_first_token_ms: this.first.elapsed,
              first_token_kind: this.first.kind,
            }),
      },
    };
  }

  /** Retain error identity and recovery details, exposing timing on terminal failures. */
  error<T extends Error & { readonly evidence?: CompletionEvidence }>(
    error: T
  ): T & { readonly evidence: CompletionEvidence } {
    return Object.assign(error, {
      evidence: this.evidence(error.evidence),
    });
  }

  /** Add timing only to terminal events. */
  event(event: LlmStreamEvent): LlmStreamEvent {
    if (event.type === 'completed') return { ...event, metadata: this.evidence(event.metadata) };
    if (event.type === 'error') this.error(event.error);
    return event;
  }

  /** Add timing only to terminal chunks and errors; partial chunks remain unchanged. */
  chunk(result: Result<StreamChunk, Error>): Result<StreamChunk, Error> {
    if (!result.ok) return { ...result, error: this.error(result.error) };
    return result.value.done
      ? { ...result, value: { ...result.value, evidence: this.evidence(result.value.evidence) } }
      : result;
  }
}
