import { Err, GatewayError, Ok, Result } from '../../error';
import { ModelContextWindow } from '../model-context';

/** Convert HTTP, transport and decoding failures to the gateway's Result error idiom. */
export async function readContextWindow(
  request: () => Promise<Response>,
  decode: (body: unknown) => ModelContextWindow | null
): Promise<Result<ModelContextWindow | null, Error>> {
  try {
    const response = await request();
    if (!response.ok)
      return Err(
        new GatewayError('Context window query failed', response.status, await response.text())
      );
    return Ok(decode(await response.json()));
  } catch (error) {
    return Err(
      new GatewayError(
        `Context window query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}
