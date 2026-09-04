import { NextResponse } from "next/server";
import { db, firstRow } from "@shared/libs/auth/db";
import { apiError, internalError } from "@shared/libs/auth/http";
import { bearerToken, verifyAccessToken } from "@shared/libs/auth/jwt";

interface BackupRow {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updated_at: Date | string;
}

const base64 = /^[A-Za-z0-9+/]+={0,2}$/;

async function authenticatedUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const user = await verifyAccessToken(token);
    return user.status === 1 ? user : null;
  } catch {
    return null;
  }
}

function response(row: BackupRow) {
  return NextResponse.json({ backup: {
    version: row.version,
    salt: row.salt,
    iv: row.iv,
    ciphertext: row.ciphertext,
    updatedAt: new Date(row.updated_at).toISOString(),
  } });
}

export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return apiError("A verified account is required", 401, "authentication_required");
    const result = await db.query<BackupRow>(
      "SELECT version, salt, iv, ciphertext, updated_at FROM user_llm_settings_backup WHERE user_id = $1",
      [user.sub],
    );
    const backup = firstRow(result.rows);
    if (!backup) return apiError("No cloud backup exists", 404, "backup_not_found");
    return response(backup);
  } catch (error) {
    return internalError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return apiError("A verified account is required", 401, "authentication_required");
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const version = body?.version;
    const salt = body?.salt;
    const iv = body?.iv;
    const ciphertext = body?.ciphertext;
    if (
      version !== 1 || typeof salt !== "string" || salt.length > 64 || !base64.test(salt) ||
      typeof iv !== "string" || iv.length > 64 || !base64.test(iv) ||
      typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext.length > 262144 || !base64.test(ciphertext)
    ) return apiError("Invalid encrypted backup", 400, "invalid_backup");

    const result = await db.query<BackupRow>(
      `INSERT INTO user_llm_settings_backup (user_id, version, salt, iv, ciphertext)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         version = EXCLUDED.version, salt = EXCLUDED.salt, iv = EXCLUDED.iv,
         ciphertext = EXCLUDED.ciphertext, updated_at = NOW()
       RETURNING version, salt, iv, ciphertext, updated_at`,
      [user.sub, version, salt, iv, ciphertext],
    );
    const backup = firstRow(result.rows);
    if (!backup) throw new Error("Backup upsert returned no row");
    return response(backup);
  } catch (error) {
    return internalError(error);
  }
}
