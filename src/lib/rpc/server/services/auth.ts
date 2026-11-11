import bcrypt from "bcryptjs";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import type { AuthService } from "@gen/jadren/v1/auth_pb";
import { db, firstRow, withTransaction, type QueryClient } from "@lib/auth/db";
import { ACCESS_TOKEN_SECONDS, bearerToken, createAccessToken, verifyAccessToken } from "@lib/auth/jwt";
import { defaultNicknameCandidates, isVerificationCode, normalizeEmail, normalizeNickname, normalizePassword, normalizePhone } from "@lib/auth/input";
import { toPublicUser, type PublicUser, type UserRow } from "@lib/auth/types";
import { requestIp, validateEmailSend } from "@lib/auth/email-send-rate-limit";
import { consumeLoginAttempt, loginRateLimitWindowSeconds, resetLoginAttempts } from "@lib/auth/login-rate-limit";
import { CODE_LIFETIME_MINUTES, consumeEmailCode, EmailCodeError, issueEmailCode } from "@lib/auth/email-codes";
import {
  clearedRefreshCookie,
  createSession,
  readRefreshCookie,
  refreshCookie,
  revokeSessionByToken,
  revokeUserSessions,
  rotateSession,
  type SessionGrant,
} from "@lib/auth/sessions";
import { apiFailure } from "../errors";
import { headersOf } from "../context";

const DUMMY_PASSWORD_HASH =
  "$2b$12$n3eqVa2Tx2JgVVycl7yxjOGslU02wctWdDAsm3rKIgw7feQO5sH6O";

const USER_COLUMNS = `user_id, nickname, email, phone, registered_at,
              password_bcrypt, status`;

function userMessage(user: PublicUser) {
  return { ...user, phone: user.phone ?? undefined };
}

/** Issues an access token for `session` and, when it rotated, sets the refresh cookie. */
async function tokenResponse(user: UserRow, session: SessionGrant, context: HandlerContext) {
  if (session.token) {
    context.responseHeader.append("Set-Cookie", refreshCookie(session.token, session.expiresAt, context.requestHeader));
  }
  const publicUser = toPublicUser(user);
  return {
    accessToken: await createAccessToken(publicUser, session.sessionId),
    tokenType: "Bearer",
    expiresIn: ACCESS_TOKEN_SECONDS,
    refreshWindow: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)),
    user: userMessage(publicUser),
  };
}

async function startSession(user: UserRow, context: HandlerContext) {
  const session = await createSession(user.user_id, context.requestHeader.get("user-agent"));
  return tokenResponse(user, session, context);
}

const CODE_FAILURES = {
  invalid_verification_code: ["The verification code is incorrect", 400],
  verification_code_expired: ["The verification code has expired", 400],
  verification_attempts_exceeded: ["Too many incorrect codes; request a new one", 429],
} as const;

/** Maps e-mail code failures to RPC errors; anything else is rethrown. */
function codeFailure(error: unknown): never {
  if (error instanceof EmailCodeError) {
    const [message, status] = CODE_FAILURES[error.code];
    throw apiFailure(message, status, error.code);
  }
  throw error;
}

function sendLocale(locale: string) {
  return locale === "zh" ? "zh" : "en";
}

function codeSentResponse(sentAt: Date, expiresAt: Date) {
  return {
    message: "verification code generated",
    expiresIn: CODE_LIFETIME_MINUTES * 60,
    sentAt: sentAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function enforceEmailSendLimit(email: string, context: HandlerContext) {
  if (!validateEmailSend(email, requestIp(headersOf(context)))) {
    throw apiFailure("Verification email rate limit exceeded", 429, "verification_rate_limit");
  }
}

/** The first nickname in `candidates` that nobody uses yet. */
async function firstFreeNickname(client: QueryClient, candidates: string[]) {
  const placeholders = candidates.map((_, index) => `$${index + 1}`).join(", ");
  const taken = new Set(
    (await client.query<{ nickname: string }>(
      `SELECT nickname FROM user_main WHERE nickname IN (${placeholders})`,
      candidates
    )).rows.map((row) => row.nickname)
  );
  return candidates.find((candidate) => !taken.has(candidate)) ?? null;
}

async function userByEmail(email: string) {
  return firstRow(
    (await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM user_main WHERE email = $1 LIMIT 1`, [email])).rows
  );
}

export const authService: ServiceImpl<typeof AuthService> = {
  async sendRegistrationCode(request, context) {
    const email = normalizeEmail(request.email);
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");
    // Only an unverified (status 0) account may be replaced by a new sign-up.
    const existing = await userByEmail(email);
    if (existing && existing.status !== 0) {
      throw apiFailure("Nickname or email is already registered", 409, "duplicate_user");
    }
    enforceEmailSendLimit(email, context);
    const { sentAt, expiresAt } = await issueEmailCode({
      email,
      purpose: "register",
      locale: sendLocale(request.locale),
      userId: null,
    });
    return codeSentResponse(sentAt, expiresAt);
  },

  async register(request, context) {
    const email = normalizeEmail(request.email);
    const password = normalizePassword(request.password);
    const phone = normalizePhone(request.phone);
    // An empty nickname defaults to the email's local part.
    const nicknameProvided = (request.nickname ?? "").trim() !== "";
    const nickname = nicknameProvided ? normalizeNickname(request.nickname) : null;

    if (nicknameProvided && !nickname) throw apiFailure("Nickname must contain 2-50 characters and no @", 400, "invalid_nickname");
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");
    if (!password) throw apiFailure("Password must contain 8-72 characters", 400, "invalid_password");
    if (phone === undefined) throw apiFailure("Invalid phone number", 400, "invalid_phone");
    if (!isVerificationCode(request.code)) {
      throw apiFailure("A valid 6-digit code is required", 400, "invalid_verification_input");
    }

    const passwordBcrypt = await bcrypt.hash(password, 12);
    const user = await withTransaction(async (client) => {
      await consumeEmailCode(client, email, "register", request.code).catch(codeFailure);

      // Proving the inbox outranks an earlier, never-verified sign-up for the
      // same address, so that one is discarded instead of blocking the owner.
      const existing = firstRow(
        (await client.query<{ status: number }>(
          "SELECT status FROM user_main WHERE email = $1 FOR UPDATE",
          [email]
        )).rows
      );
      if (existing && existing.status !== 0) {
        throw apiFailure("Nickname or email is already registered", 409, "duplicate_user");
      }
      if (existing) await client.query("DELETE FROM user_main WHERE email = $1 AND status = 0", [email]);

      const chosen = await firstFreeNickname(client, nickname ? [nickname] : defaultNicknameCandidates(email));
      if (!chosen) throw apiFailure("Nickname or email is already registered", 409, "duplicate_user");

      const inserted = firstRow(
        (await client.query<UserRow>(
          `INSERT INTO user_main
            (user_id, nickname, email, phone, password_bcrypt, status)
           VALUES ($1, $2, $3, $4, $5, 1)
           RETURNING ${USER_COLUMNS}`,
          [crypto.randomUUID(), chosen, email, phone, passwordBcrypt]
        )).rows
      );
      if (!inserted) throw new Error("User insert returned no row");
      return inserted;
    });
    return startSession(user, context);
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

    // Nicknames cannot contain "@", so the identifier names exactly one column.
    const byEmail = identifier.includes("@");
    const result = await db.query<UserRow>(
      `SELECT ${USER_COLUMNS}
         FROM user_main
        WHERE ${byEmail ? "email" : "nickname"} = $1
        LIMIT 1`,
      [byEmail ? identifier.toLowerCase() : identifier]
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
    return startSession(user, context);
  },

  async refresh(_request, context) {
    const token = readRefreshCookie(context.requestHeader);
    const session = token ? await rotateSession(token) : null;
    if (!session) {
      context.responseHeader.append("Set-Cookie", clearedRefreshCookie(context.requestHeader));
      throw apiFailure("The session is invalid or has expired", 401, "invalid_refresh_token");
    }

    const user = firstRow(
      (await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM user_main WHERE user_id = $1 LIMIT 1`, [session.userId])).rows
    );
    if (!user || user.status === 2) {
      await revokeUserSessions(session.userId);
      context.responseHeader.append("Set-Cookie", clearedRefreshCookie(context.requestHeader));
      throw user
        ? apiFailure("Account is unavailable", 403, "account_unavailable")
        : apiFailure("User no longer exists", 401, "user_not_found");
    }
    return tokenResponse(user, session, context);
  },

  async logout(_request, context) {
    const token = readRefreshCookie(context.requestHeader);
    if (token) await revokeSessionByToken(token);
    context.responseHeader.append("Set-Cookie", clearedRefreshCookie(context.requestHeader));
    return {};
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
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");

    const user = await userByEmail(email);
    if (!user) throw apiFailure("User was not found", 404, "user_not_found");
    if (user.status === 1) throw apiFailure("Email is already verified", 409, "email_already_verified");
    if (user.status === 2) throw apiFailure("Account is unavailable", 403, "account_unavailable");
    enforceEmailSendLimit(email, context);

    const { sentAt, expiresAt } = await issueEmailCode({
      email,
      purpose: "verify",
      locale: sendLocale(request.locale),
      userId: user.user_id,
    });
    return codeSentResponse(sentAt, expiresAt);
  },

  async verifyEmail(request) {
    const email = normalizeEmail(request.email);
    const code = request.code;
    if (!email || !isVerificationCode(code)) {
      throw apiFailure("A valid email and 6-digit code are required", 400, "invalid_verification_input");
    }

    const user = await withTransaction(async (client) => {
      await consumeEmailCode(client, email, "verify", code).catch(codeFailure);
      const updated = firstRow(
        (await client.query<UserRow>(
          `UPDATE user_main
              SET status = 1
            WHERE email = $1 AND status = 0
            RETURNING ${USER_COLUMNS}`,
          [email]
        )).rows
      );
      if (!updated) throw apiFailure("Account cannot be verified", 409, "account_cannot_verify");
      return updated;
    });
    return { message: "Email verified", user: userMessage(toPublicUser(user)) };
  },

  async sendPasswordResetCode(request, context) {
    const email = normalizeEmail(request.email);
    if (!email) throw apiFailure("Invalid email address", 400, "invalid_email");
    enforceEmailSendLimit(email, context);

    // The response is identical whether or not the account exists.
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + CODE_LIFETIME_MINUTES * 60_000);
    const user = await userByEmail(email);
    if (user && user.status !== 2) {
      const sent = await issueEmailCode({
        email,
        purpose: "reset",
        locale: sendLocale(request.locale),
        userId: user.user_id,
      });
      return codeSentResponse(sent.sentAt, sent.expiresAt);
    }
    return codeSentResponse(sentAt, expiresAt);
  },

  async resetPassword(request, context) {
    const email = normalizeEmail(request.email);
    const password = normalizePassword(request.newPassword);
    if (!email || !isVerificationCode(request.code)) {
      throw apiFailure("A valid email and 6-digit code are required", 400, "invalid_verification_input");
    }
    if (!password) throw apiFailure("Password must contain 8-72 characters", 400, "invalid_password");

    const passwordBcrypt = await bcrypt.hash(password, 12);
    const user = await withTransaction(async (client) => {
      await consumeEmailCode(client, email, "reset", request.code).catch(codeFailure);
      // Receiving the code proves the inbox, so an unverified account becomes verified.
      const updated = firstRow(
        (await client.query<UserRow>(
          `UPDATE user_main
              SET password_bcrypt = $2,
                  status = CASE WHEN status = 0 THEN 1 ELSE status END
            WHERE email = $1 AND status <> 2
            RETURNING ${USER_COLUMNS}`,
          [email, passwordBcrypt]
        )).rows
      );
      if (!updated) throw apiFailure("The verification code is incorrect", 400, "invalid_verification_code");
      return updated;
    });

    // Whoever knew the old password is signed out everywhere.
    await revokeUserSessions(user.user_id);
    return startSession(user, context);
  },
};
