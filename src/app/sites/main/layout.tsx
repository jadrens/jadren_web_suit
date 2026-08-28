import type { Metadata } from "next";
import ThemeRegistry from "@main/components/ThemeRegistry";
import { I18nProvider } from "@main/lib/i18n";
import LocaleHtml from "@main/lib/i18n/LocaleHtml";

export const metadata: Metadata = {
  title: "jadren - Start",
  description: "Start page for jadren",
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
