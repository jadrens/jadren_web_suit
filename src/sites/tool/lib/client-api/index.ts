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

export * from "./http";
export * from "./types";
