import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Inter, Nunito } from "next/font/google";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import "@styles/app/misans.css";
import { ThemeProvider } from "@theme/ThemeProvider";
import { isTheme, RESOLVED_THEME_COOKIE, THEME_INIT_SCRIPT } from "@theme/bootstrap";
import { ToastProvider } from "@components/ui/feedback/toast";
import ThemeRegistry from "@components/portal/ThemeRegistry";
import { LocaleProvider } from "@lib/i18n/LocaleProvider";
import { LOCALE_COOKIE, resolveRequestLocale } from "@lib/i18n/locale-preference";
import AuthLifecycle from "@components/ui/auth/AuthLifecycle";
import LoadingBar from "@components/ui/layout/LoadingBar";
import Navbar from "@components/ui/layout/Navbar";
import { NavbarLoginStatusProvider } from "@components/ui/layout/NavbarLoginStatus";
import { SHARED_SITE_ICONS } from "@lib/site-icons";
import SITE_CONFIG from "@config/app/config";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.baseUrl),
  title: "Dragonren",
  description: SITE_CONFIG.description,
  icons: SHARED_SITE_ICONS,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveRequestLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
  const resolvedTheme = cookieStore.get(RESOLVED_THEME_COOKIE)?.value;
  const theme = isTheme(resolvedTheme) ? resolvedTheme : "light";

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      data-theme={theme}
      suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable}`}
      style={{ maxWidth: "100vw", overflowX: "hidden", hyphens: "auto", overflowWrap: "break-word", colorScheme: theme }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <AppRouterCacheProvider><ThemeProvider initialTheme={theme}><ThemeRegistry><ToastProvider /><LocaleProvider initialLocale={locale}><AuthLifecycle><NavbarLoginStatusProvider><LoadingBar /><Navbar />{children}</NavbarLoginStatusProvider></AuthLifecycle></LocaleProvider></ThemeRegistry></ThemeProvider></AppRouterCacheProvider>
      </body>
    </html>
  );
}
