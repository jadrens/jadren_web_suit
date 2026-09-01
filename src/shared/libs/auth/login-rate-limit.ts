import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import AUTH_CONFIG from "@tool/var/auth";

const WINDOW_MS = 15 * 60 * 1000;
const IDENTIFIER_IP_MAX_ATTEMPTS = 8;
const IP_MAX_ATTEMPTS = 30;

interface CountRow {
  count: number;
}

export interface LoginRateLimiter {
  consume(identifier: string, ip: string, now?: number): boolean;
  reset(identifier: string, ip: string): void;
  close(): void;
}

function identifierKey(identifier: string) {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex");
}

export function createLoginRateLimiter(
  databasePath: string = AUTH_CONFIG.loginRateLimitDbPath
): LoginRateLimiter {
  const resolvedPath =
    databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const database = new Database(resolvedPath, { create: true, strict: true });
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA busy_timeout = 5000");
  database.run(`
    CREATE TABLE IF NOT EXISTS login_attempt_monitor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier_key TEXT NOT NULL,
      ip TEXT NOT NULL,
      attempted_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS login_attempt_identifier_ip_time_idx
      ON login_attempt_monitor (identifier_key, ip, attempted_at);
    CREATE INDEX IF NOT EXISTS login_attempt_ip_time_idx
      ON login_attempt_monitor (ip, attempted_at);
  `);

  const deleteExpired = database.query<never, [number]>(
    "DELETE FROM login_attempt_monitor WHERE attempted_at < ?"
  );
  const countIdentifierIp = database.query<CountRow, [string, string, number]>(
    `SELECT COUNT(*) AS count
       FROM login_attempt_monitor
      WHERE identifier_key = ? AND ip = ? AND attempted_at >= ?`
  );
  const countIp = database.query<CountRow, [string, number]>(
    `SELECT COUNT(*) AS count
       FROM login_attempt_monitor
      WHERE ip = ? AND attempted_at >= ?`
  );
  const insertAttempt = database.query<never, [string, string, number]>(
    `INSERT INTO login_attempt_monitor (identifier_key, ip, attempted_at)
     VALUES (?, ?, ?)`
  );
  const resetIdentifierIp = database.query<never, [string, string]>(
    `DELETE FROM login_attempt_monitor
      WHERE identifier_key = ? AND ip = ?`
  );

  const consumeTransaction = database.transaction(
    (key: string, ip: string, now: number) => {
      const windowStart = now - WINDOW_MS;
      deleteExpired.run(windowStart);

      const identifierIpCount =
        countIdentifierIp.get(key, ip, windowStart)?.count ?? 0;
      if (identifierIpCount >= IDENTIFIER_IP_MAX_ATTEMPTS) return false;

      const ipCount = countIp.get(ip, windowStart)?.count ?? 0;
      if (ipCount >= IP_MAX_ATTEMPTS) return false;

      insertAttempt.run(key, ip, now);
      return true;
    }
  );

  return {
    consume(identifier, ip, now = Date.now()) {
      const key = identifierKey(identifier);
      if (!identifier.trim() || !ip.trim()) return false;
      return consumeTransaction.immediate(key, ip, now);
    },
    reset(identifier, ip) {
      resetIdentifierIp.run(identifierKey(identifier), ip);
    },
    close() {
      database.close();
    },
  };
}

const globalForLoginRateLimit = globalThis as typeof globalThis & {
  loginRateLimiter?: LoginRateLimiter;
};

function rateLimiter() {
  if (!globalForLoginRateLimit.loginRateLimiter) {
    globalForLoginRateLimit.loginRateLimiter = createLoginRateLimiter();
  }
  return globalForLoginRateLimit.loginRateLimiter;
}

export function consumeLoginAttempt(identifier: string, ip: string) {
  return rateLimiter().consume(identifier, ip);
}

export function resetLoginAttempts(identifier: string, ip: string) {
  rateLimiter().reset(identifier, ip);
}

export const loginRateLimitWindowSeconds = WINDOW_MS / 1000;
