import * as api from '../index';
import {
  contractIdentity,
  verifyContinuation,
  verifyInterrupted,
  verifyControls,
  verifyOpenAIExclusion,
} from '../../scripts/reasoning-history-contract.cjs';

describe('ts-native-reasoning-history-v1', () => {
  beforeAll(() => {
    console.log('Source contract identity:', JSON.stringify(contractIdentity()));
  });
  describe.each(['ollama', 'omlx'] as const)('%s HTTP history', (provider) => {
    describe.each([false, true])('recovery=%s', (recovery) => {
      describe.each([false, true])('stream=%s', (stream) => {
        describe.each([false, true])('retain=%s', (retain) => {
          it.each(['success', 'failure'] as const)(
            'preserves exact completed turns through later %s',
            async (ending) => {
              await verifyContinuation(api, { provider, recovery, stream, retain, ending });
            }
          );
        });
      });
      it.each([false, true])(
        'does not fabricate native history from interrupted streams cancel=%s',
        async (cancel) => {
          await verifyInterrupted(api, { provider, recovery, cancel });
        }
      );
      it('does not store native history after a malformed stream frame', async () => {
        await verifyInterrupted(api, { provider, recovery, ending: 'error' });
      });
      it.each([false, true])(
        'resends exact native history after admission stream=%s',
        async (stream) => {
          await verifyContinuation(api, {
            provider,
            recovery: true,
            stream,
            retain: true,
            ending: 'retry',
          });
        }
      );
      it.each([false, true])('keeps absent native reasoning absent stream=%s', async (stream) => {
        await verifyContinuation(api, { provider, recovery, stream, retain: true, native: false });
      });
      it('applies history controls to structured requests', async () => {
        await verifyControls(api, { provider, recovery, route: 'structured' });
      });
    });
  });
  it.each([false, true])(
    'requires successful oMLX tool finish before DONE recovery=%s',
    async (recovery) => {
      await verifyInterrupted(api, { provider: 'omlx', recovery, ending: 'marker' });
    }
  );
  describe.each(['ollama', 'omlx', 'openai'] as const)('%s rejection', (provider) => {
    describe.each([false, true])('recovery=%s', (recovery) => {
      it.each(['ordinary', 'structured', 'stream', 'events'] as const)(
        'rejects unsupported history before %s HTTP',
        async (route) => {
          await verifyControls(api, {
            provider,
            recovery,
            route,
            unsupported: provider !== 'openai',
          });
        }
      );
    });
  });
  it.each([false, true])(
    'excludes native history from OpenAI with recovery=%s',
    async (recovery) => {
      await verifyOpenAIExclusion(api, recovery);
    }
  );
});
