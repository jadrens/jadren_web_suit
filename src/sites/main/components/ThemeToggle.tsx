"use client";

import { IconButton } from "@mui/material";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import NightsStayIcon from "@mui/icons-material/NightsStay";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@shared/theme/ThemeProvider";
import { useI18n } from "@shared/libs/i18n/main";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  return (
    <IconButton
      onClick={toggleTheme}
      sx={{
        position: "relative",
        width: 40,
        height: 40,
        overflow: "hidden",
        "&:hover": { backgroundColor: "action.hover" },
      }}
      aria-label={t.theme.toggle}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.div
            key="sun"
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 180, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <WbSunnyIcon sx={{ color: "#fbbf24", fontSize: 22 }} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ scale: 0, rotate: 180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -180, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <NightsStayIcon sx={{ color: "#6366f1", fontSize: 22 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </IconButton>
  );
}
