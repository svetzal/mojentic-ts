/**
 * Transport abstraction for the realtime subsystem.
 *
 * The gateway owns I/O against this interface so unit tests can replace
 * the live WebSocket with a scripted, deterministic transport.
 */

import { Result, Err, Ok } from '../error';

/**
 * Listener interface for transport events.
 *
 * Implementations call these in arrival order; the gateway demultiplexes
 * them into a normalised async iterable for callers.
 */
export interface TransportListener {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: (reason: 'client' | 'server' | 'error', err?: Error) => void;
  onError: (err: Error) => void;
}

/**
 * A duplex text-frame channel — minimal surface so providers can swap
 * WebSocket for SSE, HTTP-long-poll, in-process loopback, etc.
 */
export interface RealtimeTransport {
  /** Connect and resolve once the channel is open. */
  connect(listener: TransportListener): Promise<Result<void, Error>>;
  /** Queue a JSON-stringifiable payload as a single text frame. */
  send(payload: unknown): Promise<Result<void, Error>>;
  /** Close the channel; safe to call more than once. */
  close(): Promise<void>;
  /** True once `close` has run or the channel was closed remotely. */
  isClosed(): boolean;
}

/**
 * Globally available WebSocket type — Node 22+ exposes one and browsers
 * have always had one. We define a structural subset so the gateway works
 * across both without importing platform-specific types.
 */
interface MinimalWebSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (ev: { data: unknown }) => void): void;
  addEventListener(type: 'close', listener: (ev: { code?: number; reason?: string }) => void): void;
  addEventListener(type: 'error', listener: (ev: unknown) => void): void;
}

type WebSocketCtor = new (
  url: string,
  protocols?: string | string[],
  options?: { headers?: Record<string, string> }
) => MinimalWebSocket;

/**
 * Locate a WebSocket constructor.
 *
 * Prefers the global. Falls back to the optional `ws` package if one is
 * installed (handy for custom headers when the global on a given runtime
 * doesn't accept them).
 */
function resolveWebSocketCtor(): WebSocketCtor {
  const fromGlobal = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof fromGlobal === 'function') {
    return fromGlobal as unknown as WebSocketCtor;
  }
  throw new Error(
    'No global WebSocket available. Upgrade to Node 22.12+ or install the `ws` package.'
  );
}

/**
 * Options accepted by {@link WebSocketTransport}.
 */
export interface WebSocketTransportOptions {
  /** Optional headers to attach to the upgrade request (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Optional WebSocket subprotocols. */
  protocols?: string | string[];
  /** Override the constructor — used by tests. */
  webSocketCtor?: WebSocketCtor;
}

/**
 * Production transport — a thin wrapper over the WebSocket constructor.
 *
 * Owns base64 framing? No. The realtime protocol's audio frames are already
 * base64 strings inside JSON; framing happens above this layer. This class
 * only stringifies/parses JSON text frames.
 */
export class WebSocketTransport implements RealtimeTransport {
  private socket?: MinimalWebSocket;
  private listener?: TransportListener;
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly options: WebSocketTransportOptions = {}
  ) {}

  async connect(listener: TransportListener): Promise<Result<void, Error>> {
    if (this.socket) {
      return Err(new Error('Transport already connected'));
    }
    this.listener = listener;

    const Ctor = this.options.webSocketCtor ?? resolveWebSocketCtor();

    return await new Promise((resolve) => {
      try {
        const socket = new Ctor(this.url, this.options.protocols, {
          headers: this.options.headers,
        });
        this.socket = socket;

        socket.addEventListener('open', () => {
          listener.onOpen();
          resolve(Ok(undefined));
        });
        socket.addEventListener('message', (ev) => {
          if (typeof ev.data === 'string') {
            listener.onMessage(ev.data);
          } else if (ev.data instanceof ArrayBuffer) {
            listener.onMessage(new TextDecoder().decode(ev.data));
          }
        });
        socket.addEventListener('close', () => {
          if (this.closed) {
            listener.onClose('client');
          } else {
            this.closed = true;
            listener.onClose('server');
          }
        });
        socket.addEventListener('error', (ev) => {
          const err = ev instanceof Error ? ev : new Error('WebSocket error');
          listener.onError(err);
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        resolve(Err(error));
      }
    });
  }

  async send(payload: unknown): Promise<Result<void, Error>> {
    if (!this.socket || this.closed) {
      return Err(new Error('Transport not open'));
    }
    try {
      this.socket.send(JSON.stringify(payload));
      return Ok(undefined);
    } catch (err) {
      return Err(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket?.close();
    } catch {
      // best-effort
    }
    this.listener?.onClose('client');
  }

  isClosed(): boolean {
    return this.closed;
  }
}
