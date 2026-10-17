import * as http from 'http';
import { AddressInfo } from 'net';
import { OMLXGateway } from './omlx';
import { OllamaGateway } from './ollama';
import { OpenAIGateway } from './openai';
import { LlmGateway } from '../gateway';
import { getModelContextWindow } from '../model-context';
import showContext from './__fixtures__/ollama/show_context_length.json';
import showParameter from './__fixtures__/ollama/show_num_ctx_parameter.json';
import unknownModel from './__fixtures__/ollama/error_model_not_found.json';
import chat from './__fixtures__/omlx/chat_thinking.json';
import { Message } from '../models';
import models from './__fixtures__/omlx/models.json';

interface RequestRecord {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly authorization: string | undefined;
  readonly body: string;
}

describe('model context metadata over HTTP', () => {
  let server: http.Server;
  let host: string;
  let body: string;
  let status: number;
  const received: RequestRecord[] = [];

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      let requestBody = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        requestBody += chunk;
      });
      request.on('end', () => {
        received.push({
          method: request.method,
          url: request.url,
          authorization: request.headers.authorization,
          body: requestBody,
        });
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    received.length = 0;
    status = 200;
    body = JSON.stringify(models);
  });

  it('characterizes existing Ollama completion request bytes', async () => {
    body = JSON.stringify({ message: { role: 'assistant', content: 'ok' }, done: true });

    const result = await new OllamaGateway(host).generate('qwen', [Message.user('hi')], {
      temperature: 0,
      maxTokens: 17,
      numCtx: 4096,
    });

    expect(result.ok).toBe(true);
    expect(received).toEqual([
      {
        method: 'POST',
        url: '/api/chat',
        authorization: undefined,
        body: '{"model":"qwen","messages":[{"role":"user","content":"hi"}],"options":{"temperature":0,"num_predict":17,"num_ctx":4096},"stream":false}',
      },
    ]);
  });

  it('queries the configured authenticated oMLX endpoint for exact model provenance', async () => {
    const gateway = new OMLXGateway(host, 'metadata-key');

    const result = await gateway.getModelContextWindow('Qwen3.8-27B-MLX-8bit');

    expect(result).toEqual({
      ok: true,
      value: { maxContextTokens: 262144, field: 'max_model_len' },
    });
    expect(received).toEqual([
      { method: 'GET', url: '/v1/models', authorization: 'Bearer metadata-key', body: '' },
    ]);
  });
  it.each([
    [
      'qwen3.8:27b-mlx',
      showContext,
      { maxContextTokens: 262144, field: 'model_info.qwen3_5.context_length' },
    ],
    [
      'qwen3.8-flash-next:125b-mlx',
      showParameter,
      {
        maxContextTokens: 262144,
        field: 'model_info.qwen4_exp.context_length',
        modelNumCtx: 262144,
      },
    ],
  ])(
    'reads captured Ollama architecture and model parameters for %s',
    async (model, capture, expected) => {
      body = JSON.stringify(capture);

      const result = await new OllamaGateway(host).getModelContextWindow(model);

      expect(result).toEqual({ ok: true, value: expected });
      expect(received).toEqual([
        {
          method: 'POST',
          url: '/api/show',
          authorization: undefined,
          body: JSON.stringify({ model }),
        },
      ]);
    }
  );

  it.each([
    { data: [] },
    { data: [{ id: 'another', max_model_len: 7 }] },
    { data: [{ id: 'wanted' }] },
  ])('returns not advertised for missing oMLX entry or field %j', async (capture) => {
    body = JSON.stringify(capture);

    expect(await new OMLXGateway(host).getModelContextWindow('wanted')).toEqual({
      ok: true,
      value: null,
    });
  });

  it.each([{}, { model_info: {} }, { model_info: { 'general.context': 8 } }])(
    'returns not advertised for absent Ollama context %j',
    async (capture) => {
      body = JSON.stringify(capture);

      expect(await new OllamaGateway(host).getModelContextWindow('wanted')).toEqual({
        ok: true,
        value: null,
      });
    }
  );

  it.each([0, -1, 1.5, '262144', null, true, {}, []])(
    'rejects malformed oMLX window %j',
    async (value) => {
      body = JSON.stringify({ data: [{ id: 'wanted', max_model_len: value }] });

      expect(await new OMLXGateway(host).getModelContextWindow('wanted')).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
      });
    }
  );

  it.each([0, -1, 1.5, '262144', null, true, {}, []])(
    'rejects malformed Ollama window %j',
    async (value) => {
      body = JSON.stringify({ model_info: { 'other.context_length': value } });

      expect(await new OllamaGateway(host).getModelContextWindow('wanted')).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
      });
    }
  );

  it.each(['num_ctx 0', 'num_ctx -2', 'num_ctx 1.5', 'num_ctx nope', 'num_ctx', 'num_ctx 4 extra'])(
    'rejects malformed model parameter %s',
    async (parameters) => {
      body = JSON.stringify({ model_info: { 'arch.context_length': 16 }, parameters });

      expect(await new OllamaGateway(host).getModelContextWindow('wanted')).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
      });
    }
  );

  it('ignores num_ctx substrings in other Ollama parameter names', async () => {
    body = JSON.stringify({
      model_info: { 'arch.context_length': 16 },
      parameters: 'other_num_ctx 2\n  num_ctx 8\n',
    });

    expect(await new OllamaGateway(host).getModelContextWindow('wanted')).toEqual({
      ok: true,
      value: { maxContextTokens: 16, modelNumCtx: 8, field: 'model_info.arch.context_length' },
    });
  });

  const providers = [
    ['Ollama', (url: string): LlmGateway => new OllamaGateway(url)],
    ['oMLX', (url: string): LlmGateway => new OMLXGateway(url, 'key')],
  ] as const;

  describe.each(providers)('%s failure outcomes', (_name, makeGateway) => {
    it.each(['not json', 'null', '[]', '"text"'])(
      'rejects malformed response body %s',
      async (malformed) => {
        body = malformed;

        expect(await getModelContextWindow(makeGateway(host), 'wanted')).toEqual({
          ok: false,
          error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
        });
      }
    );

    it.each([401, 404, 500, 503])(
      'retains HTTP failure status %i and body',
      async (failureStatus) => {
        status = failureStatus;
        body = JSON.stringify(unknownModel);

        expect(await getModelContextWindow(makeGateway(host), 'no-such-model:1b')).toEqual({
          ok: false,
          error: expect.objectContaining({ statusCode: failureStatus, body }),
        });
      }
    );

    it('returns a Result error for transport failure', async () => {
      const offline = http.createServer();
      await new Promise<void>((resolve) => offline.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${(offline.address() as AddressInfo).port}`;
      await new Promise<void>((resolve) => offline.close(() => resolve()));

      expect(await getModelContextWindow(makeGateway(url), 'wanted')).toEqual({
        ok: false,
        error: expect.objectContaining({ code: 'GATEWAY_ERROR' }),
      });
    });
  });

  it.each(['{"model_info":null}', '{"model_info":[]}', '{"parameters":4}'])(
    'rejects malformed Ollama envelope %s',
    async (malformed) => {
      body = malformed;

      expect((await new OllamaGateway(host).getModelContextWindow('wanted')).ok).toBe(false);
    }
  );

  it.each(['{}', '{"data":{}}', '{"data":[{}]}'])(
    'rejects malformed oMLX envelope %s',
    async (malformed) => {
      body = malformed;

      expect((await new OMLXGateway(host).getModelContextWindow('wanted')).ok).toBe(false);
    }
  );

  it('preserves oMLX listModels behavior on the shared endpoint', async () => {
    const gateway = new OMLXGateway(host, 'key');

    await gateway.getModelContextWindow('Qwen3.8-27B-MLX-8bit');

    expect(await gateway.listModels()).toEqual({ ok: true, value: ['Qwen3.8-27B-MLX-8bit'] });
    expect(received.map((request) => request.url)).toEqual(['/v1/models', '/v1/models']);
  });

  it.each([
    [
      'Ollama',
      (url: string): LlmGateway => new OllamaGateway(url),
      showParameter,
      { message: { role: 'assistant', content: 'ok' }, done: true },
      '{"model":"Qwen3.8-27B-MLX-8bit","messages":[{"role":"user","content":"hi"}],"options":{"temperature":0,"num_predict":17,"num_ctx":4096},"stream":false}',
    ],
    [
      'oMLX',
      (url: string): LlmGateway => new OMLXGateway(url, 'key'),
      models,
      chat,
      '{"model":"Qwen3.8-27B-MLX-8bit","messages":[{"role":"user","content":"hi"}],"temperature":0,"max_tokens":17}',
    ],
    [
      'OpenAI',
      (url: string): LlmGateway => new OpenAIGateway('key', url + '/v1'),
      {},
      chat,
      '{"model":"Qwen3.8-27B-MLX-8bit","messages":[{"role":"user","content":"hi"}],"temperature":0,"max_tokens":17}',
    ],
  ] as const)(
    'leaves %s completion request bytes unchanged after metadata',
    async (_name, makeGateway, metadata, completion, expected) => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const gateway = makeGateway(host);
      const config = { temperature: 0, maxTokens: 17, numCtx: 4096 };
      body = JSON.stringify(completion);
      const before = await gateway.generate('Qwen3.8-27B-MLX-8bit', [Message.user('hi')], config);
      body = JSON.stringify(metadata);

      await getModelContextWindow(gateway, 'Qwen3.8-27B-MLX-8bit');
      body = JSON.stringify(completion);
      const after = await gateway.generate('Qwen3.8-27B-MLX-8bit', [Message.user('hi')], config);

      expect([before.ok, after.ok]).toEqual([true, true]);
      expect(
        received
          .filter(
            (request) => request.url?.endsWith('/chat') || request.url?.endsWith('/completions')
          )
          .map((request) => request.body)
      ).toEqual([expected, expected]);
      expect(config).toEqual({ temperature: 0, maxTokens: 17, numCtx: 4096 });
    }
  );

  it.each(['gpt-4o', 'gpt-5-future', 'unknown'])(
    'performs no OpenAI HTTP request for registry lookup %s',
    async (model) => {
      await new OpenAIGateway('key', host + '/v1').getModelContextWindow(model);

      expect(received).toEqual([]);
    }
  );

  it('keeps inferred reasoning completion parameters after an unknown registry lookup', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const gateway = new OpenAIGateway('key', host + '/v1');
    body = JSON.stringify(chat);
    await gateway.generate('o3-future', [Message.user('hi')], { maxTokens: 17 });

    expect(await gateway.getModelContextWindow('o3-future')).toEqual({ ok: true, value: null });
    await gateway.generate('o3-future', [Message.user('hi')], { maxTokens: 17 });

    expect(received.map((request) => request.body)).toEqual([
      '{"model":"o3-future","messages":[{"role":"user","content":"hi"}],"temperature":1,"max_completion_tokens":17}',
      '{"model":"o3-future","messages":[{"role":"user","content":"hi"}],"temperature":1,"max_completion_tokens":17}',
    ]);
  });

  it('does not cache context metadata after the provider changes it', async () => {
    const gateway = new OMLXGateway(host, 'key');
    expect(await gateway.getModelContextWindow('Qwen3.8-27B-MLX-8bit')).toEqual({
      ok: true,
      value: { maxContextTokens: 262144, field: 'max_model_len' },
    });
    body = '{"data":[]}';

    expect(await gateway.getModelContextWindow('Qwen3.8-27B-MLX-8bit')).toEqual({
      ok: true,
      value: null,
    });
  });
});
