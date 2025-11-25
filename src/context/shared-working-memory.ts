/**
 * Shared Working Memory - Context that agents can read from and write to
 */

/**
 * Deep merge utility that recursively merges objects.
 * Arrays and primitives are replaced, not merged.
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns The merged object
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  // eslint-disable-next-line security/detect-object-injection
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    // eslint-disable-next-line security/detect-object-injection
    const sourceValue = source[key];
    // eslint-disable-next-line security/detect-object-injection
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge nested objects
      // eslint-disable-next-line security/detect-object-injection
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      // Replace primitives, arrays, and nulls
      // eslint-disable-next-line security/detect-object-injection
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * SharedWorkingMemory provides a shared context that agents can read from and write to.
 *
 * This enables agents to maintain state across multiple interactions and share
 * information with each other. Memory is stored as a plain object that can be
 * retrieved and updated through deep merging.
 *
 * @example
 * ```typescript
 * const memory = new SharedWorkingMemory({
 *   user: {
 *     name: 'Alice',
 *     age: 30
 *   }
 * });
 *
 * // Retrieve current memory
 * const current = memory.getWorkingMemory();
 * console.log(current.user.name); // 'Alice'
 *
 * // Merge new information
 * memory.mergeToWorkingMemory({
 *   user: {
 *     city: 'New York'
 *   }
 * });
 *
 * // Memory now contains both original and new data
 * const updated = memory.getWorkingMemory();
 * console.log(updated.user); // { name: 'Alice', age: 30, city: 'New York' }
 * ```
 */
export class SharedWorkingMemory {
  private _workingMemory: Record<string, unknown>;

  /**
   * Create a new SharedWorkingMemory instance.
   *
   * @param initialWorkingMemory - Initial memory object (default: empty object)
   */
  constructor(initialWorkingMemory: Record<string, unknown> = {}) {
    // Make a shallow copy to avoid sharing reference with caller
    this._workingMemory = { ...initialWorkingMemory };
  }

  /**
   * Get the current working memory.
   *
   * @returns A copy of the current working memory object
   */
  getWorkingMemory(): Record<string, unknown> {
    return { ...this._workingMemory };
  }

  /**
   * Merge new information into the working memory.
   *
   * This performs a deep merge, recursively updating nested objects while
   * replacing primitives and arrays. This allows partial updates to complex
   * memory structures without losing existing data.
   *
   * @param workingMemory - The memory object to merge in
   *
   * @example
   * ```typescript
   * // Initial memory
   * const memory = new SharedWorkingMemory({
   *   user: { name: 'Bob', preferences: { theme: 'dark' } }
   * });
   *
   * // Merge new preference without losing existing ones
   * memory.mergeToWorkingMemory({
   *   user: { preferences: { language: 'en' } }
   * });
   *
   * // Result: { user: { name: 'Bob', preferences: { theme: 'dark', language: 'en' } } }
   * ```
   */
  mergeToWorkingMemory(workingMemory: Record<string, unknown>): void {
    this._workingMemory = deepMerge(this._workingMemory, workingMemory);
  }
}
