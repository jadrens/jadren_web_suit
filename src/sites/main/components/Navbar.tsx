"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { alpha, AppBar, Avatar, Box, Button, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Toolbar, Typography, useTheme } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import HomeIcon from "@mui/icons-material/Home";
import ArticleIcon from "@mui/icons-material/Article";
import BuildIcon from "@mui/icons-material/Build";
import PersonIcon from "@mui/icons-material/Person";
import ThemeToggle from "./ThemeToggle";
import LocaleToggle from "./LocaleToggle";
import NavbarMenu from "./NavbarMenu";
import { useI18n } from "@shared/libs/i18n/main";
import { useResponsiveNav } from "@shared/hooks/useResponsiveNav";

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const navContentRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const { t, locale } = useI18n();
  const collapsed = useResponsiveNav(toolbarRef, navContentRef);
  const navItems = [
    { label: t.nav.start, href: "/", icon: <HomeIcon /> },
    { label: t.nav.blog, href: `/blog/${locale}`, icon: <ArticleIcon /> },
    { label: t.nav.tools, href: "/tools", icon: <BuildIcon /> },
    { label: t.nav.about, href: "/about", icon: <PersonIcon /> },
  ];

  return <>
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", backdropFilter: "blur(2px)", backgroundColor: alpha(theme.palette.background.default, .5) }}>
      <Toolbar ref={toolbarRef} sx={{ px: { xs: 2, sm: 4 }, gap: 1 }}>
        <NavbarMenu />
        {collapsed ? <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}><ThemeToggle /><LocaleToggle /><IconButton aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton></Box> :
          <Box ref={navContentRef} sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}><ThemeToggle /><LocaleToggle />{navItems.map((item) => <Button key={item.href} component={Link} href={item.href} size="small">{item.label}</Button>)}</Box>}
      </Toolbar>
    </AppBar>
    <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ "& .MuiDrawer-paper": { width: "100%", maxWidth: 320, borderRadius: "16px 0 0 16px", bgcolor: "background.default" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", pt: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, pb: 2, borderBottom: 1, borderColor: "divider" }}><Avatar src="/shared/avatar.svg" alt="jadren" sx={{ width: 44, height: 44 }} /><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>jadren</Typography><Typography variant="caption" color="text.secondary">jaden@jadren.me</Typography></Box><IconButton aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton></Box>
        <List sx={{ px: 2, flex: 1 }}>{navItems.map((item) => <ListItem key={item.href} disablePadding sx={{ mb: .5 }}><ListItemButton component={Link} href={item.href} onClick={() => setDrawerOpen(false)} sx={{ borderRadius: 2, py: 1.5, gap: 2 }}><Box sx={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, .08), color: "primary.main" }}>{item.icon}</Box><ListItemText primary={item.label} /></ListItemButton></ListItem>)}</List>
        <Box sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "space-between" }}><ThemeToggle /><LocaleToggle /></Box>
      </Box>
    </Drawer>
  </>;
}
