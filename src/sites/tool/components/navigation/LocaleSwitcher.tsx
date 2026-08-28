"use client";

import { IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { useI18n, Locale } from "@tool/lib/i18n";
import TranslateIcon from "@mui/icons-material/Translate";

const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh": "简体中文",
};

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    handleClose();
  };

  return (
    <>
      <IconButton onClick={handleOpen} aria-label="Switch language">
        <TranslateIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
          paper: { sx: { minWidth: 120 } },
        }}
      >
        {(Object.keys(localeLabels) as Locale[]).map((key) => (
          <MenuItem
            key={key}
            onClick={() => handleSelect(key)}
            selected={key === locale}
          >
            <Typography variant="body2">{localeLabels[key]}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
