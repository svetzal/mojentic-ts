/**
 * OpenAI Realtime API gateway.
 *
 * Owns the WebSocket, validates server events at the boundary using Zod
 * schemas, and forwards client events verbatim. No tool orchestration,
 * no audio decoding — those live in the broker.
 */

import { randomUUID } from 'crypto';
import { Err, Ok, Result } from '../error';
import { RealtimeVoiceConfig } from './config';
import {
  ClientRealtimeEvent,
  RealtimeGatewaySession,
  RealtimeVoiceGateway,
  ServerRealtimeEvent,
} from './gateway';
import { parseServerEvent } from './schemas';
import { RealtimeTransport, WebSocketTransport } from './transport';

const DEFAULT_OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

/**
 * Options for the OpenAI realtime gateway.
 */
export interface OpenAIRealtimeGatewayOptions {
  /** API key. Defaults to `process.env.OPENAI_API_KEY`. */
  apiKey?: string;
  /** Override the realtime endpoint (e.g. for proxies, regions, beta hosts). */
  baseUrl?: string;
  /**
   * Build the transport for a given URL. Defaults to {@link WebSocketTransport}.
   * Exposed for tests to inject a scripted in-memory transport.
   */
  transportFactory?: (
    url: string,
    headers: Record<string, string>,
    protocols: string[]
  ) => RealtimeTransport;
}

interface PendingResolver {
  resolve: (event: ServerRealtimeEvent | typeof EOS) => void;
}

const EOS = Symbol('realtime-eos');

class OpenAIRealtimeSession implements RealtimeGatewaySession {
  readonly sessionId: string;
  private closed = false;
  private readonly queue: ServerRealtimeEvent[] = [];
  private readonly waiters: PendingResolver[] = [];

  constructor(
    sessionId: string,
    private readonly transport: RealtimeTransport
  ) {
    this.sessionId = sessionId;
  }

  enqueue(event: ServerRealtimeEvent): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter.resolve(event);
    } else {
      this.queue.push(event);
    }
  }

  signalEnd(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      waiter?.resolve(EOS);
    }
  }

  async sendEvent(event: ClientRealtimeEvent): Promise<Result<void, Error>> {
    if (this.closed) {
      return Err(new Error('Session is closed'));
    }
    return this.transport.send(event);
  }

  async *events(): AsyncGenerator<ServerRealtimeEvent> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift() as ServerRealtimeEvent;
        continue;
      }
      if (this.closed) {
        return;
      }
      const next = await new Promise<ServerRealtimeEvent | typeof EOS>((resolve) => {
        this.waiters.push({ resolve });
      });
      if (next === EOS) {
        return;
      }
      yield next;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.transport.close();
    this.signalEnd();
  }

  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * Gateway against OpenAI's Realtime API.
 *
 * Each `open()` call provisions a new WebSocket and a fresh session id.
 * The returned {@link RealtimeGatewaySession} is the only stateful surface.
 */
export class OpenAIRealtimeGateway implements RealtimeVoiceGateway {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly transportFactory: (
    url: string,
    headers: Record<string, string>,
    protocols: string[]
  ) => RealtimeTransport;

  constructor(options: OpenAIRealtimeGatewayOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAIRealtimeGateway requires an apiKey (or OPENAI_API_KEY env var).');
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_OPENAI_REALTIME_URL;
    this.transportFactory =
      options.transportFactory ??
      ((url, headers, protocols) => new WebSocketTransport(url, { headers, protocols }));
  }

  async open(
    model: string,
    _config: RealtimeVoiceConfig,
    correlationId?: string
  ): Promise<Result<RealtimeGatewaySession, Error>> {
    const url = `${this.baseUrl}?model=${encodeURIComponent(model)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (correlationId) {
      headers['X-Correlation-Id'] = correlationId;
    }

    // OpenAI also accepts auth via WebSocket subprotocols, which is the only
    // option for environments where the WebSocket constructor doesn't allow
    // custom headers (e.g. Node's built-in global `WebSocket`). Sending both
    // is safe — the `ws` package picks up the headers, the global picks up
    // the protocols.
    const protocols = ['realtime', `openai-insecure-api-key.${this.apiKey}`];

    const transport = this.transportFactory(url, headers, protocols);
    const sessionId = randomUUID();
    const session = new OpenAIRealtimeSession(sessionId, transport);

    const connectResult = await transport.connect({
      onOpen: () => {
        /* no-op — session is usable as soon as connect resolves */
      },
      onMessage: (data) => {
        try {
          const raw: unknown = JSON.parse(data);
          const parsed = parseServerEvent(raw) as ServerRealtimeEvent;
          session.enqueue(parsed);
        } catch (err) {
          session.enqueue({
            type: 'error',
            error: {
              type: 'parse_error',
              message: err instanceof Error ? err.message : String(err),
            },
          });
        }
      },
      onClose: () => {
        session.signalEnd();
      },
      onError: (err) => {
        session.enqueue({
          type: 'error',
          error: { type: 'transport_error', message: err.message },
        });
      },
    });

    if (!connectResult.ok) {
      return Err(connectResult.error);
    }
    return Ok(session);
  }
}
