"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import HomeIcon from "@mui/icons-material/Home";
import BuildIcon from "@mui/icons-material/Build";
import ThemeToggle from "../navigation/ThemeToggle";
import LocaleSwitcher from "../navigation/LocaleSwitcher";
import { useI18n } from "@shared/libs/i18n/tool";
import { alpha } from "@mui/material";
import React from "react";
import NavbarAccountMenu from "@shared/components/NavbarAccountMenu";
import { useSiteUrl } from "@shared/site-url";

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { t } = useI18n();
  const settingsUrl = useSiteUrl("main", "/settings");

  const navItems = [
    { key: "home", href: "/" },
    { key: "tools", href: "/tools" },
  ] as const;

  return (
    <>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{
          position: "relative",
          zIndex: (currentTheme) => currentTheme.zIndex.appBar,
          borderBottom: 1,
          borderColor: "divider",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          backgroundColor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 4 }, display: "flex", flexDirection: "row", alignItems: "center", gap: 1 }}>
          <NavbarAccountMenu homeHref="/" settingsHref={settingsUrl} accountHref="/user-status" homeLabel={t.nav.home} settingsLabel={t.nav.settings} accountLabel={t.nav.account} />

          {/* Mobile layout */}
          {isMobile ? (
            <Box sx={{ display: "flex", alignItems: "center", flexDirection: "row-reverse", flexGrow: 1, gap: 1 }}>
              <ThemeToggle />
              <LocaleSwitcher />
              <IconButton
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <MenuIcon />
              </IconButton>
            </Box>
          ) : (
            /* Desktop layout */
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexDirection: "row-reverse", flexGrow: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  size="small"
                >
                  {t.nav[item.key as keyof typeof t.nav]}
                </Button>
              ))}

              <LocaleSwitcher />
              <ThemeToggle />
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: "100%",
            maxWidth: 320,
            borderRadius: "16px 0 0 16px",
            bgcolor: "background.default",
          },
          "& .MuiBackdrop-root": {
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            pt: 2,
          }}
        >
          {/* Drawer header */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 3,
              pb: 2,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar
                src="/shared/avatar.svg"
                alt="jadren"
                sx={{ width: 44, height: 44 }}
              />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  jadren
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  jaden@jadren.moe
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close menu" size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Navigation items */}
          <List sx={{ px: 2, flex: 1 }}>
            {navItems.map((item, index) => {
              const icons = [<HomeIcon key="home" />, <BuildIcon key="tools" />];
              return (
                <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        width: "100%",
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 1.5,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          color: "primary.main",
                        }}
                      >
                        {React.cloneElement(icons[index], { sx: { fontSize: 20 } })}
                      </Box>
                      <ListItemText
                        primary={t.nav[item.key as keyof typeof t.nav]}
                        sx={{ fontWeight: 500 }}
                      />
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          {/* Drawer bottom */}
          <Box
            sx={{
              px: 3,
              py: 2,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ThemeToggle />
            <LocaleSwitcher />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
