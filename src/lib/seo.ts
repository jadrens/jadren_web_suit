import type { Metadata } from "next";
import SITE_CONFIG from "@config/app/config";

type PageSeo = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

/** Shared metadata keeps search and link previews consistent across pages. */
export function createPageMetadata({
  title,
  description,
  path,
  keywords,
}: PageSeo): Metadata {
  const url = new URL(path, SITE_CONFIG.baseUrl).toString();

  return {
    title: { absolute: `${title} | ${SITE_CONFIG.siteName}` },
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE_CONFIG.siteName}`,
      description,
      url,
      siteName: SITE_CONFIG.siteName,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title: `${title} | ${SITE_CONFIG.siteName}`,
      description,
    },
  };
}
