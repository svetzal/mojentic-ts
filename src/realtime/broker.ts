/**
 * Realtime voice broker — sibling to {@link LlmBroker} for duplex
 * voice + tool sessions.
 */

import { randomUUID } from 'crypto';
import { Err, Ok, Result, isOk } from '../error';
import { ParallelToolRunner, ToolRunner } from '../llm/tools';
import { TracerSystem } from '../tracer';
import { RealtimeVoiceConfig } from './config';
import { RealtimeVoiceGateway } from './gateway';
import { RealtimeSession } from './session';

/**
 * Connect-time overrides for a single session. Anything omitted falls back
 * to the broker-level config supplied at construction.
 */
export type RealtimeSessionOverrides = Partial<RealtimeVoiceConfig>;

/**
 * Long-lived broker that opens duplex realtime sessions against a gateway.
 *
 * The broker itself holds no session state — it is reusable across many
 * concurrent sessions. The {@link RealtimeSession} returned by
 * {@link connect} owns the socket lifetime.
 */
export class RealtimeVoiceBroker {
  constructor(
    private readonly model: string,
    private readonly gateway: RealtimeVoiceGateway,
    private readonly config: RealtimeVoiceConfig = {},
    private readonly tracer?: TracerSystem,
    private readonly toolRunner: ToolRunner = new ParallelToolRunner()
  ) {}

  /**
   * Open a new realtime session.
   *
   * The session is fully initialised (initial `session.update` sent) before
   * resolving so callers can immediately pipe audio or send text.
   */
  async connect(overrides: RealtimeSessionOverrides = {}): Promise<Result<RealtimeSession, Error>> {
    const merged: RealtimeVoiceConfig = {
      ...this.config,
      ...overrides,
      tools: overrides.tools ?? this.config.tools,
      providerExtras: {
        ...(this.config.providerExtras ?? {}),
        ...(overrides.providerExtras ?? {}),
      },
    };
    const correlationId = randomUUID();

    const gatewayResult = await this.gateway.open(this.model, merged, correlationId);
    if (!isOk(gatewayResult)) {
      return Err(gatewayResult.error);
    }

    const session = new RealtimeSession(gatewayResult.value, {
      config: merged,
      toolRunner: this.toolRunner,
      tracer: this.tracer,
      correlationId,
    });
    const initResult = await session.initialise();
    if (!isOk(initResult)) {
      await session.close();
      return Err(initResult.error);
    }

    return Ok(session);
  }

  getModel(): string {
    return this.model;
  }

  getGateway(): RealtimeVoiceGateway {
    return this.gateway;
  }
}
