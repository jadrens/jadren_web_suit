import type { Metadata } from "next";
import ThemeRegistry from "@tool/components/layout/ThemeRegistry/ThemeRegistry";
import { I18nProvider } from "@tool/lib/i18n";
import LoadingBar from "@tool/components/layout/LoadingBar";
import SITE_CONFIG from "@tool/var/config";
import AuthLifecycle from "@tool/components/auth/AuthLifecycle";
import Navbar from "@tool/components/layout/Navbar";
import { NavbarLoginStatusProvider } from "@tool/components/layout/NavbarLoginStatus";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.baseUrl),
  title: {
    default: `${SITE_CONFIG.siteName} — Free Online Developer Tools`,
    template: `%s | ${SITE_CONFIG.siteName}`,
  },
  description: "Free online tools for Base64, DNS, IP lookup, QR codes, colours, and short links.",
  openGraph: { siteName: SITE_CONFIG.siteName, type: "website", locale: "en_US" },
  twitter: { card: "summary" },
};

export default function ToolSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeRegistry>
      <I18nProvider>
        <AuthLifecycle>
          <NavbarLoginStatusProvider>
            <LoadingBar />
            <Navbar />
            {children}
          </NavbarLoginStatusProvider>
        </AuthLifecycle>
      </I18nProvider>
    </ThemeRegistry>
  );
}
