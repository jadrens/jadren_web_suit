import { Code, ConnectError, createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AdminService, EditorService } from "@gen/jadren/v1/publishing_pb";
import { AuthService } from "@gen/jadren/v1/auth_pb";
import { LlmSettingsService, QuickLinkService, ReminderService } from "@gen/jadren/v1/account_pb";
import { ErrorDetailSchema } from "@gen/jadren/v1/common_pb";
import { DictionaryService, ToolsService } from "@gen/jadren/v1/tools_pb";
import { SentencePracticeService, VocabularyDrillService } from "@gen/jadren/v1/vocabulary_pb";
import { httpStatusOfCode } from "@lib/rpc/status";
import { ApiError } from "./http";

const RPC_BASE_URL = "/rpc";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface RpcAuthOptions {
  getAccessToken?: () => string | null;
  refreshAccessToken?: () => Promise<string | null>;
}

/** Surface RPC failures as ApiError so UI code can read status and application code. */
const apiErrorInterceptor: Interceptor = (next) => async (request) => {
  try {
    return await next(request);
  } catch (error) {
    if (!(error instanceof ConnectError) || error.code === Code.Canceled) throw error;
    const detail = error.findDetails(ErrorDetailSchema)[0];
    throw new ApiError(
      error.rawMessage,
      httpStatusOfCode(error.code),
      request.url,
      detail ? { code: detail.code } : null
    );
  }
};

/** Attach the bearer token and retry once after a refresh when the server rejects it. */
function authInterceptor({ getAccessToken, refreshAccessToken }: RpcAuthOptions): Interceptor {
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

function createTransport(interceptors: Interceptor[]) {
  return createConnectTransport({
    baseUrl: RPC_BASE_URL,
    useBinaryFormat: true,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    interceptors: [apiErrorInterceptor, ...interceptors],
  });
}

/** Clients for RPCs that need no session (login, registration, public tools). */
export function createAnonymousClients() {
  const transport = createTransport([]);
  return { auth: createClient(AuthService, transport) };
}

/** Clients for RPCs that carry the caller's session token. */
export function createRpcClients(options: RpcAuthOptions) {
  const transport = createTransport([authInterceptor(options)]);
  return {
    quickLinks: createClient(QuickLinkService, transport),
    reminders: createClient(ReminderService, transport),
    llmSettings: createClient(LlmSettingsService, transport),
    sentencePractice: createClient(SentencePracticeService, transport),
    vocabularyDrill: createClient(VocabularyDrillService, transport),
    dictionary: createClient(DictionaryService, transport),
    tools: createClient(ToolsService, transport),
    editor: createClient(EditorService, transport),
    admin: createClient(AdminService, transport),
  };
}
