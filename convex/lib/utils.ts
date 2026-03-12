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
