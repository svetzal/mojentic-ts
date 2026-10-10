/** Pure JSON-prefix evidence scanning. String contents never become structural keys. */
import type { SemanticProgress } from './recovery';

interface Context {
  readonly kind: 'object' | 'array';
  readonly message: boolean;
  readonly tools: boolean;
  readonly tool: boolean;
  expecting: 'key' | 'value';
  key?: string;
}
interface StringToken {
  readonly value: string;
  readonly end: number;
  readonly complete: boolean;
}
function stringToken(text: string, start: number): StringToken {
  let escaped = false;
  let end = start + 1;
  for (; end < text.length; end++) {
    const char = text.charAt(end);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      try {
        return {
          value: JSON.parse(text.slice(start, end + 1)) as string,
          end: end + 1,
          complete: true,
        };
      } catch {
        return { value: '', end: end + 1, complete: false };
      }
    }
  }
  // A split escape can end a prefix. Retain its presence conservatively, without inventing keys.
  const raw = text.slice(start + 1);
  for (let trim = 0; trim <= Math.min(6, raw.length); trim++) {
    try {
      return {
        value: JSON.parse(`"${raw.slice(0, raw.length - trim)}"`) as string,
        end,
        complete: false,
      };
    } catch {
      /* Try removing only the incomplete escape suffix. */
    }
  }
  return { value: raw, end, complete: false };
}

/** Count only actual message fields and tool array objects, including escaped JSON keys. */
export function observeCompletionPrefix(bytes: Uint8Array): SemanticProgress {
  const text = new TextDecoder().decode(bytes);
  const stack: Context[] = [];
  let contentBytes = 0;
  let reasoningBytes = 0;
  let toolFragments = 0;
  let completedToolCalls = 0;
  for (let offset = 0; offset < text.length;) {
    const char = text.charAt(offset);
    const parent = stack.at(-1);
    if (char === '"') {
      const token = stringToken(text, offset);
      offset = token.end;
      if (parent?.expecting === 'key') {
        parent.key = token.complete ? token.value : undefined;
      } else if (parent?.message) {
        const length = new TextEncoder().encode(token.value).length;
        if (parent.key === 'content') contentBytes += length;
        if (parent.key === 'thinking' || parent.key === 'reasoning_content')
          reasoningBytes += length;
        parent.key = undefined;
      }
      continue;
    }
    if (char === '{' || char === '[') {
      const tool = char === '{' && parent?.tools === true;
      if (tool) toolFragments++;
      stack.push({
        kind: char === '{' ? 'object' : 'array',
        message: char === '{' && parent?.key === 'message',
        tools: char === '[' && parent?.message === true && parent.key === 'tool_calls',
        tool,
        expecting: char === '{' ? 'key' : 'value',
      });
      if (parent) parent.key = undefined;
    } else if (char === '}' || char === ']') {
      const context = stack.pop();
      if (char === '}' && context?.tool) completedToolCalls++;
    } else if (char === ':' && parent?.kind === 'object') {
      parent.expecting = 'value';
    } else if (char === ',' && parent) {
      parent.expecting = parent.kind === 'object' ? 'key' : 'value';
      parent.key = undefined;
    }
    offset++;
  }
  return Object.freeze({ contentBytes, reasoningBytes, toolFragments, completedToolCalls });
}
