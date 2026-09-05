"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_PREFIX = "drablog";

/**
 * Persistent browser config backed by localStorage.
 * Survives page reloads and navigation. Falls back to defaultValue
 * during SSR and when localStorage is unavailable.
 */
export function useBrowserConfig<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = `${STORAGE_PREFIX}:${key}`;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // corrupted value — fall through
    }
    return defaultValue;
  });

  // Persist to localStorage whenever value changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // quota exceeded or private browsing — silently ignore
    }
  }, [storageKey, value]);

  const setPersistedValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        return resolved;
      });
    },
    [],
  );

  return [value, setPersistedValue];
}

/**
 * Read a single config value (no reactivity).
 */
export function readBrowserConfig<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * All known config keys — single source of truth.
 */
export const BrowserConfigKeys = {
  sidebarOpen: "sidebar.open",
} as const;
