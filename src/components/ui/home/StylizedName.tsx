"use client";

import { Box } from "@mui/material";

const JADREN_COLORS = ["#6bb6eb", "#f19595", "#9eb5a3", "#c49e9e", "#b5a3c4", "#a3b59e"];
const RAYNE_COLORS = ["#9eb2c4", "#a7b5bd", "#bdb08f", "#c9b89e", "#bca3a3"];

export default function StylizedName() {
  const renderText = (text: string, colors: string[], isWave = false) => {
    return text.split("").map((char, i) => {
      const color = colors[i % colors.length];
      return (
        <span
          key={i}
          style={{
            color,
            fontFamily: "'Product Sans', 'Inter', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "inherit",
          }}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <Box
      component="span"
      sx={{
        display: "inline",
        fontSize: { xs: "1.8rem", sm: "2rem" },
        lineHeight: 1.2,
      }}
    >
      {renderText("Jadren ", JADREN_COLORS)}
      {renderText("Rayne", RAYNE_COLORS, true)}
    </Box>
  );
}
