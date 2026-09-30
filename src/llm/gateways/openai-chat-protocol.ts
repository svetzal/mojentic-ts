/**
 * OpenAI-compatible chat completions wire format, shared by every gateway that speaks it.
 *
 * Request shaping (response format, tools), response tool-call parsing, and the legacy
 * streaming parser that turns SSE lines into {@link StreamChunk} values.
 */

import { randomUUID } from 'node:crypto';

import { CompletionConfig, StreamChunk, ToolCall } from '../models';
import { ToolDescriptor } from '../tools';

/** A tool as the chat completions API receives it. */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** A tool call as a chat completions response reports it. */
export interface OpenAIResponseToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIStreamDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: OpenAIStreamDelta;
    finish_reason: string | null;
  }>;
}

interface ToolCallInProgress {
  id: string | null;
  name: string | null;
  arguments: string;
}

/**
 * Translate the configured response format into the `response_format` field.
 *
 * Returns `undefined` when no format is configured, leaving the provider default in place.
 */
export function toOpenAIResponseFormat(
  format: CompletionConfig['responseFormat']
): Record<string, unknown> | undefined {
  if (format === undefined) return undefined;
  if (format.type === 'text') return { type: 'text' };
  if (format.schema === undefined) return { type: 'json_object' };
  return { type: 'json_schema', json_schema: { name: 'response', schema: format.schema } };
}

/** Translate tool descriptors into the `tools` field. */
export function toOpenAITools(tools: readonly ToolDescriptor[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));
}

/**
 * Parse the tool calls of a response message. Returns `undefined` when there are none.
 */
export function parseOpenAIToolCalls(
  toolCalls: readonly OpenAIResponseToolCall[] | undefined
): ToolCall[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: 'function' as const,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));
}

/**
 * Yield each complete line of a response body. A trailing partial line is discarded.
 */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    yield* lines;
  }
}

function accumulateToolCallDeltas(
  accumulator: Map<number, ToolCallInProgress>,
  deltas: NonNullable<OpenAIStreamDelta['tool_calls']>
): void {
  for (const toolCallDelta of deltas) {
    const acc = accumulator.get(toolCallDelta.index) ?? { id: null, name: null, arguments: '' };
    accumulator.set(toolCallDelta.index, acc);

    // First chunk has id and name
    if (toolCallDelta.id) {
      acc.id = toolCallDelta.id;
    }

    if (toolCallDelta.function?.name) {
      acc.name = toolCallDelta.function.name;
    }

    // All chunks may have argument fragments
    if (toolCallDelta.function?.arguments) {
      acc.arguments += toolCallDelta.function.arguments;
    }
  }
}

function completedToolCalls(accumulator: Map<number, ToolCallInProgress>): ToolCall[] {
  // Sort by index to maintain order
  return Array.from(accumulator.entries())
    .sort(([a], [b]) => a - b)
    .map(([, tc]) => ({
      id: tc.id || randomUUID(),
      type: 'function' as const,
      function: {
        name: tc.name || '',
        arguments: tc.arguments,
      },
    }));
}

function chunksForFrame(
  data: OpenAIStreamChunk,
  accumulator: Map<number, ToolCallInProgress>,
  chunks: StreamChunk[]
): void {
  const choice = data.choices[0];
  if (!choice) return;

  const delta = choice.delta;
  const finishReason = choice.finish_reason;

  // Yield content chunks as they arrive
  if (delta.content) {
    chunks.push({ content: delta.content, done: false });
  }

  // Tool call arguments stream incrementally, indexed by tool call index
  if (delta.tool_calls) {
    accumulateToolCallDeltas(accumulator, delta.tool_calls);
  }

  // When stream is complete with tool_calls, yield accumulated tool calls
  if (finishReason === 'tool_calls' && accumulator.size > 0) {
    chunks.push({
      toolCalls: completedToolCalls(accumulator),
      done: true,
      finishReason: 'tool_calls',
    });
  }

  if (finishReason && finishReason !== 'tool_calls') {
    chunks.push({ done: true, finishReason: finishReason as StreamChunk['finishReason'] });
  }
}

/**
 * Turn the SSE lines of a streamed chat completion into stream chunks.
 *
 * Content is yielded as it arrives. Tool calls are accumulated across deltas and yielded once,
 * complete, when the finish reason is `tool_calls`. Frames that cannot be parsed are logged and
 * skipped. Fields this parser does not know, such as `reasoning_content`, are ignored.
 */
export async function* parseOpenAILegacyStream(
  lines: AsyncIterable<string>
): AsyncGenerator<StreamChunk> {
  const accumulator = new Map<number, ToolCallInProgress>();

  for await (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
    if (!trimmedLine.startsWith('data: ')) continue;

    const chunks: StreamChunk[] = [];
    try {
      const data = JSON.parse(trimmedLine.slice(6)) as OpenAIStreamChunk;
      chunksForFrame(data, accumulator, chunks);
    } catch (parseError) {
      console.error(`Failed to parse stream chunk: ${trimmedLine}`, parseError);
    }
    yield* chunks;
  }
}
