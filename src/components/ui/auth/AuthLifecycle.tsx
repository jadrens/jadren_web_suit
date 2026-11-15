"use client";

import { useEffect, type ReactNode } from "react";
import { authSession } from "@lib/client-api/session";
import CaptchaDialog from "./CaptchaDialog";

export default function AuthLifecycle({ children }: { children: ReactNode }) {
  useEffect(() => {
    void authSession.initialize();
  }, []);

  return (
    <>
      {children}
      <CaptchaDialog />
    </>
  );
}
