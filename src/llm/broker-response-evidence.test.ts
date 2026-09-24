/**
 * Tests that the broker records provider evidence in LLM response trace events.
 */

import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { GatewayResponse, Message } from './models';
import { Ok, Result } from '../error';
import { LLMResponseTracerEvent, TracerSystem } from '../tracer';

const reportedUsage = { promptTokens: 12, completionTokens: 7, totalTokens: 19 };
const reportedMetadata = { id: 'chatcmpl-9', system_fingerprint: 'fp_1' };

function gatewayReturning(response: GatewayResponse): LlmGateway {
  return {
    generate: async (): Promise<Result<GatewayResponse, Error>> => Ok(response),
    generateStream: jest.fn(),
    listModels: async () => Ok([]),
    calculateEmbeddings: async () => Ok([]),
  };
}

function onlyResponseEvent(tracer: TracerSystem): LLMResponseTracerEvent {
  const events = tracer
    .getEvents()
    .filter((event): event is LLMResponseTracerEvent => event instanceof LLMResponseTracerEvent);
  expect(events).toHaveLength(1);
  return events[0];
}

describe('LlmBroker response evidence in traces', () => {
  let tracer: TracerSystem;

  beforeEach(() => {
    tracer = new TracerSystem();
  });

  it('should record gateway-reported usage, provider model, finish reason and metadata unchanged', async () => {
    const broker = new LlmBroker(
      'configured-model',
      gatewayReturning({
        content: 'Hi',
        finishReason: 'length',
        usage: reportedUsage,
        model: 'provider-model-2026',
        metadata: reportedMetadata,
      }),
      tracer
    );

    await broker.generateResponse([Message.user('Hello')]);

    const event = onlyResponseEvent(tracer);
    expect(event).toMatchObject({
      model: 'configured-model',
      usage: reportedUsage,
      providerModel: 'provider-model-2026',
      finishReason: 'length',
      metadata: reportedMetadata,
    });
  });

  it('should record null evidence when the gateway reports none', async () => {
    const broker = new LlmBroker('configured-model', gatewayReturning({ content: 'Hi' }), tracer);

    await broker.generate([Message.user('Hello')]);

    const event = onlyResponseEvent(tracer);
    expect(event).toMatchObject({
      usage: null,
      providerModel: null,
      finishReason: null,
      metadata: null,
    });
  });

  it('should record evidence for structured responses', async () => {
    const broker = new LlmBroker(
      'configured-model',
      gatewayReturning({
        content: '{"ok":true}',
        finishReason: 'stop',
        usage: reportedUsage,
        model: 'provider-model-2026',
      }),
      tracer
    );

    await broker.generateObject([Message.user('Hello')], { type: 'object' });

    expect(onlyResponseEvent(tracer)).toMatchObject({
      usage: reportedUsage,
      providerModel: 'provider-model-2026',
      finishReason: 'stop',
    });
  });
});
