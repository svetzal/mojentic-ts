/**
 * Parity-protective integration test for OpenAI tool round-trip via LlmBroker.
 *
 * Drives LlmBroker.generate(...) end-to-end with a real OpenAIGateway and a real LlmTool,
 * mocking only the HTTP boundary (global.fetch). Fixture files are byte-identical across
 * all mojentic ports (py/ts/ex/ru) — see __fixtures__/openai-tool-roundtrip/README.md.
 *
 * Detects:
 *   - Bug #1: tool messages being silently excluded (tool_call_id vs tool_calls)
 *   - Bug #2: double-serialization of tool_calls[].function.arguments
 */

import * as fs from 'fs';
import * as path from 'path';
import { OpenAIGateway } from './openai';
import { LlmBroker } from '../broker';
import { Message } from '../models';
import { LlmTool, ToolArgs, ToolResult, ToolDescriptor } from '../tools';
import { Result, Ok, isOk } from '../../error';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Load fixtures
const fixturesDir = path.join(__dirname, '__fixtures__', 'openai-tool-roundtrip');

function loadFixture(name: string): unknown {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixturesDir is derived from __dirname (not user input); name is a string literal at each call site
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf-8'));
}

const response1ToolCall = loadFixture('response-1-tool-call.json');
const response2Final = loadFixture('response-2-final.json');
const toolResult = loadFixture('tool-result.json') as Record<string, unknown>;

// A real LlmTool that returns the fixture weather data
class GetWeatherTool implements LlmTool {
  lastArgs?: ToolArgs;

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

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    this.lastArgs = args;
    return Ok(toolResult);
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
    broker = new LlmBroker('gpt-4o-2024-08-06', gateway);

    mockFetch.mockImplementation(async (url: string, options: { body: string }) => {
      capturedRequests.push({
        url,
        body: JSON.parse(options.body) as Record<string, unknown>,
      });

      const callIndex = capturedRequests.length - 1;
      const fixture = callIndex === 0 ? response1ToolCall : response2Final;

      return {
        ok: true,
        json: async () => fixture,
      };
    });
  });

  it('should complete a get_weather tool round-trip using canonical fixtures', async () => {
    const messages = [Message.user("What's the weather in Paris?")];
    const tool = new GetWeatherTool();

    const result = await broker.generate(messages, [tool]);

    // Step 1: assert first request's tools array includes get_weather
    expect(capturedRequests).toHaveLength(2);
    const firstRequestTools = capturedRequests[0].body.tools as Array<{
      function: { name: string };
    }>;
    expect(firstRequestTools.some((t) => t.function.name === 'get_weather')).toBe(true);

    // Step 2: assert the tool was invoked with location === "Paris"
    expect(tool.lastArgs).toBeDefined();
    expect(tool.lastArgs?.location).toBe('Paris');
    expect(tool.lastArgs).toEqual({ location: 'Paris' });

    // Step 3: assert second request messages contain the original user message
    const secondRequest = capturedRequests[1];
    const secondMessages = secondRequest.body.messages as Array<Record<string, unknown>>;
    expect(
      secondMessages.some((m) => m.role === 'user' && m.content === "What's the weather in Paris?")
    ).toBe(true);

    // Step 3 — Bug #2 detector: assistant message arguments must not be double-serialized
    const assistantMessage = secondMessages.find(
      (m) => m.role === 'assistant' && Array.isArray(m.tool_calls)
    ) as Record<string, unknown> | undefined;
    if (!assistantMessage)
      throw new Error('expected assistant message with tool_calls to be present');

    const toolCalls = assistantMessage.tool_calls as Array<{ function: { arguments: string } }>;
    const rawArguments = toolCalls[0].function.arguments;
    // Must be a string (JSON-encoded), not already an object
    expect(typeof rawArguments).toBe('string');
    // Must parse to an object (not a string — catches double-serialization)
    const parsedArgs = JSON.parse(rawArguments) as unknown;
    expect(typeof parsedArgs).toBe('object');
    expect(parsedArgs).toEqual({ location: 'Paris' });

    // Step 3 — Bug #1 detector: tool result message must use tool_call_id (not tool_calls)
    const toolResultMessage = secondMessages.find((m) => m.role === 'tool');
    if (!toolResultMessage) throw new Error('expected tool result message to be present');
    expect(toolResultMessage.tool_call_id).toBe('call_fixture_get_weather');
    expect(toolResultMessage.tool_calls).toBeUndefined();
    // content must be a JSON string that parses to the fixture tool result object
    expect(typeof toolResultMessage.content).toBe('string');
    const parsedContent = JSON.parse(toolResultMessage.content as string) as unknown;
    expect(typeof parsedContent).toBe('object');
    expect(parsedContent).toEqual(toolResult);

    // Step 4: final result is the content from response-2-final.json
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe("It's currently 22°C and sunny in Paris.");
    }
  });
});
