import { NextResponse } from "next/server";
import { apiError, internalError } from "@tool/lib/auth/http";
import { bearerToken, verifyAccessToken } from "@tool/lib/auth/jwt";

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return apiError("Bearer token is required", 401, "token_required");

  try {
    const payload = await verifyAccessToken(token);
    return NextResponse.json({
      user: {
        userId: payload.sub,
        nickname: payload.nickname,
        email: payload.email,
        phone: payload.phone,
        registeredAt: payload.registeredAt,
        status: payload.status,
      },
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) {
      return internalError(error);
    }
    return apiError("Token is invalid or expired", 401, "invalid_token");
  }
}
