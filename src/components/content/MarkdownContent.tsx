"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Box, Paper } from "@mui/material";
import CodeBlock from "./CodeBlock";
import { useEffect, useRef, useCallback } from "react";
import TagIcon from "@mui/icons-material/Tag";
import { extractHeadings, useReadingProgress, slugify } from "./reading/ReadingProgressContext";
import React from "react";
import { tocDesktopWidth } from "@config/publishing/toc";
import { blogMarkdownSchema } from "./markdown-sanitize";

interface MarkdownContentProps {
  content: string;
}

function HeadingWithAnchor({
  id,
  children,
  sx,
  level,
}: {
  id: string;
  children: React.ReactNode;
  sx?: object;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.pushState(null, "", `#${id}`);
    }
  };

  const Tag = `h${level}` as const;

  const levelIndicator = {
    1: "H1",
    2: "H2",
    3: "H3",
    4: "H4",
    5: "H5",
    6: "H6",
  }[level];

  return (
    <Tag
      id={id}
      data-heading-id={id}
      style={{ scrollMarginTop: "80px", position: "relative", marginLeft: "0" }}
    >
      <Paper
        component="span"
        elevation={0}
        onClick={handleClick}
        sx={{
          position: "relative",
          maxWidth: "100%",
          overflow: "hidden",
          wordBreak: "break-all",
          overflowWrap: "anywhere",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          cursor: "pointer",
          fontWeight: "inherit",
          fontSize: "inherit",
          lineHeight: "inherit",
          bgcolor: "background.default",
          transition: "all 0.2s ease",
          "& .heading-hash": { position: "absolute", opacity: 1, transition: "opacity 0.2s ease", display: "flex", alignItems: "center" },
          "& .heading-label": { opacity: 0, transition: "opacity 0.2s ease", display: "flex", alignItems: "center", fontWeight: 500, fontSize: "0.9em", color: "text.secondary" },
          "&:hover": { bgcolor: "action.selected", transform: "translateX(2px)" },
          "&:hover .heading-hash": { opacity: 0 },
          "&:hover .heading-label": { opacity: 1 },
          ...sx,
        }}
      >
        <span className="heading-hash">
          <TagIcon sx={{ fontSize: "0.9em", color: "text.secondary" }} />
        </span>
        <span className="heading-label">
          {levelIndicator}
        </span>
        <span style={{ fontWeight: "inherit", fontSize: "inherit", padding: "0 5px", margin: 0, borderRadius: "4px", position: "relative", zIndex: 1 }}>{children}</span>
      </Paper>
    </Tag>
  );
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const { headings, setHeadings, setActiveHeadingId } = useReadingProgress();
  const contentRef = useRef<HTMLDivElement>(null);

  const updateActiveHeading = useCallback(() => {
    if (!contentRef.current) return;

    const headingEls = contentRef.current.querySelectorAll("h1, h2, h3");
    if (headingEls.length === 0) return;

    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const triggerPoint = scrollY + viewportHeight * 0.3;

    let activeId: string | null = null;
    let lastTop = -Infinity;

    headingEls.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      const absoluteTop = rect.top + scrollY;

      if (absoluteTop <= triggerPoint && absoluteTop > lastTop) {
        lastTop = absoluteTop;
        activeId = heading.getAttribute("data-heading-id");
      }
    });

    if (activeId && activeId !== window.location.hash.slice(1)) {
      setActiveHeadingId(activeId);
    }
  }, [setActiveHeadingId]);

  useEffect(() => {
    window.addEventListener("scroll", updateActiveHeading, { passive: true });
    // Skip on mount if there's a hash fragment — let the fragment scroll effect go first
    if (!window.location.hash) {
      updateActiveHeading();
    }

    return () => {
      window.removeEventListener("scroll", updateActiveHeading);
    };
  }, [updateActiveHeading]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || headings.length === 0) return;

    const targetId = decodeURIComponent(hash.slice(1));
    const flatten = (hs: typeof headings): typeof headings =>
      hs.flatMap((h) => [h, ...flatten(h.children)]);
    const match = flatten(headings).find((h) => h.id === targetId);
    if (!match) return;

    let attempts = 0;
    const maxAttempts = 10;
    const tryScroll = () => {
      const element = document.getElementById(match.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
  }, [headings]);

  useEffect(() => {
    setHeadings(extractHeadings(content));
  }, [content, setHeadings]);

  return (
    <Box
      ref={contentRef}
      sx={{
        maxWidth: {
          xs: "100vw",
          sm: `calc(100vw - ${tocDesktopWidth}px)`,
        },
        "& h1": {
          mt: 4, mb: 2, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "2rem",
          transition: 'all 0.3s ease',
        },
        "& h2": {
          mt: 4, mb: 2, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "1.5rem",
          transition: 'all 0.3s ease',
        },
        "& h3": {
          mt: 3, mb: 1, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "1.25rem",
          transition: 'all 0.3s ease',
        },
        "& h4": {
          mt: 2, mb: 1, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "1.1rem",
          transition: 'all 0.3s ease',
        },
        "& h5": {
          mt: 2, mb: 1, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "1rem",
          transition: 'all 0.3s ease',
        },
        "& h6": {
          mt: 2, mb: 1, mx: { xs: 3, sm: 2 }, fontWeight: "bold", fontSize: "0.9rem",
          transition: 'all 0.3s ease',
        },
        "& p": { mb: 2, mx: { xs: 3, sm: 2 }, lineHeight: 1.7, color: "text.secondary" },
        "& ul, & ol": { mb: 2, pl: 4, mx: { xs: 3, sm: 2 } },
        "& li": { mb: 0.5 },
        "& blockquote": {
          mb: 2,
          mx: { xs: 3, sm: 2 },
          pl: 2,
          borderLeft: "4px solid",
          borderColor: "divider",
          fontStyle: "italic",
        },
        "& code": {
          bgcolor: "action.hover",
          px: 0.5,
          borderRadius: 0.5,
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          fontSize: "0.9em",
        },
        "& table": { mb: 2, mx: { xs: 3, sm: 2 }, width: "calc(100% - 48px)", borderCollapse: "collapse" },
        "& th, & td": { border: 1, borderColor: "divider", p: 1 },
        "& th": { fontWeight: "bold" },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, blogMarkdownSchema],
          rehypeKatex,
          rehypeHighlight,
        ]}
        components={{
          pre: ({ children}) => {
            let className = '';
  
            React.Children.forEach(children, (child) => {
              if (React.isValidElement(child) && child.type === 'code') {
                className = (child.props as { className?: string }).className || '';
              }
            });
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          h1: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "2rem", fontWeight: "bold", mt: 4, mb: 2}}
              level={1}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h2: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "1.5rem", fontWeight: "bold", mt: 4, mb: 2}}
              level={2}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h3: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "1.25rem", fontWeight: "bold", mt: 3, mb: 1}}
              level={3}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h4: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "1.1rem", fontWeight: "bold", mt: 2, mb: 1}}
              level={4}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h5: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "1rem", fontWeight: "bold", mt: 2, mb: 1}}
              level={5}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h6: ({ children }) => (
            <HeadingWithAnchor
              id={slugify(String(children))}
              sx={{ fontSize: "0.9rem", fontWeight: "bold", mt: 2, mb: 1}}
              level={6}
            >
              {children}
            </HeadingWithAnchor>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
