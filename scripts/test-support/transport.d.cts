/** Only the scripted in-process exchange surface; no Node server or socket API. */
import type { Readable } from 'node:stream';

export interface TransportRequest extends Readable {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
}
export interface TransportResponse {
  statusCode: number;
  setHeader(name: string, value: string | number): TransportResponse;
  writeHead(status: number, headers?: Readonly<Record<string, string | number>>): TransportResponse;
  flushHeaders(): void;
  write(chunk: string | Uint8Array): boolean;
  end(chunk?: string | Uint8Array): void;
  destroy(): void;
  on(event: 'close', listener: () => void): TransportResponse;
}
export interface Endpoint {
  activate(port: number, host: string, ready: () => void): void;
  address(): { readonly port: number };
  closeAllConnections(): void;
  close(done: () => void): void;
}
export function createEndpoint(
  handler?: (request: TransportRequest, response: TransportResponse) => void | Promise<void>
): Endpoint;
export function dispatch(url: string, options?: RequestInit): Promise<Response>;
export function install(transport: unknown): void;
