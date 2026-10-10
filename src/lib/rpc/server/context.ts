import type { HandlerContext } from "@connectrpc/connect";

/** Auth and rate-limit helpers read request metadata through this minimal request shape. */
export function headersOf(context: HandlerContext) {
  return { headers: context.requestHeader };
}
