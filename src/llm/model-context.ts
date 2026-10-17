import { z } from 'zod';
import { Ok, Result } from '../error';
import type { LlmGateway } from './gateway';
import type { CompletionConfig } from './models';

/** A provider-advertised context upper bound, with the exact source field. */
export interface ModelContextWindow {
  readonly maxContextTokens: number;
  readonly field: string;
  /** Ollama model parameter used when the request omits numCtx; not the advertised maximum. */
  readonly modelNumCtx?: number;
}

const positiveInteger = z.number().int().positive();
const omlxModels = z.object({
  data: z.array(z.object({ id: z.string(), max_model_len: z.unknown().optional() })),
});
const ollamaShow = z.object({
  model_info: z.record(z.string(), z.unknown()).optional(),
  parameters: z.string().optional(),
});

/**
 * Query an optional gateway capability. Older custom gateways return Ok(null).
 * Errors from implemented queries remain Result errors; no window is inferred.
 */
export async function getModelContextWindow(
  gateway: LlmGateway,
  model: string
): Promise<Result<ModelContextWindow | null, Error>> {
  return gateway.getModelContextWindow ? gateway.getModelContextWindow(model) : Ok(null);
}

/**
 * Pure Ollama upper bound: explicit numCtx, then modelNumCtx, then the advertised maximum.
 * Returns null for unknown metadata. The server's OLLAMA_CONTEXT_LENGTH is not observable.
 * Configuration context sizes must be positive integers, as required by Ollama.
 */
export function effectiveContextWindow(
  window: ModelContextWindow | null,
  config?: Pick<CompletionConfig, 'numCtx'>
): number | null {
  if (window === null) return null;
  return Math.min(
    window.maxContextTokens,
    config?.numCtx ?? window.modelNumCtx ?? window.maxContextTokens
  );
}

/** Decode the captured oMLX models envelope; throws ZodError for malformed fields. */
export function parseOMLXContextWindow(body: unknown, model: string): ModelContextWindow | null {
  const entry = omlxModels.parse(body).data.find((candidate) => candidate.id === model);
  if (entry?.max_model_len === undefined) return null;
  return { maxContextTokens: positiveInteger.parse(entry.max_model_len), field: 'max_model_len' };
}

/** Decode any Ollama architecture prefix and the optional model num_ctx parameter. */
export function parseOllamaContextWindow(body: unknown): ModelContextWindow | null {
  const data = ollamaShow.parse(body);
  const context = Object.entries(data.model_info ?? {}).find(([key]) =>
    key.endsWith('.context_length')
  );
  if (context === undefined) return null;
  const parameter = data.parameters?.split('\n').find((line) => /^\s*num_ctx(?:\s|$)/.test(line));
  const modelNumCtx =
    parameter === undefined
      ? undefined
      : positiveInteger.parse(Number(parameter.trim().split(/\s+/).slice(1).join(' ')));
  return {
    maxContextTokens: positiveInteger.parse(context[1]),
    field: `model_info.${context[0]}`,
    ...(modelNumCtx === undefined ? {} : { modelNumCtx }),
  };
}
