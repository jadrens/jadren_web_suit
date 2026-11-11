"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { authSession } from "@lib/client-api/session";
import { useAuth } from "@lib/client-api/use-auth";

/** Reject work started by an older opening or account, including after unmount. */
export function useDialogOperation(open: boolean) {
  const { user, isAuthenticated } = useAuth();
  const generation = useRef(0);
  useLayoutEffect(() => {
    generation.current += 1;
    return () => { generation.current += 1; };
  }, [open, user?.userId, user?.status, isAuthenticated]);
  return useCallback(() => {
    const started = generation.current;
    const userId = user?.userId;
    return () => {
      const current = authSession.getSnapshot();
      return isCurrentDialogOperation({ open, isAuthenticated, userId, status: user?.status, started, generation: generation.current }, current);
    };
  }, [open, isAuthenticated, user?.userId, user?.status]);
}

export function useDialogAccountKey() {
  const { user, isAuthenticated } = useAuth();
  return isAuthenticated ? `${user?.userId}:${user?.status}` : "signed-out";
}

export function isCurrentDialogOperation(
  operation: { open: boolean; isAuthenticated: boolean; userId: string | undefined; status: number | undefined; started: number; generation: number },
  current: { isAuthenticated: boolean; user: { userId: string; status: number } | null },
) {
  return operation.open && operation.isAuthenticated && !!operation.userId && operation.started === operation.generation && current.isAuthenticated && current.user?.userId === operation.userId && current.user.status === operation.status;
}
