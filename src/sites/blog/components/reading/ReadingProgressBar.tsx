"use client";

import { Box } from "@mui/material";
import { useReadingProgress } from "./ReadingProgressContext";

export default function ReadingProgressBar() {
  const { readingProgress } = useReadingProgress();

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
          height: `${readingProgress}%`,
          bgcolor: "primary.main",
          transition: "height 0.1s ease-out",
        }}
      />
    </Box>
  );
}