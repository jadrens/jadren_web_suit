"use client";

import { useEffect, type ReactNode } from "react";
import { authSession } from "@tool/lib/client-api";

export default function AuthLifecycle({ children }: { children: ReactNode }) {
  useEffect(() => {
    void authSession.initialize();
  }, []);

  return children;
}
