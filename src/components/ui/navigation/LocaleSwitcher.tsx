"use client";

import { IconButton, ListItemIcon, Menu, MenuItem, SvgIcon, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { useI18n, Locale } from "@lib/i18n/app";
import CheckIcon from "@mui/icons-material/Check";

const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh": "简体中文",
};

// Matches the neighbouring theme toggle: its moon's purple in light mode, its sun's yellow in dark mode.
const ACCENT = { light: "#6366f1", dark: "#fbbf24" };
const accentFor = (mode: "light" | "dark") => ACCENT[mode];

// Material "Translate" glyph split into its two shapes, so the current language's half can be lit.
const GLYPH_PATHS: Record<Locale, string> = {
  zh: "m12.87 15.07-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11z",
  en: "M18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2zm-2.62 7 1.62-4.33L19.12 17z",
};

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

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
      <IconButton
        onClick={handleOpen}
        aria-label={`Switch language (current: ${localeLabels[locale]})`}
        aria-haspopup="menu"
        aria-expanded={open}
        sx={(theme) => {
          const accent = accentFor(theme.palette.mode);
          const glow = {
            backgroundColor: "action.hover",
            boxShadow: [
              `inset 0 0 0 1px ${alpha(accent, 0.45)}`,
              `inset 0 0 10px ${alpha(accent, 0.3)}`,
              `0 0 12px ${alpha(accent, 0.4)}`,
            ].join(", "),
            "& .locale-glyph-active": { filter: `drop-shadow(0 0 2.5px ${alpha(accent, 0.6)})` },
          };
          return {
            width: 40,
            height: 40,
            transition: "box-shadow 0.25s ease, background-color 0.25s ease",
            "& .locale-glyph": {
              fill: theme.palette.text.secondary,
              opacity: 0.6,
              transition: "fill 0.3s ease, opacity 0.3s ease, filter 0.25s ease",
            },
            "& .locale-glyph-active": { fill: accent, opacity: 1 },
            // Same lit ring as the theme toggle: on hover, keyboard focus, and while the menu is open.
            "&:hover, &.Mui-focusVisible": glow,
            ...(open ? glow : {}),
          };
        }}
      >
        <SvgIcon sx={{ fontSize: 22 }}>
          {(Object.keys(GLYPH_PATHS) as Locale[]).map((key) => (
            <path
              key={key}
              d={GLYPH_PATHS[key]}
              className={key === locale ? "locale-glyph locale-glyph-active" : "locale-glyph"}
            />
          ))}
        </SvgIcon>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        // The scroll lock hides the scrollbar and pads <body>, which nudges the navbar sideways.
        disableScrollLock
        slotProps={{
          paper: { sx: { minWidth: 150 } },
        }}
      >
        {(Object.keys(localeLabels) as Locale[]).map((key) => {
          const current = key === locale;
          return (
            <MenuItem
              key={key}
              onClick={() => handleSelect(key)}
              selected={current}
              aria-current={current ? "true" : undefined}
              sx={{
                color: current ? (theme) => accentFor(theme.palette.mode) : "text.primary",
                "&.Mui-selected": { bgcolor: (theme) => alpha(accentFor(theme.palette.mode), 0.12) },
                "&.Mui-selected:hover": { bgcolor: (theme) => alpha(accentFor(theme.palette.mode), 0.18) },
              }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: "inherit" }}>
                {current && <CheckIcon fontSize="small" />}
              </ListItemIcon>
              <Typography variant="body2" sx={{ fontWeight: current ? 700 : 400 }}>
                {localeLabels[key]}
              </Typography>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
