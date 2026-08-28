"use client";

import { IconButton } from "@mui/material";
import { useI18n, Locale, SUPPORTED_LOCALES } from "@main/lib/i18n";

export default function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  const toggleLocale = () => {
    const next: Locale =
      locale === SUPPORTED_LOCALES[0]
        ? SUPPORTED_LOCALES[1]
        : SUPPORTED_LOCALES[0];
    setLocale(next);
  };

  return (
    <IconButton
      onClick={toggleLocale}
      sx={{
        width: 40,
        height: 40,
        fontSize: "0.8rem",
        fontWeight: 700,
        borderRadius: 1,
        "&:hover": { backgroundColor: "action.hover" },
      }}
      aria-label="Switch language"
    >
      {locale === "zh" ? "EN" : "中"}
    </IconButton>
  );
}
