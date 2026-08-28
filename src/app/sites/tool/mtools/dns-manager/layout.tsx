"use client";

import { useState, useCallback } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import HistoryIcon from "@mui/icons-material/History";
import PublicIcon from "@mui/icons-material/Public";
import CachedIcon from "@mui/icons-material/Cached";
import LogoutIcon from "@mui/icons-material/Logout";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { alpha } from "@mui/material";
import TokenDialog from "@tool/lib/dns-manager/TokenDialog";
import { hasToken, removeToken, getApiBase, setApiBase } from "@tool/lib/dns-manager/api";
import React from "react";

const navItems = [
  {
    key: "dashboard",
    href: "/mtools/dns-manager",
    label: "Dashboard",
    icon: <DashboardIcon sx={{ fontSize: 20 }} />,
  },
  {
    key: "zones",
    href: "/mtools/dns-manager/zones",
    label: "Zones",
    icon: <DnsIcon sx={{ fontSize: 20 }} />,
  },
  {
    key: "queries",
    href: "/mtools/dns-manager/queries",
    label: "Queries",
    icon: <HistoryIcon sx={{ fontSize: 20 }} />,
  },
  {
    key: "edns",
    href: "/mtools/dns-manager/edns",
    label: "EDNS",
    icon: <PublicIcon sx={{ fontSize: 20 }} />,
  },
  {
    key: "geocache",
    href: "/mtools/dns-manager/geocache",
    label: "Geo Cache",
    icon: <CachedIcon sx={{ fontSize: 20 }} />,
  },
];

export default function DnsManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authKey, setAuthKey] = useState(0);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [endpointInput, setEndpointInput] = useState(getApiBase());
  const pathname = usePathname();
  const router = useRouter();

  const handleAuthenticated = useCallback(() => {
    setAuthKey((k) => k + 1);
  }, []);

  const handleLogout = () => {
    removeToken();
    router.push("/mtools/dns-manager");
    setAuthKey((k) => k + 1);
  };

  const handleOpenEndpoint = () => {
    setEndpointInput(getApiBase());
    setEndpointOpen(true);
  };

  const handleSaveEndpoint = () => {
    const val = endpointInput.trim().replace(/\/+$/, "");
    if (val) {
      setApiBase(val);
    }
    setEndpointOpen(false);
  };

  const isActive = (href: string) => {
    if (href === "/mtools/dns-manager") {
      return pathname === "/mtools/dns-manager";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <TokenDialog key={authKey} onAuthenticated={handleAuthenticated} />

      <Box
        className="page-below-navbar"
        sx={{ display: "flex", flexDirection: "column" }}
      >
        {/* Top bar */}
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            backgroundColor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          <Toolbar sx={{ px: { xs: 2, sm: 4 }, display: "flex", gap: 1 }}>
            <Avatar
              component={Link}
              href="/mtools/dns-manager"
              sx={{
                width: 32,
                height: 32,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                fontSize: "0.9rem",
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              D
            </Avatar>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, fontFamily: "var(--font-inter)", flex: 1 }}
            >
              DNS Manager
            </Typography>

            {isMobile ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                  <MenuIcon />
                </IconButton>
              </Box>
            ) : (
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    component={Link}
                    href={item.href}
                    size="small"
                    startIcon={item.icon}
                    variant={isActive(item.href) ? "contained" : "text"}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: isActive(item.href) ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
                <Button
                  size="small"
                  startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
                  onClick={handleLogout}
                  color="error"
                  sx={{ textTransform: "none", borderRadius: 2, ml: 1 }}
                >
                  Logout
                </Button>
                <Tooltip title="Change API endpoint">
                  <Button
                    size="small"
                    startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                    onClick={handleOpenEndpoint}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      ml: 0.5,
                    }}
                  >
                    {getApiBase().replace(/^https?:\/\//, "")}
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* Mobile drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: "100%",
              maxWidth: 300,
              borderRadius: "16px 0 0 16px",
              bgcolor: "background.default",
            },
            "& .MuiBackdrop-root": {
              backgroundColor: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
            },
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", height: "100%", pt: 2 }}>
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
                <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main", fontSize: "1rem", fontWeight: 700 }}>
                  D
                </Avatar>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  DNS Manager
                </Typography>
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            <List sx={{ px: 2, flex: 1 }}>
              {navItems.map((item) => (
                <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    selected={isActive(item.href)}
                    sx={{
                      borderRadius: 2,
                      py: 1.5,
                      "&.Mui-selected": {
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
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
                        {item.icon}
                      </Box>
                      <ListItemText primary={item.label} />
                    </Box>
                  </ListItemButton>
                </ListItem>
              ))}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    handleLogout();
                    setDrawerOpen(false);
                  }}
                  sx={{ borderRadius: 2, py: 1.5, color: "error.main" }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                        color: "error.main",
                      }}
                    >
                      <LogoutIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <ListItemText primary="Logout" />
                  </Box>
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        {/* Main content */}
        <Box component="main" sx={{ flex: 1 }}>
          {children}
        </Box>
      </Box>

      {/* Endpoint editor dialog */}
      <Dialog
        open={endpointOpen}
        onClose={() => setEndpointOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
          API Endpoint
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={endpointInput}
            onChange={(e) => setEndpointInput(e.target.value)}
            placeholder="https://hkns.jadren.me"
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEndpoint(); }}
            slotProps={{
              input: {
                sx: { fontFamily: "var(--font-jetbrains-mono), monospace", borderRadius: 2, mt: 1 },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            The base URL of your DNS Server API. Saved to localStorage.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEndpointOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEndpoint} sx={{ textTransform: "none", borderRadius: 2 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
