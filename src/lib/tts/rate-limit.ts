import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";

const WINDOW_MS = 60 * 60 * 1000;
const BURST_MS = 60 * 1000;
const HOURLY_LIMIT = 120;
const BURST_LIMIT = 15;
const DEFAULT_DB_PATH = process.env.TTS_RATE_LIMIT_DB_PATH?.trim() || ".data/tts-request-monitor.sqlite";

interface CountRow { count: number }

export interface TtsRateLimiter {
  consume(ip: string, now?: number): boolean;
  close(): void;
}

export function createTtsRateLimiter(databasePath = DEFAULT_DB_PATH): TtsRateLimiter {
  const path = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run(`
    CREATE TABLE IF NOT EXISTS tts_requests (
      id INTEGER PRIMARY KEY,
      ip_hash TEXT NOT NULL,
      requested_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tts_requests_ip_time_idx
      ON tts_requests (ip_hash, requested_at);
  `);
  const deleteExpired = db.query<never, [number]>("DELETE FROM tts_requests WHERE requested_at < ?");
  const count = db.query<CountRow, [string, number]>(
    "SELECT COUNT(*) AS count FROM tts_requests WHERE ip_hash = ? AND requested_at >= ?"
  );
  const insert = db.query<never, [string, number]>(
    "INSERT INTO tts_requests (ip_hash, requested_at) VALUES (?, ?)"
  );
  const consume = db.transaction((key: string, now: number) => {
    deleteExpired.run(now - WINDOW_MS);
    if ((count.get(key, now - BURST_MS)?.count ?? 0) >= BURST_LIMIT) return false;
    if ((count.get(key, now - WINDOW_MS)?.count ?? 0) >= HOURLY_LIMIT) return false;
    insert.run(key, now);
    return true;
  });

  return {
    consume(ip, now = Date.now()) {
      if (!ip.trim()) return false;
      const key = createHash("sha256").update(ip).digest("hex");
      return consume.immediate(key, now);
    },
    close() { db.close(); },
  };
}

const globalForTts = globalThis as typeof globalThis & { ttsRateLimiter?: TtsRateLimiter };

export function consumeTtsRequest(ip: string) {
  globalForTts.ttsRateLimiter ??= createTtsRateLimiter();
  return globalForTts.ttsRateLimiter.consume(ip);
}
