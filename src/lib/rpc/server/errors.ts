import { Code, ConnectError } from "@connectrpc/connect";
import { ErrorDetailSchema } from "@gen/jadren/v1/common_pb";
import { codeOfHttpStatus } from "../status";

/**
 * Build the RPC failure for a REST-style (message, HTTP status, app code)
 * triple. The app code travels in an ErrorDetail so clients can branch on it.
 */
export function apiFailure(
  message: string,
  status: number,
  code = "request_error",
  rpcCode: Code = codeOfHttpStatus(status),
) {
  return new ConnectError(message, rpcCode, undefined, [
    { desc: ErrorDetailSchema, value: { code } },
  ]);
}

export function internalFailure(error: unknown) {
  console.error(error);
  return apiFailure("Internal server error", 500, "internal_error");
}

export function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
