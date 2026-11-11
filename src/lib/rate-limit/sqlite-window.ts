import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";

/** At most `limit` events per key within any `windowMs`. */
export interface WindowRule {
  windowMs: number;
  limit: number;
}

export interface SqliteWindowLimiter {
  /** Records one event for `key` if every rule still allows it; false when limited. */
  consume(key: string, now?: number): boolean;
  /** Forgets all events for `key`. */
  reset(key: string): void;
  close(): void;
}

interface CountRow {
  count: number;
}

const DEFAULT_DB_PATH = process.env.REQUEST_LIMIT_DB_PATH?.trim() || ".data/request-limits.sqlite";

/**
 * A sliding-window limiter stored in SQLite, so limits survive restarts and are
 * shared by every worker on the host. Keys are hashed before they are stored.
 * The check and the insert run in one IMMEDIATE transaction, so concurrent
 * requests cannot all pass the check before any of them is recorded.
 */
export function createSqliteWindowLimiter(options: {
  table: string;
  rules: readonly WindowRule[];
  databasePath?: string;
}): SqliteWindowLimiter {
  const { table, rules } = options;
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`Invalid limiter table name: ${table}`);
  if (rules.length === 0) throw new Error("A limiter needs at least one rule");
  const retentionMs = Math.max(...rules.map((rule) => rule.windowMs));

  const databasePath = options.databasePath ?? DEFAULT_DB_PATH;
  const path = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id INTEGER PRIMARY KEY,
      key_hash TEXT NOT NULL,
      occurred_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ${table}_key_time_idx ON ${table} (key_hash, occurred_at);
  `);

  const deleteExpired = db.query<never, [number]>(`DELETE FROM ${table} WHERE occurred_at < ?`);
  const count = db.query<CountRow, [string, number]>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE key_hash = ? AND occurred_at >= ?`
  );
  const insert = db.query<never, [string, number]>(`INSERT INTO ${table} (key_hash, occurred_at) VALUES (?, ?)`);
  const deleteKey = db.query<never, [string]>(`DELETE FROM ${table} WHERE key_hash = ?`);

  const consume = db.transaction((keyHash: string, now: number) => {
    deleteExpired.run(now - retentionMs);
    for (const rule of rules) {
      if ((count.get(keyHash, now - rule.windowMs)?.count ?? 0) >= rule.limit) return false;
    }
    insert.run(keyHash, now);
    return true;
  });

  const hash = (key: string) => createHash("sha256").update(key).digest("hex");

  return {
    consume(key, now = Date.now()) {
      if (!key.trim()) return false;
      return consume.immediate(hash(key), now);
    },
    reset(key) {
      deleteKey.run(hash(key));
    },
    close() {
      db.close();
    },
  };
}

const limiters = (globalThis as typeof globalThis & {
  sqliteWindowLimiters?: Map<string, SqliteWindowLimiter>;
}).sqliteWindowLimiters ??= new Map();

/** A process-wide limiter for `table`, created on first use. */
export function sharedLimiter(table: string, rules: readonly WindowRule[]) {
  let limiter = limiters.get(table);
  if (!limiter) {
    limiter = createSqliteWindowLimiter({ table, rules });
    limiters.set(table, limiter);
  }
  return limiter;
}
