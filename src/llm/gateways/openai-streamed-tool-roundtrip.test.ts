import { Ok, isOk } from '../../error';
import { LlmBroker } from '../broker';
import { Message } from '../models';
import { LlmTool } from '../tools';
import { OMLXGateway } from './omlx';
import { OpenAIGateway } from './openai';

function streamResponse(frames: readonly string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    })
  );
}

const toolFrames = [
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_split_id","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":"}}]},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Paris\\"}"}}]},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
  'data: [DONE]\n\n',
];

const answerFrames = [
  'data: {"choices":[{"delta":{"content":"Sunny in Paris."},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
  'data: [DONE]\n\n',
];

describe.each([
  ['OpenAI', () => new OpenAIGateway('test-key')],
  ['oMLX', () => new OMLXGateway()],
] as const)('%s streamed tool round trip', (_provider, createGateway) => {
  it('should carry the first chunk tool call id into the follow-up request after later arguments', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(streamResponse(toolFrames))
      .mockResolvedValueOnce(streamResponse(answerFrames));
    const run = jest.fn(async () => Ok({ temperature: 22 }));
    const tool: LlmTool = {
      name: () => 'get_weather',
      matches: (name) => name === 'get_weather',
      descriptor: () => ({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the weather',
          parameters: { type: 'object', properties: { location: { type: 'string' } } },
        },
      }),
      run,
    };
    const broker = new LlmBroker('gpt-4o', createGateway());
    const chunks: string[] = [];

    try {
      for await (const chunk of broker.generateStream(
        [Message.user('Weather in Paris?')],
        undefined,
        [tool]
      )) {
        if (!isOk(chunk)) throw chunk.error;
        chunks.push(chunk.value);
      }

      expect(chunks.join('')).toBe('Sunny in Paris.');
      expect(run).toHaveBeenCalledWith({ location: 'Paris' }, expect.any(Object));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const followUp = JSON.parse(fetchMock.mock.calls[1][1]?.body as string) as {
        messages: unknown[];
      };
      expect(followUp.messages.slice(1)).toEqual([
        {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call_split_id',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
            },
          ],
        },
        {
          role: 'tool',
          content: '{"temperature":22}',
          tool_call_id: 'call_split_id',
        },
      ]);
    } finally {
      fetchMock.mockRestore();
    }
  });
});
