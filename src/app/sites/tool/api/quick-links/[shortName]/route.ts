import { NextResponse } from "next/server";
import { db, firstRow } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import { bearerToken, verifyAccessToken } from "@tool/lib/auth/jwt";

interface QuickLinkRow {
  short_name: string;
  target_url: string;
  note: string | null;
  created_at: string | Date;
  expire_at: string | Date;
  click_count: string;
}

interface RouteContext {
  params: Promise<{ shortName: string }>;
}

class InvalidAccessTokenError extends Error {}

function toQuickLink(row: QuickLinkRow) {
  return {
    shortName: row.short_name,
    targetUrl: row.target_url,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expire_at).toISOString(),
    clickCount: row.click_count,
  };
}

function normalizeTargetUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeNote(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const note = value.trim();
  return note.length <= 255 ? note || null : undefined;
}

async function requestUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
    throw new InvalidAccessTokenError();
  }
}

function authFailure(error: unknown) {
  if (error instanceof Error && error.message.includes("JWT_SECRET")) {
    return internalError(error);
  }
  if (error instanceof InvalidAccessTokenError) {
    return apiError("Token is invalid or expired", 401, "invalid_token");
  }
  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requestUser(request);
    if (!user) return apiError("Bearer token is required", 401, "token_required");
    if (user.status === 2) return apiError("Account is unavailable", 403, "account_unavailable");

    const { shortName } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid JSON body", 400, "invalid_json");
    }

    const currentResult = await db.query<QuickLinkRow>(
      `SELECT short_name, target_url, note, created_at, expire_at,
              click_count::text
         FROM quick_link
        WHERE short_name = $1 AND user_id = $2
        LIMIT 1`,
      [shortName, user.sub]
    );
    const current = firstRow(currentResult.rows);
    if (!current) return apiError("Quick link was not found", 404, "quick_link_not_found");

    let targetUrl = current.target_url;
    let note = current.note;
    let expiresAt = new Date(current.expire_at);
    let changed = false;

    if ("targetUrl" in body) {
      const normalized = normalizeTargetUrl(body.targetUrl);
      if (!normalized) {
        return apiError("Target URL must be a valid HTTP or HTTPS URL", 400, "invalid_target_url");
      }
      targetUrl = normalized;
      changed = true;
    }
    if ("note" in body) {
      const normalized = normalizeNote(body.note);
      if (normalized === undefined) {
        return apiError("Note must contain no more than 255 characters", 400, "invalid_note");
      }
      note = normalized;
      changed = true;
    }
    if (body.disable === true) {
      expiresAt = new Date();
      changed = true;
    } else if ("expiresAt" in body) {
      const nextExpiration =
        typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
      if (!nextExpiration || !Number.isFinite(nextExpiration.getTime())) {
        return apiError("Expiration date is invalid", 400, "invalid_expiration");
      }
      if (
        nextExpiration.getTime() <= Date.now() ||
        nextExpiration.getTime() <= new Date(current.expire_at).getTime()
      ) {
        return apiError(
          "Expiration date must extend the current expiration",
          400,
          "expiration_not_extended"
        );
      }
      expiresAt = nextExpiration;
      changed = true;
    }

    if (!changed) return apiError("No supported changes were provided", 400, "empty_update");

    const result = await db.query<QuickLinkRow>(
      `UPDATE quick_link
          SET target_url = $3, note = $4, expire_at = $5
        WHERE short_name = $1 AND user_id = $2
        RETURNING short_name, target_url, note, created_at, expire_at,
                  click_count::text`,
      [shortName, user.sub, targetUrl, note, expiresAt]
    );
    const link = firstRow(result.rows);
    if (!link) return apiError("Quick link was not found", 404, "quick_link_not_found");
    return NextResponse.json({ link: toQuickLink(link) });
  } catch (error) {
    return authFailure(error) ?? internalError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requestUser(request);
    if (!user) return apiError("Bearer token is required", 401, "token_required");
    if (user.status === 2) return apiError("Account is unavailable", 403, "account_unavailable");

    const { shortName } = await context.params;
    const result = await db.query<{ short_name: string }>(
      `DELETE FROM quick_link
        WHERE short_name = $1 AND user_id = $2
        RETURNING short_name`,
      [shortName, user.sub]
    );
    if (!firstRow(result.rows)) {
      return apiError("Quick link was not found", 404, "quick_link_not_found");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authFailure(error) ?? internalError(error);
  }
}

