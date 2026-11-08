"use client";

export type SiteName = "main" | "blog" | "tool";

export function getSiteUrl(site: SiteName, pathname = "/") {
  const url = new URL(window.location.href);
  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
}

/** Every site is served from one origin now, so the link is just the path; `site` is kept for call sites. */
export function useSiteUrl(site: SiteName, pathname = "/") {
  return pathname;
}
