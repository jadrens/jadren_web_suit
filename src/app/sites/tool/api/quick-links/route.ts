import { NextResponse } from "next/server";
import { db, firstRow } from "@tool/lib/auth/db";
import {
  apiError,
  internalError,
  isUniqueViolation,
} from "@tool/lib/auth/http";
import { bearerToken, verifyAccessToken } from "@tool/lib/auth/jwt";

interface QuickLinkRow {
  short_name: string;
  target_url: string;
  note: string | null;
  created_at: string | Date;
  expire_at: string | Date;
  click_count: string;
}

const SHORT_NAME_PATTERN = /^[A-Za-z0-9]{1,64}$/;

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
  if (value === undefined || value === null || value === "") return null;
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
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      throw error;
    }
    throw new InvalidAccessTokenError();
  }
}

export async function GET(request: Request) {
  try {
    const user = await requestUser(request);
    if (!user) return apiError("Bearer token is required", 401, "token_required");
    if (user.status === 2) {
      return apiError("Account is unavailable", 403, "account_unavailable");
    }

    const result = await db.query<QuickLinkRow>(
      `SELECT short_name, target_url, note, created_at, expire_at,
              click_count::text
         FROM quick_link
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [user.sub]
    );

    return NextResponse.json({ links: result.rows.map(toQuickLink) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return internalError(error);
    }
    if (error instanceof InvalidAccessTokenError) {
      return apiError("Token is invalid or expired", 401, "invalid_token");
    }
    return internalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requestUser(request);
    if (!user) return apiError("Bearer token is required", 401, "token_required");
    if (user.status === 2) {
      return apiError("Account is unavailable", 403, "account_unavailable");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid JSON body", 400, "invalid_json");
    }

    const shortName =
      typeof body.shortName === "string" ? body.shortName.trim() : "";
    if (!SHORT_NAME_PATTERN.test(shortName)) {
      return apiError(
        "Short name must contain only 1-64 letters or numbers",
        400,
        "invalid_short_name"
      );
    }

    const targetUrl = normalizeTargetUrl(body.targetUrl);
    if (!targetUrl) {
      return apiError("Target URL must be a valid HTTP or HTTPS URL", 400, "invalid_target_url");
    }
    const note = normalizeNote(body.note);
    if (note === undefined) {
      return apiError("Note must contain no more than 255 characters", 400, "invalid_note");
    }

    const expiresAt =
      typeof body.expiresAt === "string" ? new Date(body.expiresAt) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime())) {
      return apiError("Expiration date is invalid", 400, "invalid_expiration");
    }
    if (expiresAt.getTime() <= Date.now()) {
      return apiError(
        "Expiration date must be in the future",
        400,
        "expiration_not_future"
      );
    }

    const result = await db.query<QuickLinkRow>(
      `INSERT INTO quick_link (short_name, user_id, target_url, note, expire_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING short_name, target_url, note, created_at, expire_at,
                 click_count::text`,
      [shortName, user.sub, targetUrl, note, expiresAt]
    );
    const link = firstRow(result.rows);
    if (!link) throw new Error("Quick-link insert returned no row");

    return NextResponse.json({ link: toQuickLink(link) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError("Short name is already in use", 409, "quick_link_exists");
    }
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return internalError(error);
    }
    if (error instanceof InvalidAccessTokenError) {
      return apiError("Token is invalid or expired", 401, "invalid_token");
    }
    return internalError(error);
  }
}
