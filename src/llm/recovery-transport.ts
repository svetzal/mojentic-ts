import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

/** Raw HTTP status, headers, and body stream for recovery accounting. */
export interface CompletionTransportResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly body: ReadableStream<Uint8Array>;
}

/** One POST per call: Node HTTP performs neither status retries nor redirects. */
export class CompletionTransportGateway {
  /** Sends the encoded payload once; rejects on URL, connection, or abort errors. */
  send(
    url: string,
    headers: Headers | Record<string, string>,
    body: string,
    signal: AbortSignal
  ): Promise<CompletionTransportResponse> {
    return new Promise((resolve, reject) => {
      const endpoint = new URL(url);
      const request = endpoint.protocol === 'https:' ? httpsRequest : httpRequest;
      const outgoing = request(
        endpoint,
        {
          method: 'POST',
          headers: Object.fromEntries(new Headers(headers)),
          signal,
          agent: false,
        },
        (incoming) => {
          const responseHeaders = new Headers();
          for (const [index, name] of incoming.rawHeaders.entries()) {
            if (index % 2 === 0) {
              responseHeaders.append(name, incoming.rawHeaders.at(index + 1) ?? '');
            }
          }
          const status = incoming.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: responseHeaders,
            body: Readable.toWeb(incoming),
          });
        }
      );
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  }
}
