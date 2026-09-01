"use client";

import { Box, Drawer, List, ListItem, ListItemButton, ListItemText, Collapse, Typography, IconButton, AppBar, Toolbar, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useState, useEffect } from "react";
import { useReadingProgress, Heading } from "../reading/ReadingProgressContext";
import { useI18n } from "@shared/libs/i18n/blog";
import { tocMobileWidth } from "@blog/var/toc";

interface TocItemProps {
  heading: Heading;
  onSelect: () => void;
}

const INDENT_PER_LEVEL = 1.5;

function TocItem({ heading, onSelect }: TocItemProps) {
  const { activeHeadingId } = useReadingProgress();
  const hasChildren = heading.children.length > 0;
  const isActive = activeHeadingId === heading.id;
  const isH1 = heading.level === 1;

  const isDescendantActive = (h: Heading): boolean => {
    if (h.id === activeHeadingId) return true;
    return h.children.some(isDescendantActive);
  };

  const shouldBeOpen = isH1 || isActive || (hasChildren && heading.children.some(isDescendantActive));
  const [open, setOpen] = useState(shouldBeOpen);

  useEffect(() => {
    if (shouldBeOpen && !open) {
      setOpen(true);
    }
  }, [shouldBeOpen, open]);

  const handleClick = () => {
    if (hasChildren && !open) {
      setOpen(true);
    } else {
      const element = document.getElementById(heading.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.pushState(null, "", `#${heading.id}`);
      }
      onSelect();
      if (hasChildren) {
        setOpen(!open);
      }
    }
  };

  const indent = (heading.level - 1) * INDENT_PER_LEVEL;

  return (
    <>
      <ListItem disablePadding disableGutters>
        <ListItemButton
          onClick={handleClick}
          sx={{
            py: 0.75,
            pl: 1 + indent,
            borderRadius: 1,
            bgcolor: isActive ? "action.selected" : "transparent",
            "&:hover": { bgcolor: isActive ? "action.selected" : "action.hover" },
          }}
        >
          {hasChildren && (
            <Box sx={{ mr: 0.5, display: "flex", alignItems: "center" }}>
              {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          )}
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
      </ListItem>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {heading.children.map((child) => (
              <TocItem key={child.id} heading={child} onSelect={onSelect} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

interface TableOfContentsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function TableOfContentsDrawer({ open, onClose }: TableOfContentsDrawerProps) {
  const { headings } = useReadingProgress();
  const { t } = useI18n();

  const handleSelect = () => {
    onClose();
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        display: { xs: "block", sm: "none" },
        "& .MuiDrawer-paper": {
          width: `min(${tocMobileWidth}px, 100vw)`,
          maxWidth: "100vw",
          boxSizing: "border-box"
        },
      }}
    >
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
                    {t.toc.contents}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ overflowY: "auto", flexGrow: 1 }}>
        {headings.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t.toc.noHeadings}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ pt: 1 }}>
            {headings.map((heading) => (
              <TocItem key={heading.id} heading={heading} onSelect={handleSelect} />
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}