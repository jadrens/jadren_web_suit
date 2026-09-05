import type { Metadata } from "next";

export const SHARED_SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/avatar.svg", type: "image/svg+xml" },
    { url: "/avatar.png", type: "image/png", sizes: "512x512" },
  ],
  shortcut: "/avatar.svg",
  apple: [{ url: "/avatar.png", sizes: "512x512", type: "image/png" }],
};
