"use client";

import { IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { useI18n, Locale } from "@lib/i18n/content";
import TranslateIcon from "@mui/icons-material/Translate";
import { useRouter, usePathname } from "next/navigation";

const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh": "简体中文",
};

function getLocaleFromPath(pathname: string): Locale | null {
  const match = pathname.match(/^\/blog\/(en|zh)/);
  return match ? (match[1] as Locale) : null;
}

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
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

    // Navigate to the same blog page with new locale
    const currentLocale = getLocaleFromPath(pathname);
    if (currentLocale) {
      const newPath = pathname.replace(`/blog/${currentLocale}`, `/blog/${newLocale}`);
      router.push(newPath);
    } else if (pathname.startsWith("/blog")) {
      router.push(`/blog/${newLocale}`);
    }
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