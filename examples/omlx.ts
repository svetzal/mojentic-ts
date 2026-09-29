/**
 * One chat turn against a local oMLX server.
 *
 * The gateway reads OMLX_HOST (default http://localhost:8000) and OMLX_API_KEY (optional).
 * Set OMLX_MODEL to choose a model; otherwise the first model the server lists is used.
 *
 *   OMLX_HOST=http://localhost:8000 npm run example:omlx
 */

import { Message, OMLXGateway } from '../src';
import { isErr } from '../src/error';

async function chooseModel(gateway: OMLXGateway): Promise<string> {
  if (process.env.OMLX_MODEL) return process.env.OMLX_MODEL;

  const models = await gateway.listModels();
  if (isErr(models)) throw models.error;
  if (models.value.length === 0) throw new Error('The oMLX server lists no models');
  return models.value[0];
}

async function main(): Promise<void> {
  const gateway = new OMLXGateway();
  const model = await chooseModel(gateway);
  console.log(`Model: ${model}\n`);

  const result = await gateway.generate(model, [
    Message.user('In one sentence, what is Apple Silicon unified memory?'),
  ]);
  if (isErr(result)) throw result.error;

  const response = result.value;
  if (response.thinking) {
    console.log(`Thinking:\n${response.thinking}\n`);
  }
  console.log(`Answer:\n${response.content}\n`);
  console.log(`Finish reason: ${response.finishReason ?? '(not reported)'}`);
  if (response.finishReason !== 'stop') {
    console.log('The reply is incomplete, so the content above is not an answer.');
  }
  console.log('Usage as oMLX reported it:', response.metadata?.usage ?? '(not reported)');
}

main().catch((error: unknown) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
