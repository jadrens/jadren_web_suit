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
  delete: (reminderId: string) =>
    apiClient.delete<void>(`/api/reminders/${encodeURIComponent(reminderId)}`),
  audit: () =>
    apiClient.get<import("./types").EmailAuditListResponse>(
      "/api/reminders/audit"
    ),
};

export * from "./http";
export * from "./types";
