"use client";

import { useEffect, useState } from "react";

export type SiteName = "main" | "blog" | "tool";

const SITE_PREFIXES = new Set<SiteName>(["main", "blog", "tool"]);

function getBaseHostname(hostname: string) {
  const labels = hostname.split(".");

  if (labels.length > 1 && SITE_PREFIXES.has(labels[0] as SiteName)) {
    return labels.slice(1).join(".");
  }

  return hostname;
}

export function getSiteUrl(site: SiteName, pathname = "/") {
  const url = new URL(window.location.href);
  const baseHostname = getBaseHostname(url.hostname);

  url.hostname = site === "main" && baseHostname !== "localhost"
    ? baseHostname
    : `${site}.${baseHostname}`;
  url.pathname = pathname;
  url.search = "";
  url.hash = "";

  return url.toString();
}

export function useSiteUrl(site: SiteName, pathname = "/") {
  const [url, setUrl] = useState("#");

  useEffect(() => {
    setUrl(getSiteUrl(site, pathname));
  }, [pathname, site]);

  return url;
}
