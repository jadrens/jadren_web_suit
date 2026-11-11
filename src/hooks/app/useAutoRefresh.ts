"use client";

import { useEffect, useRef } from "react";
import { createAutoRefreshRunner } from "./auto-refresh-runner";

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

    const runner = createAutoRefreshRunner(() => refreshRef.current(), () => document.visibilityState === "visible");
    const runRefresh = () => { void runner.run(); };
    const timer = window.setInterval(runRefresh, intervalMs);

    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);
    return () => {
      runner.stop();
      window.clearInterval(timer);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [enabled, intervalMs]);
}
