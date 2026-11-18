"use client";

import { Box, alpha } from "@mui/material";
import type { ReactNode } from "react";
import { cleanIdsVariant, parseIds, type IdsNode, type IdsPath } from "./hanzi-data";

export const HANZI_FONT = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "SimSun", "Noto Sans CJK SC", "Noto Serif CJK TC", "MiSans", "WenQuanYi Zen Hei", serif';

const CANVAS = 200;

type Rect = { x: number; y: number; w: number; h: number };

const ROOT: Rect = { x: 0, y: 0, w: CANVAS, h: CANVAS };

/** Strip IDS annotations (source tags like [G], 〾, and [P7-03] placeholders) so the structure can still be drawn. */
export function normalizeIds(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = cleanIdsVariant(value)
    .replace(/〾/g, "")
    .replace(/\[[^\]]*\]/g, "?")
    .replace(/\s+/g, "");
  if (!cleaned) return null;
  return parseIds(cleaned) ? cleaned : null;
}

function inset(rect: Rect, fx: number, fy: number, fw: number, fh: number): Rect {
  return {
    x: rect.x + rect.w * fx,
    y: rect.y + rect.h * fy,
    w: rect.w * fw,
    h: rect.h * fh,
  };
}

function split(rect: Rect, fractions: number[], axis: "x" | "y"): Rect[] {
  const total = axis === "x" ? rect.w : rect.h;
  let offset = 0;
  return fractions.map((fraction) => {
    const size = total * fraction;
    const cell: Rect = {
      x: axis === "x" ? rect.x + offset : rect.x,
      y: axis === "y" ? rect.y + offset : rect.y,
      w: axis === "x" ? size : rect.w,
      h: axis === "y" ? size : rect.h,
    };
    offset += size;
    return cell;
  });
}

function childRects(op: string, rect: Rect): Rect[] {
  switch (op) {
    case "⿰":
      return split(rect, [0.47, 0.53], "x");
    case "⿱":
      return split(rect, [0.47, 0.53], "y");
    case "⿲":
      return split(rect, [0.3, 0.4, 0.3], "x");
    case "⿳":
      return split(rect, [0.3, 0.4, 0.3], "y");
    case "⿴":
      return [rect, inset(rect, 0.23, 0.23, 0.54, 0.54)];
    case "⿵":
      return [rect, inset(rect, 0.25, 0.5, 0.5, 0.44)];
    case "⿶":
      return [rect, inset(rect, 0.25, 0.08, 0.5, 0.44)];
    case "⿷":
      return [rect, inset(rect, 0.4, 0.25, 0.5, 0.5)];
    case "⿸":
      return [rect, inset(rect, 0.4, 0.42, 0.5, 0.5)];
    case "⿹":
      return [rect, inset(rect, 0.1, 0.44, 0.5, 0.5)];
    case "⿺":
      return [rect, inset(rect, 0.36, 0.06, 0.54, 0.54)];
    case "⿼":
      return [rect, inset(rect, 0.1, 0.25, 0.5, 0.5)];
    case "⿽":
      return [rect, inset(rect, 0.1, 0.1, 0.5, 0.5)];
    case "⿾":
    case "⿿":
      return [rect];
    case "⿻":
      return [rect, rect];
    default:
      return split(rect, [0.5, 0.5], "x");
  }
}

interface SlotEditing {
  selected: string | null;
  onSelect: (path: IdsPath) => void;
  label: (atom: string) => string;
}

function AtomGlyph({ atom, rect }: { atom: string; rect: Rect }) {
  if (atom === "?" || atom === "*") {
    return (
      <g>
        <rect
          x={rect.x + 4}
          y={rect.y + 4}
          width={Math.max(rect.w - 8, 0)}
          height={Math.max(rect.h - 8, 0)}
          fill="none"
          stroke="currentColor"
          strokeDasharray="6 6"
          strokeWidth={2}
          opacity={0.28}
        />
        <text
          x={rect.x + rect.w / 2}
          y={rect.y + rect.h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(rect.w, rect.h) * 0.45}
          fill="currentColor"
          opacity={0.45}
          fontFamily="var(--font-jetbrains-mono)"
        >
          {atom}
        </text>
      </g>
    );
  }

  return (
    <svg x={rect.x} y={rect.y} width={rect.w} height={rect.h} viewBox="0 0 200 200" preserveAspectRatio="none" overflow="visible">
      <text x={100} y={100} textAnchor="middle" dominantBaseline="central" fontSize={200} fill="currentColor" fontFamily={HANZI_FONT}>
        {atom}
      </text>
    </svg>
  );
}

function Atom({ atom, rect, path, editing }: { atom: string; rect: Rect; path: IdsPath; editing?: SlotEditing }) {
  if (!editing) return <AtomGlyph atom={atom} rect={rect} />;
  const key = path.join(".");
  const selected = editing.selected === key;
  return (
    <g
      className={selected ? "ids-slot ids-slot-selected" : "ids-slot"}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={editing.label(atom)}
      onClick={() => editing.onSelect(path)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editing.onSelect(path);
        }
      }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {/* Transparent hit area so the whole slot is clickable, not just the glyph's strokes. */}
      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="transparent" />
      <AtomGlyph atom={atom} rect={rect} />
      <rect
        className="ids-slot-outline"
        x={rect.x + 1.5}
        y={rect.y + 1.5}
        width={Math.max(rect.w - 3, 0)}
        height={Math.max(rect.h - 3, 0)}
        rx={6}
        fill="none"
        strokeWidth={3}
      />
    </g>
  );
}

function renderNode(node: IdsNode, rect: Rect, path: IdsPath, editing?: SlotEditing): ReactNode {
  const key = path.join(".") || "root";
  if ("atom" in node) return <Atom key={key} atom={node.atom} rect={rect} path={path} editing={editing} />;
  const rects = childRects(node.op, rect);
  return (
    <g key={key}>
      {node.children.map((child, index) => renderNode(child, rects[index] ?? rect, [...path, index], editing))}
    </g>
  );
}

export default function IdsPreview({
  value,
  size = 160,
  framed = true,
  label,
  editing,
}: {
  value: string;
  size?: number;
  framed?: boolean;
  label?: string;
  /** Makes each component slot selectable; `selected` is the slot's path joined with ".". */
  editing?: SlotEditing;
}) {
  const normalized = normalizeIds(value);
  if (!normalized) return null;
  const tree = parseIds(normalized);
  if (!tree) return null;

  const svg = (
    <svg
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
      width="100%"
      height="100%"
      role="img"
      aria-label={label ?? `IDS ${normalized}`}
      style={{ display: "block", color: "inherit" }}
    >
      {renderNode(tree, ROOT, [], editing)}
    </svg>
  );

  if (!framed) return svg;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        p: 1,
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "background.paper",
        color: "text.primary",
        overflow: "hidden",
        // Slot outlines: faint on hover / keyboard focus, accent when selected.
        "& .ids-slot-outline": { stroke: "transparent", transition: "stroke 0.15s ease" },
        "& .ids-slot:hover .ids-slot-outline, & .ids-slot:focus-visible .ids-slot-outline": { stroke: (theme) => alpha(theme.palette.primary.main, 0.5) },
        "& .ids-slot-selected .ids-slot-outline, & .ids-slot-selected:hover .ids-slot-outline": { stroke: (theme) => theme.palette.primary.main },
        "& .ids-slot-selected": { color: "primary.main" },
      }}
    >
      {svg}
    </Box>
  );
}
