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
    /[\u0000-\u001f\u007f]/.test(nickname)
  ) {
    return null;
  }
  return nickname;
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
