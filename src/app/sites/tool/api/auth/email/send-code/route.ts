import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db, firstRow } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import { normalizeEmail } from "@tool/lib/auth/input";
import { sendVerificationEmail } from "@tool/lib/auth/mailer";
import {
  requestIp,
  validateEmailSend,
} from "@tool/lib/auth/email-send-rate-limit";
import type { UserRow } from "@tool/lib/auth/types";

const CODE_LIFETIME_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const locale = body?.locale === "zh" ? "zh" : "en";
    if (!email) return apiError("Invalid email address", 400, "invalid_email");

    const userResult = await db.query<UserRow>(
      `SELECT user_id, nickname, email, phone, registered_at,
              password_bcrypt, status
         FROM user_main
        WHERE email = $1
        LIMIT 1`,
      [email]
    );
    const user = firstRow(userResult.rows);
    if (!user) return apiError("User was not found", 404, "user_not_found");
    if (user.status === 1) return apiError("Email is already verified", 409, "email_already_verified");
    if (user.status === 2) return apiError("Account is unavailable", 403, "account_unavailable");
    if (!validateEmailSend(email, requestIp(request))) {
      return apiError("Verification email rate limit exceeded", 429, "verification_rate_limit");
    }

    const code = randomInt(100_000, 1_000_000).toString();
    const codeBcrypt = await bcrypt.hash(code, 10);
    const sentAt = new Date();
    const expiresAt = new Date(
      sentAt.getTime() + CODE_LIFETIME_MINUTES * 60 * 1000
    );
    await db.query(
      `INSERT INTO email_verification_code (email, code_bcrypt, expire_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET code_bcrypt = EXCLUDED.code_bcrypt,
             expire_at = EXCLUDED.expire_at`,
      [email, codeBcrypt, expiresAt]
    );
    await sendVerificationEmail(user.user_id, email, code, locale);

    return NextResponse.json({
      message: "verification code generated",
      expiresIn: CODE_LIFETIME_MINUTES * 60,
      sentAt: sentAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return internalError(error);
  }
}
