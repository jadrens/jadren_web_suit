import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import AUTH_CONFIG from "@config/app/auth";
import { randomCaptchaText, renderCaptchaGif } from "./render";

/** Auth requests an address may make within the window before it must solve a CAPTCHA. */
export const FREE_AUTH_REQUESTS = 2;
export const AUTH_WINDOW_MS = 5 * 60 * 60 * 1000;
export const CAPTCHA_LIFETIME_MS = 5 * 60 * 1000;
export const CAPTCHA_LENGTH = 5;
/** Challenges an address may fetch per 10 minutes; each one costs ~50 ms of CPU. */
const ISSUE_WINDOW_MS = 10 * 60 * 1000;
const ISSUE_LIMIT = 20;

/** Request metadata carrying "<challenge id>.<answer>". */
export const CAPTCHA_HEADER = "x-captcha";

export type GateResult = "allowed" | "captcha_required" | "captcha_invalid";

export interface CaptchaStore {
  /** Creates a challenge bound to `ip`; null when the address fetches too many. */
  issue(ip: string, now?: number): { id: string; gif: Uint8Array; expiresInSeconds: number } | null;
  /**
   * Admits one auth request from `ip`. The first FREE_AUTH_REQUESTS in the
   * window pass freely; later ones must carry a correct, unexpired, unused
   * solution. Admitted requests are counted; rejected ones are not.
   */
  admit(ip: string, solution: string | null, now?: number): GateResult;
  /** Checks "<id>.<answer>" without counting a request; consumes the challenge either way. */
  check(ip: string, solution: string, now?: number): boolean;
  close(): void;
}

const hash = (value: string) => createHash("sha256").update(value).digest();
const normalizeAnswer = (answer: string) => answer.replace(/\s+/g, "").toUpperCase();

export function createCaptchaStore(options: {
  databasePath?: string;
  /** Overridable so tests need not render GIFs. */
  render?: (text: string) => Uint8Array;
  text?: () => string;
} = {}): CaptchaStore {
  const databasePath = options.databasePath ?? AUTH_CONFIG.captchaDbPath;
  const path = databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const render = options.render ?? renderCaptchaGif;
  const text = options.text ?? (() => randomCaptchaText(CAPTCHA_LENGTH));

  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run(`
    CREATE TABLE IF NOT EXISTS captcha_challenge (
      id TEXT PRIMARY KEY,
      ip_hash BLOB NOT NULL,
      answer_hash BLOB NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS captcha_challenge_ip_idx ON captcha_challenge (ip_hash, issued_at);
    CREATE TABLE IF NOT EXISTS auth_request_monitor (
      id INTEGER PRIMARY KEY,
      ip_hash BLOB NOT NULL,
      occurred_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_request_monitor_ip_idx ON auth_request_monitor (ip_hash, occurred_at);
  `);

  const pruneChallenges = db.query<never, [number, number]>(
    "DELETE FROM captcha_challenge WHERE expires_at < ? AND issued_at < ?"
  );
  const countIssued = db.query<{ count: number }, [Uint8Array, number]>(
    "SELECT COUNT(*) AS count FROM captcha_challenge WHERE ip_hash = ? AND issued_at >= ?"
  );
  const insertChallenge = db.query<never, [string, Uint8Array, Uint8Array, number, number]>(
    "INSERT INTO captcha_challenge (id, ip_hash, answer_hash, issued_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  );
  const takeChallenge = db.query<{ ip_hash: Uint8Array; answer_hash: Uint8Array; expires_at: number }, [string]>(
    "DELETE FROM captcha_challenge WHERE id = ? RETURNING ip_hash, answer_hash, expires_at"
  );
  const pruneRequests = db.query<never, [number]>("DELETE FROM auth_request_monitor WHERE occurred_at < ?");
  const countRequests = db.query<{ count: number }, [Uint8Array, number]>(
    "SELECT COUNT(*) AS count FROM auth_request_monitor WHERE ip_hash = ? AND occurred_at >= ?"
  );
  const insertRequest = db.query<never, [Uint8Array, number]>(
    "INSERT INTO auth_request_monitor (ip_hash, occurred_at) VALUES (?, ?)"
  );

  // Issued rows outlive their expiry until the issue window passes, so the
  // per-address issue count also covers expired challenges.
  const reserveIssue = db.transaction((ipHash: Uint8Array, id: string, answerHash: Uint8Array, now: number) => {
    pruneChallenges.run(now, now - ISSUE_WINDOW_MS);
    if ((countIssued.get(ipHash, now - ISSUE_WINDOW_MS)?.count ?? 0) >= ISSUE_LIMIT) return false;
    insertChallenge.run(id, ipHash, answerHash, now, now + CAPTCHA_LIFETIME_MS);
    return true;
  });

  const solves = (ipHash: Uint8Array, solution: string, now: number) => {
    const dot = solution.indexOf(".");
    if (dot <= 0 || solution.length > 128) return false;
    const id = solution.slice(0, dot);
    // Taking the row makes every challenge single-use, right or wrong.
    const row = takeChallenge.get(id);
    if (!row || row.expires_at < now) return false;
    const expected = Buffer.from(row.answer_hash);
    const actual = hash(`${id}:${normalizeAnswer(solution.slice(dot + 1))}`);
    return timingSafeEqual(Buffer.from(row.ip_hash), ipHash) && timingSafeEqual(expected, actual);
  };

  const checkSolution = db.transaction((ipHash: Uint8Array, solution: string, now: number) => solves(ipHash, solution, now));

  const admit = db.transaction((ipHash: Uint8Array, solution: string | null, now: number): GateResult => {
    pruneRequests.run(now - AUTH_WINDOW_MS);
    const recent = countRequests.get(ipHash, now - AUTH_WINDOW_MS)?.count ?? 0;
    if (recent >= FREE_AUTH_REQUESTS) {
      if (!solution) return "captcha_required";
      if (!solves(ipHash, solution, now)) return "captcha_invalid";
    }
    insertRequest.run(ipHash, now);
    return "allowed";
  });

  return {
    issue(ip, now = Date.now()) {
      const id = randomBytes(18).toString("base64url");
      const answer = text();
      if (!reserveIssue.immediate(hash(ip), id, hash(`${id}:${normalizeAnswer(answer)}`), now)) return null;
      return { id, gif: render(answer), expiresInSeconds: CAPTCHA_LIFETIME_MS / 1000 };
    },
    check(ip, solution, now = Date.now()) {
      return checkSolution.immediate(hash(ip), solution.trim(), now);
    },
    admit(ip, solution, now = Date.now()) {
      return admit.immediate(hash(ip), solution?.trim() || null, now);
    },
    close() {
      db.close();
    },
  };
}

const globalForCaptcha = globalThis as typeof globalThis & { captchaStore?: CaptchaStore };

export function captchaStore() {
  globalForCaptcha.captchaStore ??= createCaptchaStore();
  return globalForCaptcha.captchaStore;
}
