"use client";

import Link from "next/link";
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Avatar,
  useTheme,
} from "@mui/material";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";
import { useI18n } from "@main/lib/i18n";
import { useSiteUrl } from "@shared/site-url";

export default function Navbar() {
  const theme = useTheme();
  const { t } = useI18n();
  const bg = theme.palette.mode === "dark" ? "#1e1e1e" : "#f8f6f3";
  const blogUrl = useSiteUrl("blog");
  const toolUrl = useSiteUrl("tool");

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        backgroundColor: `${bg}80`,
      }}
    >
      <Toolbar
        sx={{
          px: { xs: 2, sm: 4 },
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Avatar
          component={Link}
          href="/"
          src="/shared/avatar.svg"
          alt="jadren"
          sx={{ width: 36, height: 36, flexShrink: 0 }}
        />
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexDirection: "row-reverse",
            flexGrow: 1,
          }}
        >
          <Button
            component={Link}
            href={blogUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
          >
            {t.nav.blog}
          </Button>
          <Button
            component={Link}
            href={toolUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
          >
            {t.nav.tools}
          </Button>
          <Button component={Link} href="/" size="small">
            {t.nav.start}
          </Button>
          <ThemeToggle />
          <LocaleToggle />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
