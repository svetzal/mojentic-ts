/**
 * Realtime voice gateway interface.
 *
 * Sibling to {@link LlmGateway}: where the chat-completions gateway exposes
 * a request/response surface, this one exposes a duplex session.
 */

import { Result } from '../error';
import { RealtimeVoiceConfig } from './config';

/**
 * Client → Server event envelope. The gateway forwards verbatim; vendor-
 * neutral translation happens in {@link RealtimeVoiceBroker}.
 */
export interface ClientRealtimeEvent {
  /** Vendor-specific event type (e.g. `session.update`, `response.create`). */
  type: string;
  [k: string]: unknown;
}

/**
 * Server → Client event envelope. The gateway parses bytes to JSON and
 * runs them through a Zod boundary check before yielding.
 */
export interface ServerRealtimeEvent {
  type: string;
  [k: string]: unknown;
}

/**
 * Live duplex session opened by a {@link RealtimeVoiceGateway}.
 *
 * `events()` yields server events in arrival order, terminating when the
 * session closes. `sendEvent` queues a client event. `close` is idempotent.
 */
export interface RealtimeGatewaySession {
  readonly sessionId: string;
  sendEvent(event: ClientRealtimeEvent): Promise<Result<void, Error>>;
  events(): AsyncGenerator<ServerRealtimeEvent>;
  close(): Promise<void>;
  isClosed(): boolean;
}

/**
 * Open duplex realtime sessions against a provider.
 *
 * Implementations are intentionally thin: own the transport, validate
 * events at the boundary, do no orchestration.
 */
export interface RealtimeVoiceGateway {
  open(
    model: string,
    config: RealtimeVoiceConfig,
    correlationId?: string
  ): Promise<Result<RealtimeGatewaySession, Error>>;
}
