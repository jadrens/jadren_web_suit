"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, List, ListItem, ListItemButton, ListItemText, Typography, IconButton, Tooltip, alpha } from "@mui/material";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { useI18n } from "@lib/i18n/content";
import { PostMeta } from "@lib/publishing/search-index";
import { Locale } from "@lib/publishing/posts";
import { tocDesktopWidth } from "@config/publishing/toc";

const NAV_HEIGHT = 64;
const ANIM_DURATION = 300; // ms, must match CSS transition

type Phase = "closed" | "entering" | "open" | "exiting";

interface PostsSidebarProps {
  posts: PostMeta[];
  currentSlug: string;
  locale: Locale;
  open: boolean;
  onToggle: () => void;
}

export default function PostsSidebar({ posts, currentSlug, locale, open, onToggle }: PostsSidebarProps) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>(open ? "entering" : "closed");
  const [navVisible, setNavVisible] = useState(true);

  // Trigger slide-in after mount
  useEffect(() => {
    if (phase === "entering") {
      const raf = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(raf);
    }
  }, [phase]);

  // Topbar scroll avoidance
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY <= NAV_HEIGHT) {
        setNavVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setNavVisible(false);
      } else {
        setNavVisible(false);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClose = useCallback(() => {
    setPhase("exiting");
    setTimeout(() => {
      onToggle();
      setPhase("closed");
    }, ANIM_DURATION);
  }, [onToggle]);

  const isCard = phase === "entering" || phase === "open" || phase === "exiting";
  const slideIn = phase === "open";

  // Closed state: fixed-position toggle button
  if (!isCard) {
    return (
      <Tooltip title={t.sidebar.toggle} placement="right">
        <IconButton
          onClick={onToggle}
          aria-label={t.sidebar.toggle}
          sx={(theme) => ({
            position: "fixed",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 10,
            bgcolor: alpha(theme.palette.background.paper, 0.75),
            backdropFilter: 'blur(16px)',
            border: 1,
            borderColor: 'divider',
            boxShadow: theme.shadows[3],
            display: { xs: "none", sm: "inline-flex" },
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.9),
            },
          })}
        >
          <MenuOpenIcon />
        </IconButton>
      </Tooltip>
    );
  }

  // Card state: floating sidebar
  return (
    <Box
      sx={(theme) => ({
        width: tocDesktopWidth,
        flexShrink: 0,
        position: "sticky",
        top: navVisible ? 80 : 16,
        maxHeight: navVisible ? "calc(100vh - 96px)" : "calc(100vh - 32px)",
        display: { xs: "none", sm: "flex" },
        flexDirection: "column",
        bgcolor: alpha(theme.palette.background.paper, 0.75),
        backdropFilter: 'blur(16px)',
        border: 1,
        borderColor: 'divider',
        boxShadow: theme.shadows[4],
        overflow: "hidden",
        transform: slideIn ? "translateX(0)" : "translateX(-100%)",
        transition: `transform ${ANIM_DURATION}ms ease-out, top 0.2s, max-height 0.2s`,
      })}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: 1.5,
          pb: 1,
        }}
      >
        <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 600 }}>
          {t.sidebar.allPosts}
        </Typography>
        <IconButton size="small" onClick={handleClose} aria-label={t.sidebar.toggle}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Post list */}
      <List dense disablePadding sx={{ overflowY: 'auto', flex: 1, px: 1, pb: 1 }}>
        {posts.map((post) => (
          <ListItem key={post.slug} disablePadding>
            <ListItemButton
              component={Link}
              href={`/blog/${locale}/${post.slug}`}
              selected={post.slug === currentSlug}
              sx={{ borderRadius: 1, mb: 0.5 }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: post.slug === currentSlug ? 600 : 400,
                      color: post.slug === currentSlug ? "primary.main" : "text.primary",
                    }}
                  >
                    {post.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {post.date.split('T')[0]}
                  </Typography>
                }
              />
          </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
