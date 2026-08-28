"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { en, TranslationKeys } from "./en";
import { zh } from "./zh";
import {
  readGlobalLocale,
  subscribeToGlobalLocale,
  writeGlobalLocale,
} from "@shared/i18n/locale-preference";

export type Locale = "en" | "zh";

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];

const translations: Record<Locale, TranslationKeys> = {
  en,
  zh,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocale(readGlobalLocale());
      setMounted(true);
    }, 0);
    const unsubscribe = subscribeToGlobalLocale(setLocale);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    writeGlobalLocale(newLocale);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale: handleSetLocale,
        t: translations[locale],
      }}
    >
      {mounted ? children : null}
    </I18nContext.Provider>
  );
}
