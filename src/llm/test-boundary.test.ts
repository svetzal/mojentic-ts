import { Socket, createServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { lookup, resolveTxt } from 'node:dns';
import { OllamaGateway } from './gateways/ollama';
import { Message } from './models';

it('rejects socket, listener and DNS access before reaching a service', () => {
  expect(() => new Socket().connect(443, 'example.com')).toThrow(
    'Network/service access is forbidden'
  );
  expect(() => createServer().listen(0)).toThrow('Network/service access is forbidden');
  expect(() => lookup('example.com', () => {})).toThrow('Network/service access is forbidden');
  expect(() => resolveTxt('example.com', () => {})).toThrow('Network/service access is forbidden');
  expect(() => createSocket('udp4')).toThrow('Network/service access is forbidden');
});

it('returns a caller-visible failure for an unconfigured transport destination', async () => {
  const result = await new OllamaGateway('https://unexpected.example').generate('model', [
    Message.user('unexpected service access must fail'),
  ]);

  expect(result).toMatchObject({
    ok: false,
    error: {
      code: 'GATEWAY_ERROR',
      message:
        'Failed to generate completion: Unexpected transport destination: https://unexpected.example/api/chat',
    },
  });
});
