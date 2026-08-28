"use client";

import { Box, Avatar } from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import BuildIcon from "@mui/icons-material/Build";
import { motion } from "framer-motion";
import StylizedName from "./StylizedName";
import PortalCard from "./PortalCard";
import { useI18n } from "@main/lib/i18n";
import { useSiteUrl } from "@shared/site-url";

export default function BlogPortal() {
  const { t } = useI18n();
  const blogUrl = useSiteUrl("blog");
  const toolUrl = useSiteUrl("tool");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <Avatar
          src="/shared/avatar.svg"
          alt="Jadren Rayne"
          sx={{
            width: 136,
            height: 136,
            boxShadow: 3,
            cursor: "pointer",
            transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 220ms ease",
            willChange: "transform",
            "@media (hover: hover) and (pointer: fine)": {
              "&:hover": {
                transform: "scale(1.1) rotate(-2deg)",
                filter: "brightness(1.05)",
              },
            },
            "&:active": {
              transform: "scale(0.94) rotate(0deg)",
            },
            "@media (prefers-reduced-motion: reduce)": {
              transition: "none",
              "&:hover, &:active": {
                transform: "none",
              },
            },
          }}
        />
      </motion.div>

      {/* Name */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      >
        <StylizedName />
      </motion.div>

      {/* Cards — 响应式宽度，紧凑间距 */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2.5,
          width: { xs: "90vw", sm: "480px", md: "700px" },
          maxWidth: "100%",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <PortalCard
            href={blogUrl}
            delay={0.2}
            icon={<ArticleIcon sx={{ color: "primary.main", fontSize: 28 }} />}
            title={t.blogPortal.title}
            description={t.blogPortal.description}
            features={t.blogPortal.features}
            visitLabel={t.blogPortal.visit}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <PortalCard
            href={toolUrl}
            delay={0.3}
            icon={<BuildIcon sx={{ color: "primary.main", fontSize: 28 }} />}
            title={t.toolPortal.title}
            description={t.toolPortal.description}
            features={t.toolPortal.features}
            visitLabel={t.toolPortal.visit}
          />
        </Box>
      </Box>
    </Box>
  );
}
