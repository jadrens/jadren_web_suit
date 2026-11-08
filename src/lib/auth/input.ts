export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function normalizeNickname(value: unknown) {
  if (typeof value !== "string") return null;
  const nickname = value.trim();
  if (
    nickname.length < 2 ||
    nickname.length > 50 ||
    /[\u0000-\u001f\u007f]/.test(nickname) ||
    // Sign-in treats any identifier containing "@" as an email address.
    nickname.includes("@")
  ) {
    return null;
  }
  return nickname;
}

const NICKNAME_MAX = 50;
const DEFAULT_NICKNAME_ATTEMPTS = 20;

/**
 * Nicknames to try, in order, when the user leaves the nickname empty: the
 * email's local part, then the same with a numeric suffix (`jadren2`,
 * `jadren3`, ...) because nicknames are unique and also used to sign in. A
 * one-character local part starts at the suffixed form to meet the minimum
 * length. The last candidate carries a random suffix as a final fallback.
 */
export function defaultNicknameCandidates(email: string): string[] {
  const local = email.slice(0, email.lastIndexOf("@")).replace(/[\u0000-\u001f\u007f]/g, "");
  const base = local.slice(0, NICKNAME_MAX) || "user";
  const withSuffix = (suffix: string) => base.slice(0, NICKNAME_MAX - suffix.length) + suffix;

  const candidates: string[] = [];
  if (base.length >= 2) candidates.push(base);
  for (let n = 2; candidates.length < DEFAULT_NICKNAME_ATTEMPTS - 1; n += 1) {
    candidates.push(withSuffix(String(n)));
  }
  candidates.push(withSuffix(String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0")));
  return candidates;
}

export function normalizePassword(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    new TextEncoder().encode(value).length > 72
  ) {
    return null;
  }
  return value;
}

export function normalizePhone(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const phone = value.trim();
  if (phone.length > 32 || !/^\+?[0-9 ()-]{5,32}$/.test(phone)) {
    return undefined;
  }
  return phone;
}

export function isVerificationCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}
