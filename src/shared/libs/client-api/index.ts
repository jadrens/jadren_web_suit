import { AuthSessionManager } from "./auth-session";
import { ApiClient } from "./http";

export const authSession = new AuthSessionManager();

export const apiClient = new ApiClient({
  getAccessToken: authSession.getAccessToken,
  refreshAccessToken: authSession.refreshAccessToken,
});

export const quickLinksApi = {
  list: () =>
    apiClient.get<import("./types").QuickLinkListResponse>("/api/quick-links"),
  create: (input: import("./types").CreateQuickLinkRequest) =>
    apiClient.post<
      import("./types").CreateQuickLinkResponse,
      import("./types").CreateQuickLinkRequest
    >("/api/quick-links", input),
  update: (
    shortName: string,
    input: import("./types").UpdateQuickLinkRequest
  ) =>
    apiClient.patch<
      import("./types").CreateQuickLinkResponse,
      import("./types").UpdateQuickLinkRequest
    >(`/api/quick-links/${encodeURIComponent(shortName)}`, input),
  delete: (shortName: string) =>
    apiClient.delete<void>(
      `/api/quick-links/${encodeURIComponent(shortName)}`
    ),
};

export const remindersApi = {
  list: () =>
    apiClient.get<import("./types").ReminderListResponse>("/api/reminders"),
  create: (input: import("./types").CreateReminderRequest) =>
    apiClient.post<
      import("./types").ReminderResponse,
      import("./types").CreateReminderRequest
    >("/api/reminders", input),
  setStatus: (reminderId: string, status: "active" | "paused") =>
    apiClient.patch<
      import("./types").ReminderResponse,
      { status: "active" | "paused" }
    >(`/api/reminders/${encodeURIComponent(reminderId)}`, { status }),
  updateSchedule: (
    reminderId: string,
    input: import("./types").UpdateReminderScheduleRequest
  ) =>
    apiClient.patch<
      import("./types").ReminderResponse,
      import("./types").UpdateReminderScheduleRequest
    >(`/api/reminders/${encodeURIComponent(reminderId)}`, input),
  updateContent: (
    reminderId: string,
    input: import("./types").UpdateReminderContentRequest
  ) =>
    apiClient.patch<
      import("./types").ReminderResponse,
      import("./types").UpdateReminderContentRequest
    >(`/api/reminders/${encodeURIComponent(reminderId)}`, input),
  reactivate: (reminderId: string, remindAt: string) =>
    apiClient.patch<
      import("./types").ReminderResponse,
      import("./types").ReactivateReminderRequest
    >(`/api/reminders/${encodeURIComponent(reminderId)}`, { remindAt }),
  delete: (reminderId: string) =>
    apiClient.delete<void>(`/api/reminders/${encodeURIComponent(reminderId)}`),
  audit: () =>
    apiClient.get<import("./types").EmailAuditListResponse>(
      "/api/reminders/audit"
    ),
};

export const vocabularyPracticeApi = {
  list: () => apiClient.get<import("./types").VocabularyUsageListResponse>("/api/vocabulary-practice"),
  createUsage: (input: import("./types").CreateVocabularyUsageRequest) =>
    apiClient.post<import("./types").VocabularyUsageResponse, import("./types").CreateVocabularyUsageRequest>("/api/vocabulary-practice", input),
  deleteUsage: (usageId: string) =>
    apiClient.delete<void>(`/api/vocabulary-practice/${encodeURIComponent(usageId)}`),
  recordAttempt: (input: import("./types").CreateVocabularyAttemptRequest) =>
    apiClient.post<import("./types").CreateVocabularyAttemptResponse, import("./types").CreateVocabularyAttemptRequest>("/api/vocabulary-practice/attempts", input),
};

export * from "./http";
export * from "./types";
