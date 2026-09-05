"use client";

import { useEffect } from "react";
import { useReadingProgress } from "@components/content/reading/ReadingProgressContext";

export function useScrollProgress() {
  const { setReadingProgress } = useReadingProgress();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setReadingProgress]);
}