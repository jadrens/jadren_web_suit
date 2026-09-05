"use client";

import { useState } from "react";
import { IconButton, Menu, MenuItem, Typography } from "@mui/material";
import TranslateIcon from "@mui/icons-material/Translate";
import { Locale, useI18n } from "@lib/i18n/portal";

const localeLabels: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
};

export default function LocaleToggle() {
  const { locale, setLocale } = useI18n();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const close = () => setAnchorEl(null);
  const select = (nextLocale: Locale) => {
    setLocale(nextLocale);
    close();
  };

  return <>
    <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Switch language">
      <TranslateIcon />
    </IconButton>
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close} slotProps={{ paper: { sx: { minWidth: 120 } } }}>
      {(Object.keys(localeLabels) as Locale[]).map((key) => (
        <MenuItem key={key} selected={key === locale} onClick={() => select(key)}>
          <Typography variant="body2">{localeLabels[key]}</Typography>
        </MenuItem>
      ))}
    </Menu>
  </>;
}
