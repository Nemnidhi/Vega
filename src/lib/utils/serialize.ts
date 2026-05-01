export function serializeForJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
