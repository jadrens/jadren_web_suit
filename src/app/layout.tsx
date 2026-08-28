import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import "@blog/style/misans.css";
import { ThemeProvider } from "@shared/theme/ThemeProvider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Dragonren",
  description: "Dragonren sites",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
