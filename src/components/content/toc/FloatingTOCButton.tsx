"use client";

import { Fab } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useI18n } from "@lib/i18n/content";

interface FloatingTOCButtonProps {
  onClick: () => void;
}

export default function FloatingTOCButton({ onClick }: FloatingTOCButtonProps) {
  const { t } = useI18n();
  return (
    <Fab
      onClick={onClick}
      aria-label={t.toc.contents}
      aria-haspopup="dialog"
      sx={{
        width: 40,
        height: 40,
        position: "fixed",
        bottom: 80,
        right: `max(16px, calc((100vw - 100%) / 2))`,
        zIndex: 1300,
        display: { xs: "flex", lg: "none" },
      }}
    >
      <MenuIcon />
    </Fab>
  );
}
