import { AdminService, EditorService } from "@gen/jadren/v1/publishing_pb";
import { LlmSettingsService, QuickLinkService, ReminderService } from "@gen/jadren/v1/account_pb";
import { DictionaryService, ToolsService } from "@gen/jadren/v1/tools_pb";
import { SentencePracticeService, VocabularyDrillService } from "@gen/jadren/v1/vocabulary_pb";
import { authInterceptor, createApiClient, createTransport, type RpcAuthOptions } from "./rpc-transport";

export { createAnonymousClients, type RpcAuthOptions } from "./rpc-transport";

/** Clients for RPCs that carry the caller's session token. */
export function createRpcClients(options: RpcAuthOptions) {
  const transport = createTransport([authInterceptor(options)]);
  return {
    quickLinks: createApiClient(QuickLinkService, transport),
    reminders: createApiClient(ReminderService, transport),
    llmSettings: createApiClient(LlmSettingsService, transport),
    sentencePractice: createApiClient(SentencePracticeService, transport),
    vocabularyDrill: createApiClient(VocabularyDrillService, transport),
    dictionary: createApiClient(DictionaryService, transport),
    tools: createApiClient(ToolsService, transport),
    editor: createApiClient(EditorService, transport),
    admin: createApiClient(AdminService, transport),
  };
}
