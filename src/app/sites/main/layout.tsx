import type { Metadata } from "next";
import ThemeRegistry from "@main/components/ThemeRegistry";
import { I18nProvider } from "@shared/libs/i18n/main";
import LocaleHtml from "@shared/libs/i18n/main/LocaleHtml";
import { SHARED_SITE_ICONS } from "@shared/site-icons";

export const metadata: Metadata = {
  title: "jadren",
  description: "Jadren's blog, tools, and projects.",
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
