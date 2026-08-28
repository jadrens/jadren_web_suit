import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { withTransaction, firstRow } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import { isVerificationCode, normalizeEmail } from "@tool/lib/auth/input";
import { toPublicUser, type UserRow } from "@tool/lib/auth/types";

interface VerificationRow {
  email: string;
  code_bcrypt: string;
  expire_at: Date;
}

class VerificationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const code = body?.code;
    if (!email || !isVerificationCode(code)) {
      return apiError("A valid email and 6-digit code are required", 400, "invalid_verification_input");
    }

    const user = await withTransaction(async (client) => {
      const codeResult = await client.query<VerificationRow>(
        `SELECT email, code_bcrypt, expire_at
           FROM email_verification_code
          WHERE email = $1
          FOR UPDATE`,
        [email]
      );
      const verification = firstRow(codeResult.rows);
      if (!verification) {
        throw new VerificationError("Invalid code", 400, "invalid_verification_code");
      }
      if (verification.expire_at.getTime() <= Date.now()) {
        throw new VerificationError(
          "Verification code has expired",
          400,
          "verification_code_expired"
        );
      }
      if (!(await bcrypt.compare(code, verification.code_bcrypt))) {
        throw new VerificationError("Invalid code", 400, "invalid_verification_code");
      }

      const userResult = await client.query<UserRow>(
        `UPDATE user_main
            SET status = 1
          WHERE email = $1 AND status = 0
          RETURNING user_id, nickname, email, phone, registered_at,
                    password_bcrypt, status`,
        [email]
      );
      const updatedUser = firstRow(userResult.rows);
      if (!updatedUser) {
        throw new VerificationError(
          "Account cannot be verified",
          409,
          "account_cannot_verify"
        );
      }
      await client.query(
        "DELETE FROM email_verification_code WHERE email = $1",
        [email]
      );
      return updatedUser;
    });

    return NextResponse.json({
      message: "Email verified",
      user: toPublicUser(user),
    });
  } catch (error) {
    if (error instanceof VerificationError) {
      return apiError(error.message, error.status, error.code);
    }
    return internalError(error);
  }
}
