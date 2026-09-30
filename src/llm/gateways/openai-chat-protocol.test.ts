import { StreamChunk } from '../models';
import { parseOpenAILegacyStream } from './openai-chat-protocol';

async function* lines(frames: readonly string[]): AsyncGenerator<string> {
  yield* frames;
}

async function collect(frames: readonly string[]): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of parseOpenAILegacyStream(lines(frames))) chunks.push(chunk);
  return chunks;
}

const twoCalls =
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"first","arguments":"{}"}},{"index":1,"function":{"name":"second","arguments":"{}"}}]},"finish_reason":null}]}';
const toolFinish = 'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}';

describe('legacy streamed tool calls', () => {
  it('should assign distinct nonempty ids when the provider omits them', async () => {
    const chunks = await collect([twoCalls, toolFinish, 'data: [DONE]']);
    const ids = chunks[0].toolCalls?.map((call) => call.id);

    expect(ids).toEqual([expect.any(String), expect.any(String)]);
    expect(ids).not.toContain('');
    expect(new Set(ids).size).toBe(2);
  });
  it('should flush pending calls at DONE without a tool finish frame', async () => {
    const chunks = await collect([twoCalls, 'data: [DONE]']);

    expect(chunks).toEqual([
      {
        toolCalls: [
          {
            id: expect.any(String),
            type: 'function',
            function: { name: 'first', arguments: '{}' },
          },
          {
            id: expect.any(String),
            type: 'function',
            function: { name: 'second', arguments: '{}' },
          },
        ],
        done: true,
        finishReason: 'tool_calls',
      },
    ]);
  });

  it('should emit calls once when both a finish frame and DONE arrive', async () => {
    const chunks = await collect([twoCalls, toolFinish, 'data: [DONE]']);

    expect(chunks).toHaveLength(1);
  });

  it('should leave an unterminated stream without a completed call batch', async () => {
    const chunks = await collect([twoCalls]);

    expect(chunks).toEqual([]);
  });
});
