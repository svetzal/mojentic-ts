import type * as api from '../src';
interface ContinuationCase {
  provider: 'ollama' | 'omlx';
  stream: boolean;
  native?: boolean;
  retain: boolean;
  recovery: boolean;
  ending?: 'success' | 'failure' | 'retry';
}
export function verifyAll(publicApi: typeof api): Promise<void>;
export function verifyContinuation(
  publicApi: typeof api,
  testCase: ContinuationCase
): Promise<void>;
export function verifyInterrupted(
  publicApi: typeof api,
  testCase: {
    provider: 'ollama' | 'omlx';
    recovery: boolean;
    cancel?: boolean;
    ending?: 'eof' | 'error' | 'marker';
  }
): Promise<void>;
export function verifyControls(
  publicApi: typeof api,
  testCase: {
    provider: 'ollama' | 'omlx' | 'openai';
    recovery: boolean;
    route: 'ordinary' | 'structured' | 'stream' | 'events';
    unsupported?: boolean;
  }
): Promise<void>;
export function verifyOpenAIExclusion(publicApi: typeof api, recovery: boolean): Promise<void>;
