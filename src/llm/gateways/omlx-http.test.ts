/**
 * OMLXGateway over real HTTP: the real fetch against a local server, not a mock of fetch.
 *
 * The mocked tests in omlx.test.ts hand the gateway Response objects built in the test. These
 * tests check that the same fixtures parse when they arrive over a socket with real headers.
 */

import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as path from 'path';
import { OMLXGateway } from './omlx';
import { Message } from '../models';
import { LlmStreamEvent } from '../stream-events';
import { Result, isOk } from '../../error';

const MODEL = 'Qwen3.8-27B-MLX-8bit';
const WARNING = '199 omlx "json_schema grammar unavailable; enforced by prompt instructions"';
const fixturesDir = path.join(__dirname, '__fixtures__', 'omlx');

function fixture(name: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixturesDir is derived from __dirname (not user input); name is a string literal at each call site
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

interface Reply {
  readonly status?: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

interface ReceivedRequest {
  readonly method?: string;
  readonly url?: string;
  readonly authorization?: string;
}

function unwrap<T>(result: Result<T, Error>): T {
  if (!isOk(result)) throw result.error;
  return result.value;
}

describe('OMLXGateway over real HTTP', () => {
  const replies = new Map<string, Reply>();
  const received: ReceivedRequest[] = [];
  let server: http.Server;
  let host: string;

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      received.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
      });
      const reply = replies.get(`${request.method} ${request.url}`);
      request.resume();
      request.on('end', () => {
        response.writeHead(reply === undefined ? 404 : (reply.status ?? 200), reply?.headers ?? {});
        response.end(reply?.body ?? '');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    replies.clear();
    received.length = 0;
  });

  it('should parse the models list from a JSON response', async () => {
    replies.set('GET /v1/models', {
      headers: { 'Content-Type': 'application/json' },
      body: fixture('models.json'),
    });

    const models = unwrap(await new OMLXGateway(host, 'local-key').listModels());

    expect(models).toEqual([MODEL]);
    expect(received).toEqual([
      { method: 'GET', url: '/v1/models', authorization: 'Bearer local-key' },
    ]);
  });

  it('should parse a chat completion and read the Warning header from the socket', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    replies.set('POST /v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', Warning: WARNING },
      body: fixture('chat_json_schema.json'),
    });

    const response = unwrap(
      await new OMLXGateway(host).generate(MODEL, [Message.user('Ada, 36')], {
        responseFormat: { type: 'json_object', schema: { type: 'object' } },
      })
    );

    expect(JSON.parse(response.content)).toEqual({ name: 'Ada', age: 36 });
    expect(response.metadata?.response_format_warning).toBe(WARNING);
  });

  it('should report a JSON error response as a provider error carrying the body', async () => {
    replies.set(`POST /v1/models/${MODEL}/unload`, {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: fixture('error_model_not_loaded.json'),
    });

    const result = await new OMLXGateway(host).unloadModel(MODEL);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        statusCode: 400,
        body: fixture('error_model_not_loaded.json'),
      }),
    });
  });

  it('should stream events from a server-sent event response', async () => {
    replies.set('POST /v1/chat/completions', {
      headers: { 'Content-Type': 'text/event-stream' },
      body: fixture('stream_thinking.sse'),
    });

    const events: LlmStreamEvent[] = [];
    for await (const event of new OMLXGateway(host).generateStreamEvents(MODEL, [
      Message.user('hi'),
    ])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'content', text: '\n\nhello' },
      expect.objectContaining({
        type: 'completed',
        metadata: expect.objectContaining({ finishReason: 'stop', providerModel: MODEL }),
      }),
    ]);
  });
});
