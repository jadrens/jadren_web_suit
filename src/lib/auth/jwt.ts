import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { PublicUser } from "./types";

// Short-lived: a leaked access token is useful only briefly, and a revoked or
// banned session stops working within this window. Sessions are renewed through
// the HttpOnly refresh cookie (see sessions.ts).
export const ACCESS_TOKEN_SECONDS = 15 * 60;
const JWT_ISSUER = "dra-tool";
const JWT_AUDIENCE = "dra-tool-api";

interface UserTokenPayload extends JWTPayload {
  sub: string;
  /** auth_session.session_id */
  sid: string;
  nickname: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  status: 0 | 1 | 2;
}

function jwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(user: PublicUser, sessionId: string) {
  return new SignJWT({
    sid: sessionId,
    nickname: user.nickname,
    email: user.email,
    phone: user.phone,
    registeredAt: user.registeredAt,
    status: user.status,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
    .sign(jwtKey());
}

function assertUserPayload(payload: JWTPayload): UserTokenPayload {
  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    typeof payload.nickname !== "string" ||
    typeof payload.email !== "string" ||
    (payload.phone !== null && typeof payload.phone !== "string") ||
    typeof payload.registeredAt !== "string" ||
    ![0, 1, 2].includes(payload.status as number)
  ) {
    throw new Error("Invalid token payload");
  }
  return payload as UserTokenPayload;
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, jwtKey(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return assertUserPayload(payload);
}

export function bearerToken(request: { headers: Headers }) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}
