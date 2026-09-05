"use client";

import { useEffect, useRef } from "react";

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  enabled: boolean,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const runRefresh = () => void refreshRef.current();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") runRefresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") runRefresh();
    }, intervalMs);

    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs]);
}
