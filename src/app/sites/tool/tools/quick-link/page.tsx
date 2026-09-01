import type { Metadata } from "next";
import QuickLinkClient from "./QuickLinkClient";
import { createPageMetadata } from "@shared/libs/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Short Link Manager",
  description: "Create, manage, and track memorable koi.ci short links with custom names, notes, expiration dates, and visit counts.",
  path: "/tools/quick-link",
  keywords: ["short link generator", "URL shortener", "custom short links", "link management"],
});

export default function QuickLinkPage() {
  return <QuickLinkClient />;
}
