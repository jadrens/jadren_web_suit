import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import type { ServiceImpl } from "@connectrpc/connect";
import type { AuthService } from "@gen/jadren/v1/auth_pb";
import { db, firstRow, withTransaction } from "@lib/auth/db";
import { createAccessToken, bearerToken, tokenMetadata, verifyAccessToken, verifyRefreshableToken } from "@lib/auth/jwt";
import { isVerificationCode, normalizeEmail, normalizeNickname, normalizePassword, normalizePhone } from "@lib/auth/input";
import { toPublicUser, type PublicUser, type UserRow } from "@lib/auth/types";
import { requestIp, validateEmailSend } from "@lib/auth/email-send-rate-limit";
import { consumeLoginAttempt, loginRateLimitWindowSeconds, resetLoginAttempts } from "@lib/auth/login-rate-limit";
import { sendVerificationEmail } from "@lib/auth/mailer";
import { apiFailure, isUniqueViolation } from "../errors";
import { headersOf } from "../context";

const DUMMY_PASSWORD_HASH =
  "$2b$12$n3eqVa2Tx2JgVVycl7yxjOGslU02wctWdDAsm3rKIgw7feQO5sH6O";
const CODE_LIFETIME_MINUTES = 10;

const USER_COLUMNS = `user_id, nickname, email, phone, registered_at,
              password_bcrypt, status`;

function userMessage(user: PublicUser) {
  return { ...user, phone: user.phone ?? undefined };
}

async function tokenResponse(user: UserRow) {
  const publicUser = toPublicUser(user);
  return {
    accessToken: await createAccessToken(publicUser),
    ...tokenMetadata,
    user: userMessage(publicUser),
  };
}

class VerificationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export const authService: ServiceImpl<typeof AuthService> = {
  async register(request) {
    const nickname = normalizeNickname(request.nickname);
    const email = normalizeEmail(request.email);
    const password = normalizePassword(request.password);
    const phone = normalizePhone(request.phone);

    if (!nickname) throw apiFailure("Nickname must contain 2-50 characters", 400, "invalid_nickname");
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");
    if (!password) throw apiFailure("Password must contain 8-72 characters", 400, "invalid_password");
    if (phone === undefined) throw apiFailure("Invalid phone number", 400, "invalid_phone");

    const passwordBcrypt = await bcrypt.hash(password, 12);
    try {
      const result = await db.query<UserRow>(
        `INSERT INTO user_main
          (user_id, nickname, email, phone, password_bcrypt, status)
         VALUES ($1, $2, $3, $4, $5, 0)
         RETURNING ${USER_COLUMNS}`,
        [crypto.randomUUID(), nickname, email, phone, passwordBcrypt]
      );
      const user = firstRow(result.rows);
      if (!user) throw new Error("User insert returned no row");
      return { user: userMessage(toPublicUser(user)) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw apiFailure("Nickname or email is already registered", 409, "duplicate_user");
      }
      throw error;
    }
  },

  async login(request, context) {
    const identifier = request.identifier.trim();
    const password = normalizePassword(request.password);
    if (!identifier || !password) {
      throw apiFailure("Identifier and password are required", 400, "missing_credentials");
    }

    const ip = requestIp(headersOf(context));
    if (!consumeLoginAttempt(identifier, ip)) {
      const failure = apiFailure("Too many login attempts", 429, "login_rate_limit");
      failure.metadata.set("Retry-After", String(loginRateLimitWindowSeconds));
      throw failure;
    }

    const result = await db.query<UserRow>(
      `SELECT ${USER_COLUMNS}
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
      throw apiFailure("Invalid credentials", 401, "invalid_credentials");
    }
    resetLoginAttempts(identifier, ip);
    if (user.status === 2) {
      throw apiFailure("Account is unavailable", 403, "account_unavailable");
    }
    return tokenResponse(user);
  },

  async refresh(request, context) {
    const token = bearerToken(headersOf(context)) ?? (request.token || null);
    if (!token) throw apiFailure("Token is required", 400, "token_required");

    let payload;
    try {
      payload = await verifyRefreshableToken(token);
    } catch {
      throw apiFailure("Token is invalid or outside the refresh window", 401, "invalid_refresh_token");
    }

    const result = await db.query<UserRow>(
      `SELECT ${USER_COLUMNS}
         FROM user_main
        WHERE user_id = $1
        LIMIT 1`,
      [payload.sub]
    );
    const user = firstRow(result.rows);
    if (!user) throw apiFailure("User no longer exists", 401, "user_not_found");
    if (user.status === 2) throw apiFailure("Account is unavailable", 403, "account_unavailable");
    return tokenResponse(user);
  },

  async me(_request, context) {
    const token = bearerToken(headersOf(context));
    if (!token) throw apiFailure("Bearer token is required", 401, "token_required");
    try {
      const payload = await verifyAccessToken(token);
      return {
        user: userMessage({
          userId: payload.sub,
          nickname: payload.nickname,
          email: payload.email,
          phone: payload.phone,
          registeredAt: payload.registeredAt,
          status: payload.status,
        }),
        issuedAt: BigInt(payload.iat ?? 0),
        expiresAt: BigInt(payload.exp ?? 0),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
      throw apiFailure("Token is invalid or expired", 401, "invalid_token");
    }
  },

  async sendVerificationCode(request, context) {
    const email = normalizeEmail(request.email);
    const locale = request.locale === "zh" ? "zh" : "en";
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");

    const userResult = await db.query<UserRow>(
      `SELECT ${USER_COLUMNS}
         FROM user_main
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    const user = firstRow(userResult.rows);
    if (!user) throw apiFailure("User was not found", 404, "user_not_found");
    if (user.status === 1) throw apiFailure("Email is already verified", 409, "email_already_verified");
    if (user.status === 2) throw apiFailure("Account is unavailable", 403, "account_unavailable");
    if (!validateEmailSend(email, requestIp(headersOf(context)))) {
      throw apiFailure("Verification email rate limit exceeded", 429, "verification_rate_limit");
    }

    const code = randomInt(100_000, 1_000_000).toString();
    const codeBcrypt = await bcrypt.hash(code, 10);
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + CODE_LIFETIME_MINUTES * 60 * 1000);
    await db.query(
      `INSERT INTO email_verification_code (email, code_bcrypt, expire_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET code_bcrypt = EXCLUDED.code_bcrypt,
             expire_at = EXCLUDED.expire_at`,
      [email, codeBcrypt, expiresAt]
    );
    await sendVerificationEmail(user.user_id, email, code, locale);

    return {
      message: "verification code generated",
      expiresIn: CODE_LIFETIME_MINUTES * 60,
      sentAt: sentAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  },

  async verifyEmail(request) {
    const email = normalizeEmail(request.email);
    const code = request.code;
    if (!email || !isVerificationCode(code)) {
      throw apiFailure("A valid email and 6-digit code are required", 400, "invalid_verification_input");
    }

    try {
      const user = await withTransaction(async (client) => {
        const codeResult = await client.query<{ email: string; code_bcrypt: string; expire_at: Date }>(
          `SELECT email, code_bcrypt, expire_at
             FROM email_verification_code
            WHERE email = $1
            FOR UPDATE`,
          [email]
        );
        const verification = firstRow(codeResult.rows);
        if (!verification) throw new VerificationError("Invalid code", "invalid_verification_code");
        if (verification.expire_at.getTime() <= Date.now()) {
          throw new VerificationError("Verification code has expired", "verification_code_expired");
        }
        if (!(await bcrypt.compare(code, verification.code_bcrypt))) {
          throw new VerificationError("Invalid code", "invalid_verification_code");
        }

        const userResult = await client.query<UserRow>(
          `UPDATE user_main
              SET status = 1
            WHERE email = $1 AND status = 0
            RETURNING ${USER_COLUMNS}`,
          [email]
        );
        const updatedUser = firstRow(userResult.rows);
        if (!updatedUser) throw new VerificationError("Account cannot be verified", "account_cannot_verify");
        await client.query("DELETE FROM email_verification_code WHERE email = $1", [email]);
        return updatedUser;
      });
      return { message: "Email verified", user: userMessage(toPublicUser(user)) };
    } catch (error) {
      if (error instanceof VerificationError) {
        throw apiFailure(
          error.message,
          error.code === "account_cannot_verify" ? 409 : 400,
          error.code
        );
      }
      throw error;
    }
  },
};
