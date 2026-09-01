"use client";

import { useEffect, useSyncExternalStore } from "react";
import { authSession } from "./index";

export function useAuth() {
  const snapshot = useSyncExternalStore(
    authSession.subscribe,
    authSession.getSnapshot,
    authSession.getServerSnapshot
  );

  useEffect(() => {
    void authSession.initialize();
  }, []);

  return {
    ...snapshot,
    login: authSession.login,
    logout: authSession.logout,
    register: authSession.register,
    refresh: authSession.refreshAccessToken,
    loadCurrentUser: authSession.loadCurrentUser,
    sendVerificationCode: authSession.sendVerificationCode,
    verifyEmail: authSession.verifyEmail,
  };
}
