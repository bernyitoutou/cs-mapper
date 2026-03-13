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
