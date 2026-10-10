import { ConnectError, createConnectRouter, type Interceptor } from "@connectrpc/connect";
import { createFetchHandler } from "@connectrpc/connect/protocol";
import { AdminService, EditorService } from "@gen/jadren/v1/publishing_pb";
import { AuthService } from "@gen/jadren/v1/auth_pb";
import { LlmSettingsService, QuickLinkService, ReminderService } from "@gen/jadren/v1/account_pb";
import { DictionaryService, ToolsService } from "@gen/jadren/v1/tools_pb";
import { SentencePracticeService, VocabularyDrillService } from "@gen/jadren/v1/vocabulary_pb";
import { internalFailure } from "./errors";
import { adminService, editorService } from "./services/publishing";
import { authService } from "./services/auth";
import { llmSettingsService, quickLinkService, reminderService } from "./services/account";
import { dictionaryService, toolsService } from "./services/tools";
import { sentencePracticeService, vocabularyDrillService } from "./services/vocabulary";

/** Anything that is not already an RPC error is logged and reported as INTERNAL. */
const errorBoundary: Interceptor = (next) => async (request) => {
  try {
    return await next(request);
  } catch (error) {
    throw error instanceof ConnectError ? error : internalFailure(error);
  }
};

function createHandlers() {
  const router = createConnectRouter({
    interceptors: [errorBoundary],
    // Next.js route handlers cannot expose HTTP trailers, so native gRPC is
    // unavailable; browsers and gRPC-Web proxies use the Connect or gRPC-Web protocols.
    grpc: false,
  });
  router.service(AuthService, authService);
  router.service(QuickLinkService, quickLinkService);
  router.service(ReminderService, reminderService);
  router.service(LlmSettingsService, llmSettingsService);
  router.service(SentencePracticeService, sentencePracticeService);
  router.service(VocabularyDrillService, vocabularyDrillService);
  router.service(DictionaryService, dictionaryService);
  router.service(ToolsService, toolsService);
  router.service(EditorService, editorService);
  router.service(AdminService, adminService);
  return new Map(router.handlers.map((handler) => [handler.requestPath, createFetchHandler(handler)]));
}

let handlers: ReturnType<typeof createHandlers> | undefined;

/** Resolve a fetch handler for "/<package.Service>/<Method>". */
export function rpcHandlerFor(path: string) {
  handlers ??= createHandlers();
  return handlers.get(path);
}
