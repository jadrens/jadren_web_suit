"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Box, Paper } from "@mui/material";
import CodeBlock from "./CodeBlock";
import { memo, useEffect, useMemo, useRef } from "react";
import TagIcon from "@mui/icons-material/Tag";
import { useReadingProgressActions } from "./reading/ReadingProgressContext";
import { parseHeadings, slugify } from "./reading/headings";
import React from "react";
import { blogMarkdownSchema } from "./markdown-sanitize";
import { findActiveHeading } from "./reading/active-heading";

interface MarkdownContentProps {
  content: string;
}

function textContent(children: React.ReactNode): string {
  return React.Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (React.isValidElement<{ children?: React.ReactNode; alt?: string }>(child)) {
      return child.props.alt ?? textContent(child.props.children);
    }
    return "";
  }).join("");
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
      element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      window.history.pushState(window.history.state, "", `#${encodeURIComponent(id)}`);
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
          color: "inherit",
          textDecoration: "none",
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
          "& a:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2, borderRadius: 1 },
          ...sx,
        }}
      >
        <a href={`#${encodeURIComponent(id)}`} aria-label={`# ${textContent(children)}`} onClick={handleClick} style={{ display: "inline-flex", alignItems: "center", color: "inherit" }}>
          <span className="heading-hash" aria-hidden="true">
            <TagIcon sx={{ fontSize: "0.9em", color: "text.secondary" }} />
          </span>
          <span className="heading-label" aria-hidden="true">
            {levelIndicator}
          </span>
        </a>
        <span style={{ fontWeight: "inherit", fontSize: "inherit", padding: "0 5px", margin: 0, borderRadius: "4px", position: "relative", zIndex: 1 }}>{children}</span>
      </Paper>
    </Tag>
  );
}

function MarkdownContent({ content }: MarkdownContentProps) {
  const { setHeadings, setActiveHeadingId } = useReadingProgressActions();
  const { headings, idsByLine } = useMemo(() => parseHeadings(content), [content]);
  const headingId = (node: { position?: { start: { line: number } } } | undefined, children: React.ReactNode) =>
    idsByLine.get(node?.position?.start.line ?? -1) ?? (slugify(textContent(children)) || "section");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headingEls = Array.from(contentRef.current?.querySelectorAll("h1, h2, h3") ?? []);
    let frame: number | null = null;
    const updateActiveHeading = () => {
      frame = null;
      setActiveHeadingId(findActiveHeading(headingEls, window.innerHeight * 0.3));
    };
    const scheduleUpdate = () => {
      if (frame === null) frame = requestAnimationFrame(updateActiveHeading);
    };
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    // Images and math can change the article height after the initial render.
    const observer = new ResizeObserver(scheduleUpdate);
    if (contentRef.current) observer.observe(contentRef.current);
    if (!window.location.hash) scheduleUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [content, setActiveHeadingId]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || headings.length === 0) return;

    let targetId: string;
    try {
      targetId = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const flatten = (hs: typeof headings): typeof headings =>
      hs.flatMap((h) => [h, ...flatten(h.children)]);
    const match = flatten(headings).find((h) => h.id === targetId);
    if (!match) return;

    let attempts = 0;
    const maxAttempts = 10;
    let frame: number;
    const tryScroll = () => {
      const element = document.getElementById(match.id);
      if (element) {
        element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      } else if (attempts < maxAttempts) {
        attempts++;
        frame = requestAnimationFrame(tryScroll);
      }
    };
    frame = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(frame);
  }, [headings]);

  useEffect(() => {
    setHeadings(headings);
  }, [headings, setHeadings]);

  return (
    <Box
      ref={contentRef}
      sx={{
        minWidth: 0,
        maxWidth: "100%",
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
          h1: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
              sx={{ fontSize: "2rem", fontWeight: "bold", mt: 4, mb: 2}}
              level={1}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h2: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
              sx={{ fontSize: "1.5rem", fontWeight: "bold", mt: 4, mb: 2}}
              level={2}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h3: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
              sx={{ fontSize: "1.25rem", fontWeight: "bold", mt: 3, mb: 1}}
              level={3}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h4: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
              sx={{ fontSize: "1.1rem", fontWeight: "bold", mt: 2, mb: 1}}
              level={4}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h5: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
              sx={{ fontSize: "1rem", fontWeight: "bold", mt: 2, mb: 1}}
              level={5}
            >
              {children}
            </HeadingWithAnchor>
          ),
          h6: ({ node, children }) => (
            <HeadingWithAnchor
              id={headingId(node, children)}
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

export default memo(MarkdownContent);
