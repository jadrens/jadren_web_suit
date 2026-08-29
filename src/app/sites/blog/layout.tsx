import type { Metadata } from "next";
import ThemeRegistry from "@blog/components/layout/ThemeRegistry/ThemeRegistry";
import { I18nProvider } from "@blog/lib/i18n";
import LoadingBar from "@blog/components/layout/LoadingBar";
import { SITE_CONFIG } from "@blog/var/config";
import { SHARED_SITE_ICONS } from "@shared/site-icons";

export const metadata: Metadata = {
  title: SITE_CONFIG.siteName,
  description: SITE_CONFIG.description,
  icons: SHARED_SITE_ICONS,
  other: { "msvalidate.01": "C9AF28D7D9990442B295DAE8B746E316" },
};

export default function BlogSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeRegistry>
      <I18nProvider>
        <LoadingBar />
        {children}
      </I18nProvider>
    </ThemeRegistry>
  );
}
