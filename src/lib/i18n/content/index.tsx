"use client";

import { createI18n } from "@lib/i18n/LocaleProvider";
import { en } from "./en";
import { zh } from "./zh";

export { SUPPORTED_LOCALES, type Locale } from "@lib/i18n/LocaleProvider";

export const useI18n = createI18n({ en, zh });
