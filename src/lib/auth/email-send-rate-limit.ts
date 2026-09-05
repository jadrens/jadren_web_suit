import { mkdirSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import AUTH_CONFIG from "@config/app/auth";

const EMAIL_WINDOW_MS = 3 * 60 * 60 * 1000;
const EMAIL_MAX_SENDS = 6;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_SENDS = 30;
const RETENTION_MS = EMAIL_WINDOW_MS;

interface CountRow {
  count: number;
}

export interface EmailSendRateLimiter {
  validate(sendToEmail: string, ip: string, now?: number): boolean;
  close(): void;
}

export function createEmailSendRateLimiter(
  databasePath: string = AUTH_CONFIG.emailRateLimitDbPath
): EmailSendRateLimiter {
  const resolvedPath =
    databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const database = new Database(resolvedPath, { create: true, strict: true });
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA busy_timeout = 5000");
  database.run(`
    CREATE TABLE IF NOT EXISTS email_send_monitor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      send_to_email TEXT NOT NULL,
      ip TEXT NOT NULL,
      sent_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS email_send_monitor_email_time_idx
      ON email_send_monitor (send_to_email, sent_at);
    CREATE INDEX IF NOT EXISTS email_send_monitor_ip_time_idx
      ON email_send_monitor (ip, sent_at);
  `);

  const deleteExpired = database.query<never, [number]>(
    "DELETE FROM email_send_monitor WHERE sent_at < ?"
  );
  const countEmail = database.query<CountRow, [string, number]>(
    `SELECT COUNT(*) AS count
       FROM email_send_monitor
      WHERE send_to_email = ? AND sent_at >= ?`
  );
  const countIp = database.query<CountRow, [string, number]>(
    `SELECT COUNT(*) AS count
       FROM email_send_monitor
      WHERE ip = ? AND sent_at >= ?`
  );
  const insertAttempt = database.query<never, [string, string, number]>(
    `INSERT INTO email_send_monitor (send_to_email, ip, sent_at)
     VALUES (?, ?, ?)`
  );

  const validateTransaction = database.transaction(
    (sendToEmail: string, ip: string, now: number) => {
      deleteExpired.run(now - RETENTION_MS);

      const emailCount =
        countEmail.get(sendToEmail, now - EMAIL_WINDOW_MS)?.count ?? 0;
      if (emailCount >= EMAIL_MAX_SENDS) return false;

      const ipCount = countIp.get(ip, now - IP_WINDOW_MS)?.count ?? 0;
      if (ipCount >= IP_MAX_SENDS) return false;

      insertAttempt.run(sendToEmail, ip, now);
      return true;
    }
  );

  return {
    validate(sendToEmail, ip, now = Date.now()) {
      const normalizedEmail = sendToEmail.trim().toLowerCase();
      const normalizedIp = normalizeIp(ip);
      if (!normalizedEmail || !normalizedIp) return false;
      return validateTransaction.immediate(normalizedEmail, normalizedIp, now);
    },
    close() {
      database.close();
    },
  };
}

const globalForRateLimit = globalThis as typeof globalThis & {
  emailSendRateLimiter?: EmailSendRateLimiter;
};

function rateLimiter() {
  if (!globalForRateLimit.emailSendRateLimiter) {
    globalForRateLimit.emailSendRateLimiter = createEmailSendRateLimiter();
  }
  return globalForRateLimit.emailSendRateLimiter;
}

export function validateEmailSend(sendToEmail: string, ip: string) {
  return rateLimiter().validate(sendToEmail, ip);
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const candidate =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "unknown";
  return normalizeIp(candidate) || "unknown";
}

function normalizeIp(value: string) {
  let ip = value.trim().toLowerCase();
  const bracketedIpv6 = ip.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketedIpv6) ip = bracketedIpv6[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  return isIP(ip) ? ip : value === "unknown" ? "unknown" : null;
}
