import type { Metadata } from "next";

export const SHARED_SITE_ICONS: Metadata["icons"] = {
  icon: [
    { url: "/shared/avatar.svg", type: "image/svg+xml" },
    { url: "/shared/avatar.png", type: "image/png", sizes: "512x512" },
  ],
  shortcut: "/shared/avatar.svg",
  apple: [{ url: "/shared/avatar.png", sizes: "512x512", type: "image/png" }],
};
