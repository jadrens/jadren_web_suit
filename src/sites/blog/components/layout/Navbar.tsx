"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Drawer,
  ListItem,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
  TextField,
  InputAdornment,
  Paper,
  List as MuiList,
  CircularProgress,
  Portal,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import HomeIcon from "@mui/icons-material/Home";
import ArticleIcon from "@mui/icons-material/Article";
import PersonIcon from "@mui/icons-material/Person";
import ThemeToggle from "../navigation/ThemeToggle";
import LocaleSwitcher from "../navigation/LocaleSwitcher";
import { useI18n } from "@shared/libs/i18n/blog";
import { useSiteUrl } from "@shared/site-url";
import { alpha } from "@mui/material";
import React from "react";
import NavbarAccountMenu from "@shared/components/NavbarAccountMenu";

interface SearchResult {
  slug: string;
  title: string;
  date: string;
  tags: string[];
}

interface SearchResponse {
  results: SearchResult[];
  tags: string[];
}

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // 统一的搜索框引用
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchBoxRect, setSearchBoxRect] = useState<DOMRect | null>(null);
  
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { t, locale } = useI18n();
  const accountUrl = useSiteUrl("tool", "/user-status");
  const settingsUrl = useSiteUrl("main", "/settings");

  const navItems = [
    { key: "home", href: "/" },
    { key: "posts", href: `/blog/${locale}` },
    { key: "about", href: "/about" },
  ] as const;

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchFocused(true);
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (searchFocused) {
          inputRef.current?.blur();
        }
        setSearchFocused(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [searchFocused]);

  // 搜索请求
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}`);
        const data: SearchResponse = await res.json();
        setSearchResults(data.results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, locale]);

  const handleResultClick = (slug: string) => {
    router.push(`/blog/${locale}/${slug}`);
    setSearchQuery("");
    setSearchResults([]);
    setSearchFocused(false);
  };

  const showResults = searchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0);

  // 聚焦时计算搜索框位置
  const handleSearchFocus = () => {
    setSearchFocused(true);
    if (searchBoxRef.current) {
      setSearchBoxRect(searchBoxRef.current.getBoundingClientRect());
    }
  };

  // 共用的搜索结果下拉菜单
  const searchDropdown = (
    <Portal>
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          top: searchBoxRect ? searchBoxRect.bottom + 4 : 0,
          left: searchBoxRect ? searchBoxRect.left : 0,
          width: searchBoxRect ? searchBoxRect.width : 300,
          maxHeight: 400,
          overflow: "auto",
          zIndex: 9999,
          borderRadius: 1.5,
        }}
      >
        {searchLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : searchResults.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 2, fontSize: "0.875rem" }}>
            {t.search.noResults}
          </Typography>
        ) : (
          <MuiList dense>
            {searchResults.map((result) => (
              <ListItem sx={{ cursor: "pointer" }} key={result.slug} disablePadding>
                <ListItemButton onClick={() => handleResultClick(result.slug)} sx={{ py: 1 }}>
                  <ListItemText primary={result.title} />
                </ListItemButton>
              </ListItem>
            ))}
          </MuiList>
        )}
      </Paper>
    </Portal>
  );

  return (
    <>
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
        <Toolbar sx={{ px: { xs: 2, sm: 4 }, display: "flex", flexDirection: "row", alignItems: "center", gap: 1 }}>
          <NavbarAccountMenu homeHref="/" settingsHref={settingsUrl} accountHref={accountUrl} homeLabel={t.nav.home} settingsLabel={t.nav.settings} accountLabel={t.nav.account} />

          {/* 移动端布局 */}
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
            /* 桌面端布局 */
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

              <Box ref={searchBoxRef} sx={{ position: "relative", flexShrink: 0, flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <TextField
                  inputRef={inputRef}
                  size="small"
                  placeholder={t.search.placeholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="caption" sx={{ color: "text.disabled", px: 0.5, py: 0.25, border: 1, borderColor: "divider", borderRadius: 0.5 }}>
                            {searchFocused ? "Esc" : "⌘K"}
                          </Typography>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    width: searchFocused ? "calc(100% - 64px)" : 160,
                    transition: "width 0.25s ease, background-color 0.2s ease",
                    px: { xs: 0.5, sm: 1 },
                    "& .MuiOutlinedInput-root": {
                      bgcolor: alpha(theme.palette.action.hover, 0.04),
                      "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.08) },
                      "&.Mui-focused": { bgcolor: alpha(theme.palette.action.hover, 0.08) },
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* 共用的搜索结果下拉菜单 */}
      {showResults && searchBoxRect && searchDropdown}

      {/* 移动端 Drawer */}
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
          {/* Drawer 头部 */}
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

          {/* 移动端搜索框 */}
          <Box sx={{ px: 2, py: 2 }}>
            <Box ref={searchBoxRef}>
              <TextField
                fullWidth
                size="small"
                placeholder={t.search.placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchLoading ? (
                      <InputAdornment position="end">
                        <CircularProgress size={16} />
                      </InputAdornment>
                    ) : null,
                  },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.action.hover, 0.04),
                  },
                }}
              />
            </Box>
          </Box>

          {/* 导航项 */}
          <MuiList sx={{ px: 2, flex: 1 }}>
            {navItems.map((item, index) => {
              const icons = [<HomeIcon key="home" />, <ArticleIcon key="posts" />, <PersonIcon key="about" />];
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
          </MuiList>

          {/* Drawer 底部 */}
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
