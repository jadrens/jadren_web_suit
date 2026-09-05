"use client";

import { useMemo } from "react";

export type SiteName = "main" | "blog" | "tool";

export function getSiteUrl(site: SiteName, pathname = "/") {
  const url = new URL(window.location.href);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
}

export function useSiteUrl(site: SiteName, pathname = "/") {
  return useMemo(() => pathname, [pathname, site]);
}
