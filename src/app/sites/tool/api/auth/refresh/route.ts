import { NextResponse } from "next/server";
import { db, firstRow } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import {
  bearerToken,
  createAccessToken,
  tokenMetadata,
  verifyRefreshableToken,
} from "@tool/lib/auth/jwt";
import { toPublicUser, type UserRow } from "@tool/lib/auth/types";

export async function POST(request: Request) {
  try {
    let token = bearerToken(request);
    if (!token) {
      const body = await request.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token : null;
    }
    if (!token) return apiError("Token is required", 400, "token_required");

    let payload;
    try {
      payload = await verifyRefreshableToken(token);
    } catch {
      return apiError("Token is invalid or outside the refresh window", 401, "invalid_refresh_token");
    }

    const result = await db.query<UserRow>(
      `SELECT user_id, nickname, email, phone, registered_at,
              password_bcrypt, status
         FROM user_main
        WHERE user_id = $1
        LIMIT 1`,
      [payload.sub]
    );
    const user = firstRow(result.rows);
    if (!user) return apiError("User no longer exists", 401, "user_not_found");
    if (user.status === 2) return apiError("Account is unavailable", 403, "account_unavailable");

    const publicUser = toPublicUser(user);
    const accessToken = await createAccessToken(publicUser);
    return NextResponse.json({ accessToken, ...tokenMetadata, user: publicUser });
  } catch (error) {
    return internalError(error);
  }
}
