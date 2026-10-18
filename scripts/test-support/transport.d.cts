import type { IncomingMessage, ServerResponse } from 'node:http';
export interface Endpoint {
  activate(port: number, host: string, ready: () => void): void;
  address(): { readonly port: number };
  closeAllConnections(): void;
  close(done: () => void): void;
}
export function createEndpoint(
  handler?: (request: IncomingMessage, response: ServerResponse) => void
): Endpoint;
export function dispatch(url: string, options?: RequestInit): Promise<Response>;
export function install(transport: unknown): void;
