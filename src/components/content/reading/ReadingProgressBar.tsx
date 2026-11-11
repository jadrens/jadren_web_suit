"use client";

import { Box } from "@mui/material";
import { useReadingProgressValue } from "./ReadingProgressContext";

export default function ReadingProgressBar() {
  const readingProgress = useReadingProgressValue();

  return (
    <Box
      sx={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: 3,
        zIndex: 1299,
        pointerEvents: "none",
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          transform: `scaleY(${readingProgress / 100})`,
          transformOrigin: "top",
          bgcolor: "primary.main",
          transition: "transform 0.1s ease-out",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        }}
      />
    </Box>
  );
}