import type { AuthSnapshot } from "@lib/client-api/types";

/** Refreshing retains the account; logout or an account change invalidates its work. */
export function isEditorAccountCurrent(accountId: string, snapshot: AuthSnapshot): boolean {
  return snapshot.isAuthenticated && snapshot.user?.userId === accountId;
}

export function shouldInitializeEditor(initialized: boolean, snapshot: AuthSnapshot): boolean {
  return !initialized && snapshot.status === "authenticated" && snapshot.user !== null;
}
