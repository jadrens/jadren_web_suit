"use client";

import type { ReactNode } from "react";
import AuthLifecycle from "@tool/components/auth/AuthLifecycle";
import ThemeRegistry from "@tool/components/layout/ThemeRegistry/ThemeRegistry";
import { I18nProvider } from "@shared/libs/i18n/tool";
import Navbar from "@main/components/Navbar";

export default function AccountProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <ThemeRegistry>
        <I18nProvider>
          <AuthLifecycle>{children}</AuthLifecycle>
        </I18nProvider>
      </ThemeRegistry>
    </>
  );
}
