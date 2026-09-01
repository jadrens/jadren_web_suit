import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db, firstRow } from "@shared/libs/auth/db";
import { apiError, internalError } from "@shared/libs/auth/http";
import { createAccessToken, tokenMetadata } from "@shared/libs/auth/jwt";
import { normalizePassword } from "@shared/libs/auth/input";
import { toPublicUser, type UserRow } from "@shared/libs/auth/types";
import { requestIp } from "@shared/libs/auth/email-send-rate-limit";
import {
  consumeLoginAttempt,
  loginRateLimitWindowSeconds,
  resetLoginAttempts,
} from "@shared/libs/auth/login-rate-limit";

const DUMMY_PASSWORD_HASH =
  "$2b$12$n3eqVa2Tx2JgVVycl7yxjOGslU02wctWdDAsm3rKIgw7feQO5sH6O";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const identifier =
      typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = normalizePassword(body?.password);
    if (!identifier || !password) {
      return apiError("Identifier and password are required", 400, "missing_credentials");
    }

    const ip = requestIp(request);
    if (!consumeLoginAttempt(identifier, ip)) {
      const response = apiError(
        "Too many login attempts",
        429,
        "login_rate_limit"
      );
      response.headers.set("Retry-After", String(loginRateLimitWindowSeconds));
      return response;
    }

    const result = await db.query<UserRow>(
      `SELECT user_id, nickname, email, phone, registered_at,
              password_bcrypt, status
         FROM user_main
        WHERE nickname = $1 OR email = $2
        LIMIT 1`,
      [identifier, identifier.toLowerCase()]
    );
    const user = firstRow(result.rows);
    const passwordMatches = await bcrypt.compare(
      password,
      user?.password_bcrypt ?? DUMMY_PASSWORD_HASH
    );
    if (!user || !passwordMatches) {
      return apiError("Invalid credentials", 401, "invalid_credentials");
    }
    resetLoginAttempts(identifier, ip);
    if (user.status === 2) {
      return apiError("Account is unavailable", 403, "account_unavailable");
    }

    const publicUser = toPublicUser(user);
    const accessToken = await createAccessToken(publicUser);
    return NextResponse.json({ accessToken, ...tokenMetadata, user: publicUser });
  } catch (error) {
    return internalError(error);
  }
}
