"use client";

import { useEffect } from "react";
import { useI18n } from "./index";

export default function LocaleHtml() {
  const { locale } = useI18n();

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return null;
}
