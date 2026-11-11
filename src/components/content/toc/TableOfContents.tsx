"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Box, List, ListItem, ListItemButton, ListItemText, Collapse, Typography, Tooltip, IconButton, alpha } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useReadingHeadings, Heading } from "../reading/ReadingProgressContext";
import { useI18n } from "@lib/i18n/content";
import { tocDesktopWidth } from "@config/publishing/toc";

const NAV_HEIGHT = 64;
const ITEM_HEIGHT = 32; // estimated height per item

interface TocItemProps {
  heading: Heading;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

const INDENT_PER_LEVEL = 1.5;

function TocItem({ heading, expandedIds, onToggle }: TocItemProps) {
  const { activeHeadingId } = useReadingHeadings();
  const { t } = useI18n();
  const hasChildren = heading.children.length > 0;
  const isActive = activeHeadingId === heading.id;
  const isExpanded = expandedIds.has(heading.id);

  const handleClick = () => {
    const element = document.getElementById(heading.id);
    if (element) {
      element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      window.history.pushState(window.history.state, "", `#${encodeURIComponent(heading.id)}`);
    }
  };

  const indent = (heading.level - 1) * INDENT_PER_LEVEL;

  return (
    <>
      <ListItem disablePadding disableGutters>
        <ListItemButton
          component="a"
          href={`#${encodeURIComponent(heading.id)}`}
          data-heading-id={heading.id}
          onClick={(event) => { event.preventDefault(); handleClick(); }}
          aria-current={isActive ? "location" : undefined}
          sx={{
            py: 0.5,
            pl: 0.5 + indent,
            borderRadius: 1,
            bgcolor: isActive ? "action.selected" : "transparent",
            "&:hover": { bgcolor: isActive ? "action.selected" : "action.hover" },
            minHeight: ITEM_HEIGHT,
            minWidth: 0,
          }}
        >
          <Tooltip title={heading.text} placement="top" arrow>
            <ListItemText
              sx={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}
              primary={
                <Typography
                  variant={heading.level === 1 ? "body2" : "caption"}
                  noWrap
                  sx={{ fontWeight: heading.level === 1 ? 600 : 400, color: isActive ? "primary.main" : "text.primary" }}
                >
                  {heading.text}
                </Typography>
              }
            />
          </Tooltip>
        </ListItemButton>
        {hasChildren && (
          <IconButton size="small" onClick={() => onToggle(heading.id)} aria-label={`${t.toc.toggleSection}: ${heading.text}`} aria-expanded={isExpanded}>
            {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </ListItem>
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <List disablePadding>
            {heading.children.map((child) => (
              <TocItem key={child.id} heading={child} expandedIds={expandedIds} onToggle={onToggle} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

export default function TableOfContents() {
  const { headings, activeHeadingId } = useReadingHeadings();
  const { t } = useI18n();
  const [navVisible, setNavVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const activeAncestorIds = useMemo(() => {
    const result = new Set<string>();
    const revealActiveBranch = (items: Heading[]): boolean => items.some((heading) => {
      if (heading.id === activeHeadingId) return true;
      if (revealActiveBranch(heading.children)) {
        result.add(heading.id);
        return true;
      }
      return false;
    });
    revealActiveBranch(headings);
    return result;
  }, [headings, activeHeadingId]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setNavVisible(window.scrollY <= NAV_HEIGHT);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-expand: greedily expand from top until overflow (fixed 55vh block)
  useEffect(() => {
    if (headings.length === 0) return;

    const maxHeight = window.innerHeight * 0.55 - 60;
    const availableItems = Math.floor(maxHeight / ITEM_HEIGHT);

    const tryExpanded = new Set<string>();
    let itemCount = 0;

    const tryAdd = (hs: Heading[]): boolean => {
      for (const h of hs) {
        if (itemCount >= availableItems) return false;
        tryExpanded.add(h.id);
        itemCount++;
        if (h.children.length > 0) {
          for (const c of h.children) {
            if (itemCount >= availableItems) break;
            tryExpanded.add(c.id);
            itemCount++;
          }
        }
      }
      return true;
    };

    tryAdd(headings);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depends on the measured viewport height.
    setExpandedIds(tryExpanded);
  }, [headings]);

  useEffect(() => {
    if (activeAncestorIds.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reveal the new reading position while allowing subsequent manual collapse.
    setExpandedIds((current) => {
      if ([...activeAncestorIds].every((id) => current.has(id))) return current;
      return new Set([...current, ...activeAncestorIds]);
    });
  }, [activeAncestorIds]);

  // Auto-scroll to keep active heading visible inside the TOC float
  useEffect(() => {
    if (!activeHeadingId || !listRef.current) return;

    // Wait a tick for Collapse transitions to settle
    const raf = requestAnimationFrame(() => {
      const activeEl = listRef.current?.querySelector(
        `[data-heading-id="${CSS.escape(activeHeadingId)}"]`
      );
      const container = listRef.current;
      if (activeEl && container) {
        const activeRect = activeEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (activeRect.top < containerRect.top) {
          container.scrollTop -= containerRect.top - activeRect.top;
        } else if (activeRect.bottom > containerRect.bottom) {
          container.scrollTop += activeRect.bottom - containerRect.bottom;
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activeHeadingId, expandedIds]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (headings.length === 0) {
    return (
      <Box
        component="nav"
        aria-label={t.toc.contents}
        sx={(theme) => ({
          width: tocDesktopWidth,
          flexShrink: 0,
          position: "sticky",
          top: 80,
          pl: 2,
          pr: 2,
          pt: 1.5,
          pb: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.75),
          backdropFilter: 'blur(16px)',
          borderRadius: 5,
          border: 1,
          borderColor: 'divider',
          boxShadow: theme.shadows[4],
          display: { xs: "none", lg: "block" },
        })}
      >
        <Typography
          variant="overline"
          sx={{ px: 1, color: "text.secondary", fontWeight: 600 }}
        >
          {t.toc.contents}
        </Typography>
        <Box sx={{ px: 1, py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t.toc.noHeadings}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={listRef}
      component="nav"
      aria-label={t.toc.contents}
      sx={(theme) => ({
        width: tocDesktopWidth,
        flexShrink: 0,
        position: "sticky",
        top: navVisible ? 80 : 16,
        maxHeight: "55vh",
        overflowY: "auto",
        pl: 2,
        pr: 2,
        pt: 1.5,
        pb: 2,
        zIndex: 1,
        bgcolor: alpha(theme.palette.background.paper, 0.75),
        backdropFilter: 'blur(16px)',
        borderRadius: 5,
        border: 1,
        borderColor: 'divider',
        boxShadow: theme.shadows[4],
        display: { xs: "none", lg: "block" },
        transform: loaded ? "translateX(0)" : "translateX(20px)",
        opacity: loaded ? 1 : 0,
        transition: "top 0.2s, transform 0.3s ease-out, opacity 0.3s ease-out",
      })}
    >
      <Typography
        variant="overline"
        sx={{ px: 1, color: "text.secondary", fontWeight: 600 }}
      >
                {t.toc.contents}
      </Typography>
      <List disablePadding>
        {headings.map((heading) => (
          <TocItem key={heading.id} heading={heading} expandedIds={expandedIds} onToggle={handleToggle} />
        ))}
      </List>
    </Box>
  );
}
