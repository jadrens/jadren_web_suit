"use client";

import { Fab } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

interface FloatingTOCButtonProps {
  onClick: () => void;
}

export default function FloatingTOCButton({ onClick }: FloatingTOCButtonProps) {
  return (
    <Fab
      onClick={onClick}
      aria-label="Table of contents"
      sx={{
        width: 40,
        height: 40,
        position: "fixed",
        bottom: 80,
        right: `max(16px, calc((100vw - 100%) / 2))`,
        zIndex: 1300,
        display: { xs: "flex", sm: "none" },
      }}
    >
      <MenuIcon />
    </Fab>
  );
}