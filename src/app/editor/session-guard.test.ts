import { describe, expect, test } from "bun:test";
import type { AuthSnapshot, UserProfile } from "@lib/client-api/types";
import { isEditorAccountCurrent, shouldInitializeEditor } from "./session-guard";

const user = { userId: "alice" } as UserProfile;
const snapshot = (status: AuthSnapshot["status"], currentUser: UserProfile | null = user): AuthSnapshot => ({
  status, user: currentUser, expiresAt: null,
  isAuthenticated: status === "authenticated" || status === "refreshing", error: null,
});

describe("editor session guard", () => {
  test("initializes once after authentication, not during token refresh", () => {
    expect(shouldInitializeEditor(false, snapshot("refreshing"))).toBe(false);
    expect(shouldInitializeEditor(false, snapshot("authenticated"))).toBe(true);
    expect(shouldInitializeEditor(true, snapshot("authenticated"))).toBe(false);
  });

  test("keeps same-account refreshes valid and rejects logout or account changes", () => {
    expect(isEditorAccountCurrent("alice", snapshot("refreshing"))).toBe(true);
    expect(isEditorAccountCurrent("alice", snapshot("anonymous", null))).toBe(false);
    expect(isEditorAccountCurrent("alice", snapshot("authenticated", { userId: "bob" } as UserProfile))).toBe(false);
  });
});
