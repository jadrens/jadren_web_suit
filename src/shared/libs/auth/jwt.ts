import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { PublicUser } from "./types";

const ACCESS_TOKEN_SECONDS = 24 * 60 * 60;
const REFRESH_WINDOW_SECONDS = 16 * 24 * 60 * 60;
const JWT_ISSUER = "dra-tool";
const JWT_AUDIENCE = "dra-tool-api";

interface UserTokenPayload extends JWTPayload {
  sub: string;
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

export async function createAccessToken(user: PublicUser) {
  return new SignJWT({
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

export async function verifyRefreshableToken(token: string) {
  const { payload } = await jwtVerify(token, jwtKey(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    clockTolerance: REFRESH_WINDOW_SECONDS,
  });
  const userPayload = assertUserPayload(payload);
  const now = Math.floor(Date.now() / 1000);
  if (!userPayload.iat || now - userPayload.iat > REFRESH_WINDOW_SECONDS) {
    throw new Error("Token refresh window has expired");
  }
  return userPayload;
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export const tokenMetadata = {
  tokenType: "Bearer",
  expiresIn: ACCESS_TOKEN_SECONDS,
  refreshWindow: REFRESH_WINDOW_SECONDS,
} as const;
