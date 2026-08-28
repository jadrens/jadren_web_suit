"use client";

import { useEffect } from "react";
import SITE_CONFIG from "@tool/var/config";

/**
 * Sets the browser tab title (document.title).
 *
 * @param title The page-specific title (already localized).
 * @param suffix Optional suffix appended after the title (defaults to site name).
 *               Pass an empty string to omit the suffix entirely.
 */
export function useDocumentTitle(title: string, suffix: string = SITE_CONFIG.siteName) {
  useEffect(() => {
    const full = title && suffix ? `${title} - ${suffix}` : title || suffix;
    document.title = full;
    return () => {
      document.title = SITE_CONFIG.siteName;
    };
  }, [title, suffix]);
}
