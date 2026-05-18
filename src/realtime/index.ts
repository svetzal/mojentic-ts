/**
 * Realtime voice subsystem.
 *
 * Sibling to the `llm` module — duplex audio + text sessions with
 * parallel tool calling. Currently supports OpenAI's Realtime API.
 */

export * from './config';
export * from './events';
export * from './gateway';
export * from './openai-gateway';
export * from './session';
export * from './broker';
export * from './transport';
