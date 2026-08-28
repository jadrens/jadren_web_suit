import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db, firstRow } from "@tool/lib/auth/db";
import { apiError, internalError, isUniqueViolation } from "@tool/lib/auth/http";
import {
  normalizeEmail,
  normalizeNickname,
  normalizePassword,
  normalizePhone,
} from "@tool/lib/auth/input";
import { toPublicUser, type UserRow } from "@tool/lib/auth/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid JSON body", 400, "invalid_json");
    }

    const nickname = normalizeNickname(body.nickname);
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const phone = normalizePhone(body.phone);

    if (!nickname) return apiError("Nickname must contain 2-50 characters", 400, "invalid_nickname");
    if (!email) return apiError("Invalid email address", 400, "invalid_email");
    if (!password) return apiError("Password must contain 8-72 characters", 400, "invalid_password");
    if (phone === undefined) return apiError("Invalid phone number", 400, "invalid_phone");

    const passwordBcrypt = await bcrypt.hash(password, 12);
    const result = await db.query<UserRow>(
      `INSERT INTO user_main
        (user_id, nickname, email, phone, password_bcrypt, status)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING user_id, nickname, email, phone, registered_at,
                 password_bcrypt, status`,
      [crypto.randomUUID(), nickname, email, phone, passwordBcrypt]
    );
    const user = firstRow(result.rows);
    if (!user) throw new Error("User insert returned no row");

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError("Nickname or email is already registered", 409, "duplicate_user");
    }
    return internalError(error);
  }
}
