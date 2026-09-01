"use client";

import { useEffect, type ReactNode } from "react";
import { authSession } from "@shared/libs/client-api";

export default function AuthLifecycle({ children }: { children: ReactNode }) {
  useEffect(() => {
    void authSession.initialize();
  }, []);

  return children;
}
