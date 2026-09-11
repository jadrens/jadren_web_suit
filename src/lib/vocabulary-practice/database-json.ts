// Bun/Postgres may return JSONB either decoded or as JSON text. Normalize at
// the database boundary; never treat a serialized snapshot as an empty order.
function parseDatabaseJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function databaseJsonArray<T>(value: unknown): T[] {
  const parsed = parseDatabaseJson(value);
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) throw new TypeError("Expected a JSON array from the database");
  return parsed as T[];
}

export function databaseJsonObject<T extends object>(value: unknown): T | null {
  const parsed = parseDatabaseJson(value);
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Expected a JSON object from the database");
  return parsed as T;
}
