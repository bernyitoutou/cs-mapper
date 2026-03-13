/**
 * Traverse an object using a dot-notation path and return the value.
 *
 * @example
 * getNestedValue({ body: { model_code: "8581842" } }, "body.model_code")
 * // → "8581842"
 *
 * getNestedValue({ uid: "blt123" }, "uid")
 * // → "blt123"
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current != null && typeof current === "object") {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Set a value at a dot-notation path on an object, creating intermediate objects as needed.
 * Returns the mutated object.
 *
 * @example
 * setNestedValue({ metadata: {} }, "metadata.title", "Hello")
 * // → { metadata: { title: "Hello" } }
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if(!key) continue;
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined && lastKey !== "") {
    current[lastKey] = value;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Async utilities
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Returns true for transient HTTP errors that are safe to retry:
 * 429 Too Many Requests, 502/503/504 gateway errors, and fetch() network errors.
 */
export function isTransientError(err: unknown): boolean {
  if (err != null && typeof err === "object" && "status" in err) {
    return [429, 502, 503, 504].includes((err as { status: number }).status);
  }
  return err instanceof TypeError; // fetch() throws TypeError on network failures
}

/**
 * Retry `fn` up to `maxRetries` times using exponential backoff.
 * Only retries when `retryOn` returns true (defaults to `isTransientError`).
 *
 * @example
 * const data = await withRetry(() => deliveryGet("/content_types/blog_post/entries"));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    retryOn?: (err: unknown) => boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, retryOn = isTransientError } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !retryOn(err)) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
