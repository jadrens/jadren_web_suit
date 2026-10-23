"use client";

import { IconButton, Box } from "@mui/material";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import { useTheme } from "@theme/ThemeProvider";

// The incoming icon waits for the outgoing one (0.4s) to finish, like AnimatePresence mode="wait".
function iconSx(active: boolean, hiddenRotation: number) {
  return {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: active ? 1 : 0,
    transform: active ? "scale(1) rotate(0deg)" : `scale(0) rotate(${hiddenRotation}deg)`,
    transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    transitionDelay: active ? "0.4s" : "0s",
  } as const;
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <IconButton
      onClick={toggleTheme}
      sx={{
        position: "relative",
        width: 40,
        height: 40,
        overflow: "hidden",
        "&:hover": {
          backgroundColor: "action.hover",
        },
      }}
      aria-label="Toggle theme"
    >
      {/* CSS swap instead of framer-motion: keeps the animation library out of every page's bundle. */}
      <Box sx={iconSx(theme === "dark", -180)}>
        <WbSunnyIcon sx={{ color: "#fbbf24", fontSize: 22 }} />
      </Box>
      <Box sx={iconSx(theme !== "dark", 180)}>
        <NightsStayIcon sx={{ color: "#6366f1", fontSize: 22 }} />
      </Box>
    </IconButton>
  );
}
