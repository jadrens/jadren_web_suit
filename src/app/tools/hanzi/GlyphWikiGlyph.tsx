"use client";

import { Box } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";

export function glyphWikiUrl(name: string): string {
  return `https://glyphwiki.org/glyph/${name.toLowerCase()}.svg`;
}

export function glyphWikiPage(name: string): string {
  return `https://glyphwiki.org/wiki/${name.toLowerCase()}`;
}

/** Cache successful SVG data URLs, and failures, for the lifetime of the tab. */
const glyphCache = new Map<string, string | null>();

function rememberGlyph(key: string, value: string | null) {
  if (glyphCache.size >= 200) {
    const oldest = glyphCache.keys().next().value;
    if (oldest !== undefined) glyphCache.delete(oldest);
  }
  glyphCache.set(key, value);
}

/**
 * Fetch the SVG ourselves instead of pointing <img> at glyphwiki.org: a
 * missing glyph is served as a 404 PNG placeholder, which browsers may still
 * render. Fetching lets us verify the response is a real SVG and fall back to
 * the local font (or the schematic IDS preview) when it is not.
 */
export default function GlyphWikiGlyph({
  name,
  alt,
  fallback,
}: {
  name: string;
  alt: string;
  fallback: ReactNode;
}) {
  const key = name.toLowerCase();
  const cached = glyphCache.get(key);
  const [result, setResult] = useState<{ key: string; src: string | null } | null>(null);
  const src = cached !== undefined ? cached : result?.key === key ? result.src : undefined;

  useEffect(() => {
    if (cached !== undefined) return;

    let cancelled = false;

    fetch(glyphWikiUrl(key), { referrerPolicy: "no-referrer" })
      .then(async (response) => {
        if (!response.ok) throw new Error("missing glyph");
        const type = response.headers.get("content-type") ?? "";
        if (!type.includes("svg")) throw new Error("not an SVG");
        const text = await response.text();
        if (!text.includes("<svg")) throw new Error("not an SVG");
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      })
      .then((data) => {
        rememberGlyph(key, data);
        if (!cancelled) setResult({ key, src: data });
      })
      .catch(() => {
        rememberGlyph(key, null);
        if (!cancelled) setResult({ key, src: null });
      });

    return () => {
      cancelled = true;
    };
  }, [key, cached]);

  if (!src) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}>
        {fallback}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
          filter: (theme) => (theme.palette.mode === "dark" ? "invert(1)" : "none"),
        }}
        component="img"
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        onError={() => {
          rememberGlyph(key, null);
          setResult({ key, src: null });
        }}
      />
    </Box>
  );
}
