import { NextResponse } from "next/server";

export function apiError(message: string, status: number, code = "request_error") {
  return NextResponse.json(
    { error: message, error_msg: message, code },
    { status }
  );
}

export function internalError(error: unknown) {
  console.error(error);
  return apiError("Internal server error", 500, "internal_error");
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
