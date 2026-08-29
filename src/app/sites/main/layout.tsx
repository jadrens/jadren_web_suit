import type { Metadata } from "next";
import ThemeRegistry from "@main/components/ThemeRegistry";
import { I18nProvider } from "@main/lib/i18n";
import LocaleHtml from "@main/lib/i18n/LocaleHtml";
import { SHARED_SITE_ICONS } from "@shared/site-icons";

export const metadata: Metadata = {
  title: "jadren - Start",
  description: "Start page for jadren",
  icons: SHARED_SITE_ICONS,
};

export default function MainSiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeRegistry>
      <I18nProvider>
        <LocaleHtml />
        {children}
      </I18nProvider>
    </ThemeRegistry>
  );
}
