import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import "@styles/content/misans.css";
import "@styles/app/misans.css";
import "vditor/dist/index.css";
import { ThemeProvider } from "@theme/ThemeProvider";
import ThemeRegistry from "@components/portal/ThemeRegistry";
import { I18nProvider as PortalI18nProvider } from "@lib/i18n/portal";
import { I18nProvider as ContentI18nProvider } from "@lib/i18n/content";
import { I18nProvider as AppI18nProvider } from "@lib/i18n/app";
import LocaleHtml from "@lib/i18n/portal/LocaleHtml";
import AuthLifecycle from "@components/ui/auth/AuthLifecycle";
import LoadingBar from "@components/ui/layout/LoadingBar";
import Navbar from "@components/ui/layout/Navbar";
import { NavbarLoginStatusProvider } from "@components/ui/layout/NavbarLoginStatus";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Dragonren",
  description: "Dragonren web application",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable}`}
      style={{ maxWidth: "100vw", overflowX: "hidden", hyphens: "auto", overflowWrap: "break-word" }}
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider><ThemeRegistry><PortalI18nProvider><ContentI18nProvider><AppI18nProvider><AuthLifecycle><NavbarLoginStatusProvider><LocaleHtml /><LoadingBar /><Navbar />{children}</NavbarLoginStatusProvider></AuthLifecycle></AppI18nProvider></ContentI18nProvider></PortalI18nProvider></ThemeRegistry></ThemeProvider>
      </body>
    </html>
  );
}
