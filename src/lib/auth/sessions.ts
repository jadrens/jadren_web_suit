import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, firstRow, withTransaction } from "./db";

/** A session lasts this long after sign-in; refreshing does not extend it. */
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
/** How long the token replaced by a rotation still works, for parallel refreshes from several tabs. */
const ROTATION_GRACE_SECONDS = 30;

export const REFRESH_COOKIE = "jadren_refresh";
// Only the auth service ever receives the cookie.
const REFRESH_COOKIE_PATH = "/rpc/jadren.v1.AuthService/";

interface SessionRow {
  session_id: string;
  user_id: string;
  token_hash: string;
  previous_token_hash: string | null;
  rotated_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface SessionGrant {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  /** The new refresh token to set as the cookie; null when the cookie must stay as it is. */
  token: string | null;
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export async function createSession(userId: string, userAgent: string | null): Promise<SessionGrant> {
  const token = newToken();
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  // Housekeeping: drop this user's dead sessions so the table does not grow unbounded.
  await db.query(
    "DELETE FROM auth_session WHERE user_id = $1 AND (expires_at < NOW() OR revoked_at < NOW() - INTERVAL '1 day')",
    [userId]
  );
  await db.query(
    `INSERT INTO auth_session (session_id, user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, userId, hashToken(token), expiresAt, userAgent?.slice(0, 255) ?? null]
  );
  return { sessionId, userId, expiresAt, token };
}

/**
 * Exchanges a refresh token for a rotated one. Returns null when the token is
 * unknown, expired or revoked. Presenting an older, already rotated token is
 * treated as theft: the whole session is revoked.
 */
export async function rotateSession(token: string): Promise<SessionGrant | null> {
  const tokenHash = hashToken(token);
  return withTransaction(async (client) => {
    const current = firstRow(
      (
        await client.query<SessionRow>(
          "SELECT * FROM auth_session WHERE token_hash = $1 FOR UPDATE",
          [tokenHash]
        )
      ).rows
    );
    if (current) {
      if (current.revoked_at || current.expires_at.getTime() <= Date.now()) return null;
      const next = newToken();
      await client.query(
        `UPDATE auth_session
            SET previous_token_hash = token_hash, token_hash = $2, rotated_at = NOW()
          WHERE session_id = $1`,
        [current.session_id, hashToken(next)]
      );
      return { sessionId: current.session_id, userId: current.user_id, expiresAt: current.expires_at, token: next };
    }

    const previous = firstRow(
      (
        await client.query<SessionRow>(
          "SELECT * FROM auth_session WHERE previous_token_hash = $1 FOR UPDATE",
          [tokenHash]
        )
      ).rows
    );
    if (!previous || previous.revoked_at || previous.expires_at.getTime() <= Date.now()) return null;
    if (Date.now() - previous.rotated_at.getTime() <= ROTATION_GRACE_SECONDS * 1000) {
      // Another tab refreshed a moment ago and already received the new cookie.
      return { sessionId: previous.session_id, userId: previous.user_id, expiresAt: previous.expires_at, token: null };
    }
    await client.query("UPDATE auth_session SET revoked_at = NOW() WHERE session_id = $1", [previous.session_id]);
    return null;
  });
}

export async function revokeSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  await db.query(
    `UPDATE auth_session SET revoked_at = NOW()
      WHERE (token_hash = $1 OR previous_token_hash = $1) AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function revokeUserSessions(userId: string) {
  await db.query("UPDATE auth_session SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

// --- Cookie ---------------------------------------------------------------

export function readRefreshCookie(headers: Headers) {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === REFRESH_COOKIE) return decodeURIComponent(value.join("=")) || null;
  }
  return null;
}

/** HTTPS as seen by the browser: nginx reports it in X-Forwarded-Proto. */
function isSecure(headers: Headers) {
  const proto = headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  const host = headers.get("host") ?? "";
  // Direct connections without a proxy: local development, which may be plain HTTP.
  return !/^(localhost|127\.0\.0\.1|\[::1\]|(?:[\w-]+\.)*jadren\.debug)(:\d+)?$/.test(host);
}

export function refreshCookie(token: string, expiresAt: Date, requestHeaders: Headers) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${REFRESH_COOKIE_PATH}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    // The auth RPCs are only ever called by this site's own pages.
    "SameSite=Strict",
    ...(isSecure(requestHeaders) ? ["Secure"] : []),
  ].join("; ");
}

export function clearedRefreshCookie(requestHeaders: Headers) {
  return [
    `${REFRESH_COOKIE}=`,
    `Path=${REFRESH_COOKIE_PATH}`,
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Strict",
    ...(isSecure(requestHeaders) ? ["Secure"] : []),
  ].join("; ");
}
