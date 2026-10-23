// Kept free of the per-service schemas so the auth session (loaded on every page)
// does not pull every generated *_pb module into the shared bundle.
import type { DescService } from "@bufbuild/protobuf";
import { Code, ConnectError, createClient, type Client, type Interceptor, type Transport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AuthService } from "@gen/jadren/v1/auth_pb";
import { ErrorDetailSchema } from "@gen/jadren/v1/common_pb";
import { httpStatusOfCode } from "@lib/rpc/status";
import { ApiError } from "./http";

const RPC_BASE_URL = "/rpc";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface RpcAuthOptions {
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

/** Surface RPC failures as ApiError so UI code can read status and application code. */
function toApiError(error: unknown, url: string) {
  if (!(error instanceof ConnectError) || error.code === Code.Canceled) return error;
  const detail = error.findDetails(ErrorDetailSchema)[0];
  return new ApiError(
    error.rawMessage,
    httpStatusOfCode(error.code),
    url,
    detail ? { code: detail.code } : null
  );
}

/**
 * createClient with failures mapped to ApiError. This cannot live in an interceptor:
 * Connect re-wraps anything an interceptor throws in a ConnectError (code "unknown").
 */
export function createApiClient<T extends DescService>(service: T, transport: Transport): Client<T> {
  const client = createClient(service, transport) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  const wrapped: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  for (const method of service.methods) {
    const url = `${RPC_BASE_URL}/${service.typeName}/${method.name}`;
    wrapped[method.localName] = async (...args) => {
      try {
        return await client[method.localName](...args);
      } catch (error) {
        throw toApiError(error, url);
      }
    };
  }
  return wrapped as unknown as Client<T>;
}

/** Attach the bearer token and retry once after a refresh when the server rejects it. */
export function authInterceptor({ getAccessToken, refreshAccessToken }: RpcAuthOptions): Interceptor {
  return (next) => async (request) => {
    const send = async (retry: boolean): Promise<Awaited<ReturnType<typeof next>>> => {
      const token = getAccessToken?.();
      if (token) request.header.set("Authorization", `Bearer ${token}`);
      try {
        return await next(request);
      } catch (error) {
        if (retry && refreshAccessToken && error instanceof ConnectError && error.code === Code.Unauthenticated) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return send(false);
        }
        throw error;
      }
    };
    return send(true);
  };
}

export function createTransport(interceptors: Interceptor[]) {
  return createConnectTransport({
    baseUrl: RPC_BASE_URL,
    useBinaryFormat: true,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    interceptors,
  });
}

/** Clients for RPCs that need no session (login, registration, public tools). */
export function createAnonymousClients() {
  const transport = createTransport([]);
  return { auth: createApiClient(AuthService, transport) };
}
