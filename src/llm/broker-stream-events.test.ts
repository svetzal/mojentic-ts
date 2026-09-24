/**
 * Tests for LlmBroker.generateStreamEvents, the single-turn streaming API.
 */

import { LlmBroker } from './broker';
import { LlmGateway } from './gateway';
import { CompletionConfig, LlmMessage, Message } from './models';
import { LlmStreamEvent, StreamEventError } from './stream-events';
import { Ok } from '../error';
import { LLMCallTracerEvent, LLMResponseTracerEvent, TracerSystem } from '../tracer';

const reportedUsage = { promptTokens: 9, completionTokens: 2, totalTokens: 11 };

interface ScriptedGateway extends LlmGateway {
  readonly calls: Array<{ model: string; config?: CompletionConfig; signal?: AbortSignal }>;
  readonly wasClosed: () => boolean;
}

/** A gateway whose event stream plays back a script, then waits forever if `hold` is set. */
function scriptedGateway(script: LlmStreamEvent[], options: { hold: boolean } = { hold: false }) {
  const calls: ScriptedGateway['calls'] = [];
  let closed = false;
  const gateway: ScriptedGateway = {
    calls,
    wasClosed: () => closed,
    generate: jest.fn(),
    generateStream: jest.fn(),
    listModels: async () => Ok([]),
    calculateEmbeddings: async () => Ok([]),
    generateStreamEvents: async function* (
      model: string,
      _messages: LlmMessage[],
      config?: CompletionConfig,
      signal?: AbortSignal
    ): AsyncGenerator<LlmStreamEvent> {
      calls.push({ model, config, signal });
      try {
        yield* script;
        if (options.hold) await new Promise(() => undefined);
      } finally {
        closed = true;
      }
    },
  };
  return gateway;
}

async function collect(iterable: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

function responseEvents(tracer: TracerSystem): LLMResponseTracerEvent[] {
  return tracer
    .getEvents()
    .filter((event): event is LLMResponseTracerEvent => event instanceof LLMResponseTracerEvent);
}

const completed: LlmStreamEvent = {
  type: 'completed',
  metadata: {
    finishReason: 'stop',
    usage: reportedUsage,
    providerModel: 'provider-model',
    metadata: { total_duration: 900 },
  },
};

describe('LlmBroker.generateStreamEvents', () => {
  let tracer: TracerSystem;

  beforeEach(() => {
    tracer = new TracerSystem();
  });

  it('should pass the gateway events through in order', async () => {
    const script: LlmStreamEvent[] = [
      { type: 'content', text: 'Hel' },
      { type: 'content', text: 'lo' },
      completed,
    ];
    const broker = new LlmBroker('configured-model', scriptedGateway(script));

    const events = await collect(broker.generateStreamEvents([Message.user('Hi')]));

    expect(events).toEqual(script);
  });

  it('should force zero tool iterations on the gateway request', async () => {
    const gateway = scriptedGateway([completed]);
    const broker = new LlmBroker('configured-model', gateway);

    await collect(
      broker.generateStreamEvents([Message.user('Hi')], { temperature: 0.2, maxToolIterations: 5 })
    );

    expect(gateway.calls).toEqual([
      {
        model: 'configured-model',
        config: { temperature: 0.2, maxToolIterations: 0 },
        signal: undefined,
      },
    ]);
  });

  it('should hand the caller signal to the gateway', async () => {
    const gateway = scriptedGateway([completed]);
    const broker = new LlmBroker('configured-model', gateway);
    const controller = new AbortController();

    await collect(
      broker.generateStreamEvents([Message.user('Hi')], undefined, { signal: controller.signal })
    );

    expect(gateway.calls[0].signal).toBe(controller.signal);
  });

  it('should fail with stream-events-unsupported without a request when the gateway lacks the API', async () => {
    const gateway: LlmGateway = {
      generate: jest.fn(),
      generateStream: jest.fn(),
      listModels: jest.fn(),
      calculateEmbeddings: jest.fn(),
    };
    const broker = new LlmBroker('configured-model', gateway, tracer);

    const events = await collect(broker.generateStreamEvents([Message.user('Hi')]));

    expect(events).toEqual([
      {
        type: 'error',
        error: expect.objectContaining({ reason: 'stream_events_unsupported' }),
      },
    ]);
    expect(gateway.generate).not.toHaveBeenCalled();
    expect(gateway.generateStream).not.toHaveBeenCalled();
    expect(tracer.getEvents()).toHaveLength(0);
  });

  it('should close the gateway stream when the consumer stops early', async () => {
    const gateway = scriptedGateway([{ type: 'content', text: 'Hi' }], { hold: true });
    const broker = new LlmBroker('configured-model', gateway);

    for await (const event of broker.generateStreamEvents([Message.user('Hi')])) {
      expect(event.type).toBe('content');
      break;
    }

    expect(gateway.wasClosed()).toBe(true);
  });

  it('should end with an incomplete stream error when the gateway stops without a terminal event', async () => {
    const broker = new LlmBroker(
      'configured-model',
      scriptedGateway([{ type: 'content', text: 'Hi' }])
    );

    const events = await collect(broker.generateStreamEvents([Message.user('Hi')]));

    expect(events[events.length - 1]).toEqual({
      type: 'error',
      error: expect.objectContaining({ reason: 'incomplete_stream' }),
    });
  });

  it('should record the call and the completed response with reported usage', async () => {
    const broker = new LlmBroker(
      'configured-model',
      scriptedGateway([{ type: 'content', text: 'Hello' }, completed]),
      tracer
    );

    await collect(
      broker.generateStreamEvents([Message.user('Hi')], undefined, { correlationId: 'corr-1' })
    );

    expect(tracer.getEvents().map((event) => event.constructor)).toEqual([
      LLMCallTracerEvent,
      LLMResponseTracerEvent,
    ]);
    expect(responseEvents(tracer)[0]).toMatchObject({
      correlationId: 'corr-1',
      model: 'configured-model',
      content: 'Hello',
      usage: reportedUsage,
      providerModel: 'provider-model',
      finishReason: 'stop',
      metadata: { total_duration: 900 },
    });
  });

  it('should record the content so far and the evidence when the stream fails', async () => {
    const failure = new StreamEventError('incomplete_completion', 'Completion ended early', {
      evidence: {
        finishReason: 'length',
        usage: reportedUsage,
        providerModel: 'provider-model',
        metadata: { eval_duration: 600 },
      },
    });
    const broker = new LlmBroker(
      'configured-model',
      scriptedGateway([
        { type: 'content', text: '{"partial":' },
        { type: 'error', error: failure },
      ]),
      tracer
    );

    await collect(broker.generateStreamEvents([Message.user('Hi')]));

    expect(responseEvents(tracer)[0]).toMatchObject({
      content: '{"partial":',
      usage: reportedUsage,
      providerModel: 'provider-model',
      finishReason: 'length',
      metadata: { eval_duration: 600 },
    });
  });

  it('should record null usage when the provider reported none', async () => {
    const broker = new LlmBroker(
      'configured-model',
      scriptedGateway([
        {
          type: 'completed',
          metadata: { finishReason: 'stop', usage: null, providerModel: null, metadata: null },
        },
      ]),
      tracer
    );

    await collect(broker.generateStreamEvents([Message.user('Hi')]));

    expect(responseEvents(tracer)[0].usage).toBeNull();
  });
});
