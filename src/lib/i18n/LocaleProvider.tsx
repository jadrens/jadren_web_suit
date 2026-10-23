"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  GlobalLocale,
  readGlobalLocale,
  subscribeToGlobalLocale,
  writeGlobalLocale,
} from "@lib/i18n/locale-preference";

export type Locale = GlobalLocale;

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
});

// Single source of locale state shared by every translation area (portal, content, app).
// The server resolves initialLocale from the same cookie, so the first render already matches.
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const timer = window.setTimeout(() => setLocaleState(readGlobalLocale()), 0);
    const unsubscribe = subscribeToGlobalLocale(setLocaleState);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    writeGlobalLocale(newLocale);
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function createI18n<T>(translations: Record<Locale, T>) {
  return function useI18n() {
    const { locale, setLocale } = useContext(LocaleContext);
    return { locale, setLocale, t: translations[locale] };
  };
}
