import { ApiError } from "@tool/lib/client-api";

export function authErrorMessage(
  error: unknown,
  translations: Record<string, string>
) {
  if (error instanceof ApiError) {
    return (error.code && translations[error.code]) || translations.internal_error;
  }
  return translations.network_error ?? translations.internal_error;
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validPassword(password: string) {
  const bytes = new TextEncoder().encode(password).length;
  return password.length >= 8 && bytes <= 72;
}
