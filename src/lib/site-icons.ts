import type { Metadata } from "next";

export const SHARED_SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
    { url: "/avatar.svg", type: "image/svg+xml" },
    { url: "/favicon-512.png", type: "image/png", sizes: "512x512" },
  ],
  shortcut: "/favicon.ico",
  apple: [{ url: "/favicon-512.png", sizes: "512x512", type: "image/png" }],
};
