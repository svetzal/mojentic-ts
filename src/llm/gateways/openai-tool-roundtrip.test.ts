/**
 * Parity-protective integration test for OpenAI tool round-trip via LlmBroker.
 *
 * Drives LlmBroker.generate(...) end-to-end with a real OpenAIGateway and a real LlmTool,
 * mocking only the HTTP boundary (global.fetch).
 *
 * Detects:
 *   - Bug #1: tool messages being silently excluded (tool_call_id vs tool_calls)
 *   - Bug #2: double-serialization of tool_calls[].function.arguments
 */

import { OpenAIGateway } from './openai';
import { LlmBroker } from '../broker';
import { Message } from '../models';
import { LlmTool, ToolArgs, ToolResult, ToolDescriptor } from '../tools';
import { Result, Ok, isOk } from '../../error';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// A real LlmTool that returns { temp: 22 }
class GetWeatherTool implements LlmTool {
  name(): string {
    return 'get_weather';
  }

  matches(name: string): boolean {
    return name === 'get_weather';
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'The city name' },
          },
          required: ['location'],
        },
      },
    };
  }

  async run(_args: ToolArgs): Promise<Result<ToolResult, Error>> {
    return Ok({ temp: 22 });
  }
}

describe('OpenAI tool round-trip integration', () => {
  let gateway: OpenAIGateway;
  let broker: LlmBroker;
  let capturedRequests: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    mockFetch.mockClear();
    capturedRequests = [];
    gateway = new OpenAIGateway('test-api-key', 'https://api.openai.com/v1');
    broker = new LlmBroker('gpt-4', gateway);

    mockFetch.mockImplementation(async (url: string, options: { body: string }) => {
      capturedRequests.push({
        url,
        body: JSON.parse(options.body) as Record<string, unknown>,
      });

      const callIndex = capturedRequests.length - 1;

      if (callIndex === 0) {
        // First fetch: assistant requests get_weather tool call
        return {
          ok: true,
          json: async () => ({
            id: 'chatcmpl-first',
            object: 'chat.completion',
            created: 1234567890,
            model: 'gpt-4',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_abc123',
                      type: 'function',
                      function: {
                        name: 'get_weather',
                        arguments: '{"location":"Paris"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
        };
      } else {
        // Second fetch: assistant provides final answer
        return {
          ok: true,
          json: async () => ({
            id: 'chatcmpl-second',
            object: 'chat.completion',
            created: 1234567891,
            model: 'gpt-4',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: "It's 22°C in Paris.",
                },
                finish_reason: 'stop',
              },
            ],
          }),
        };
      }
    });
  });

  it('should pass tool result as tool message and not double-serialize arguments', async () => {
    const messages = [Message.user('What is the weather in Paris?')];
    const tool = new GetWeatherTool();

    const result = await broker.generate(messages, [tool]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe("It's 22°C in Paris.");
    }

    // Verify two HTTP requests were made (first for tool call, second for final answer)
    expect(capturedRequests).toHaveLength(2);

    const secondRequest = capturedRequests[1];
    const secondMessages = secondRequest.body.messages as Array<Record<string, unknown>>;

    // Bug #1 detector: the tool result message must be present with role 'tool' and tool_call_id
    const toolResultMessage = secondMessages.find((m) => m.role === 'tool');
    if (!toolResultMessage) throw new Error('expected tool result message to be present');
    expect(toolResultMessage.tool_call_id).toBe('call_abc123');
    expect(toolResultMessage.content).toBe('{"temp":22}');

    // Bug #2 detector: the assistant message's tool_calls arguments must not be double-serialized
    const assistantMessage = secondMessages.find(
      (m) => m.role === 'assistant' && Array.isArray(m.tool_calls)
    ) as Record<string, unknown> | undefined;
    if (!assistantMessage)
      throw new Error('expected assistant message with tool_calls to be present');

    const toolCalls = assistantMessage.tool_calls as Array<{
      function: { arguments: string };
    }>;
    expect(toolCalls[0].function.arguments).toBe('{"location":"Paris"}');
    // The value must be a valid JSON string (not double-serialized)
    expect(() => JSON.parse(toolCalls[0].function.arguments)).not.toThrow();
    expect(JSON.parse(toolCalls[0].function.arguments)).toEqual({ location: 'Paris' });
  });
});
