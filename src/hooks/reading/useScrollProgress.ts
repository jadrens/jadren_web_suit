"use client";

import { useEffect } from "react";
import { useReadingProgressActions } from "@components/content/reading/ReadingProgressContext";

export function useScrollProgress() {
  const { setReadingProgress } = useReadingProgressActions();

  useEffect(() => {
    let frame: number | null = null;
    const updateProgress = () => {
      frame = null;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      // Subpixel scroll deltas do not need a new React render.
      setReadingProgress(Math.round(Math.min(100, Math.max(0, progress)) * 10) / 10);
    };

    const scheduleUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(updateProgress);
    };
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(document.body);
    scheduleUpdate();
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [setReadingProgress]);
}
