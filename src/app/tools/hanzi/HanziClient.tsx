"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Footer from "@components/ui/layout/Footer";
import { toast } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import type { TranslationKeys } from "@lib/i18n/app/en";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import {
  IDS_OPERATORS,
  U_STATUS_FILTERS,
  buildIdsIndexAsync,
  charactersForRadical,
  cleanIdsVariant,
  completeIds,
  idsArity,
  idsNodeAt,
  idsWildcardPaths,
  parseIds,
  replaceIdsNode,
  serializeIds,
  charactersForStrokes,
  codepointCharacters,
  codepointOf,
  findCharacter,
  findUSourceById,
  formatCodepoint,
  hasIdsOperator,
  loadCore,
  loadDetails,
  matchesUStatus,
  radicalOf,
  regionKeys,
  residualGroups,
  searchIds,
  searchPinyin,
  statusInfo,
  unicodeBlock,
  type HanziCore,
  type HanziDetails,
  type IdsIndex,
  type IdsNode,
  type IdsPath,
  type IdsSearchResult,
  type RadicalInfo,
  type USourceEntry,
  type UStatusFilter,
} from "./hanzi-data";
import GlyphWikiGlyph, { glyphWikiPage } from "./GlyphWikiGlyph";
import IdsOperatorIcon from "./IdsOperatorIcon";
import IdsPreview, { HANZI_FONT, normalizeIds } from "./IdsPreview";

type Mode = "filter" | "ids" | "usource";

type Selection = { kind: "char"; index: number } | { kind: "u"; entry: USourceEntry } | null;

const MODES: Mode[] = ["filter", "ids", "usource"];
/** Tabs from before radical, strokes and pinyin were merged into one filter page; old links still open it. */
const LEGACY_FILTER_MODES = ["char", "radical", "strokes", "pinyin"];
const CHUNK = 240;
/** Reading order of two slots: lexicographic by child index, a prefix (ancestor) first. */
function comparePaths(a: IdsPath, b: IdsPath): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}

/** Structures offered for a plain run of components, by how many components were typed. */
const ARRANGE_LAYOUTS: Record<number, readonly (typeof IDS_OPERATORS)[number][]> = {
  2: ["⿰", "⿱", "⿴", "⿵", "⿸", "⿺", "⿻"],
  3: ["⿲", "⿳"],
};
const IDS_LIMIT = 600;
const TOOL_BUTTON_SX = { width: 34, height: 34, display: "grid", placeItems: "center", p: 0, border: 1, borderColor: "divider", borderRadius: 0.75, "&:hover": { bgcolor: "action.hover" } } as const;
const EMPTY_IDS_RESULT: IdsSearchResult = { characters: [], total: 0, usource: [], completed: null };
const IDS_EXAMPLES = [
  { value: "女马" },
  { operator: "⿰", value: "女马" },
  { operator: "⿱", value: "口?" },
  { operator: "⿰", value: "木*" },
];
const COMMON_COMPONENTS = [
  "亻", "氵", "扌", "艹", "忄", "辶", "阝", "犭", "讠", "钅", "纟", "门", "马", "鸟",
  "鱼", "车", "贝", "见", "页", "风", "饣", "礻", "衤", "灬", "刂", "攵", "彳", "疒",
  "牜", "罒", "竹", "雨", "隹", "骨", "鬼", "鹿", "鼠", "鼻", "齿", "龙", "龟",
];

function glyphForUSource(entry: USourceEntry): string {
  const info = statusInfo(entry.status);
  const character = codepointCharacters(entry.codepoint)[0];
  if (info.kind === "encoded" && character) return character;
  return entry.ids || "";
}

/** The default CJK font stack reliably covers the URO and Ext A, not later planes. */
function fontLikelyCovers(codepoint: number): boolean {
  return (codepoint >= 0x4e00 && codepoint <= 0x9fff) || (codepoint >= 0x3400 && codepoint <= 0x4dbf);
}

function statusLabel(entry: USourceEntry, text: TranslationKeys["tools"]["hanzi"]): string {
  const info = statusInfo(entry.status);
  switch (info.kind) {
    case "encoded":
      if (entry.status === "Comp") return text.status.compatibility;
      if (info.extension) return text.status.encodedExt(info.extension);
      return text.status.uro;
    case "pending":
      return entry.status === "WS-2024" ? text.status.ws2024 : text.status.pending;
    case "rejected":
      return text.status.rejected;
    case "variant":
      return text.status.variant;
    case "duplicate":
      return text.status.duplicate(entry.status);
    case "other":
      return entry.status === "NoAction" ? text.status.noAction : text.status.other;
  }
}

export default function HanziClient() {
  const { t } = useI18n();
  const text = t.tools.hanzi;
  const theme = useTheme();
  useDocumentTitle(text.title);

  const [core, setCore] = useState<HanziCore | null>(null);
  const [coreError, setCoreError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [details, setDetails] = useState<HanziDetails | null>(null);
  const [detailsError, setDetailsError] = useState(false);

  const [mode, setMode] = useState<Mode>("filter");
  const [selection, setSelection] = useState<Selection>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [charQuery, setCharQuery] = useState("");
  const [radicalKey, setRadicalKey] = useState<string | null>(null);
  const [residual, setResidual] = useState<number | null>(null);
  const [strokes, setStrokes] = useState<number | null>(null);
  const [pinyinQuery, setPinyinQuery] = useState("");
  const [idsQuery, setIdsQuery] = useState("");
  const [idsDebounced, setIdsDebounced] = useState("");
  const [idsIndex, setIdsIndex] = useState<IdsIndex | null>(null);
  /** Preview slot being edited (path joined with "."), or null when the composer types at the caret. */
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotInput, setSlotInput] = useState("");
  const [uFilter, setUFilter] = useState<UStatusFilter>("unencoded");
  const [uQuery, setUQuery] = useState("");
  const resultsKey = `${mode}|${radicalKey}|${residual}|${strokes}|${pinyinQuery}|${idsQuery}|${uFilter}|${uQuery}`;
  const [visibleState, setVisibleState] = useState({ key: resultsKey, count: CHUNK });
  const visible = visibleState.key === resultsKey ? visibleState.count : CHUNK;
  const showMore = () => setVisibleState({ key: resultsKey, count: visible + CHUNK });
  const [urlReady, setUrlReady] = useState(false);

  const initialized = useRef(false);
  const idsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadCore()
      .then((loaded) => {
        if (alive) setCore(loaded);
      })
      .catch(() => {
        if (alive) setCoreError(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  const ensureDetails = useCallback(() => {
    setDetailsError(false);
    loadDetails()
      .then(setDetails)
      .catch(() => setDetailsError(true));
  }, []);

  useEffect(() => {
    if (!core || details || detailsError) return;
    const timer = window.setTimeout(ensureDetails, 1200);
    return () => window.clearTimeout(timer);
  }, [core, details, detailsError, ensureDetails]);

  const openSelection = useCallback(
    (next: Selection) => {
      setSelection(next);
      if (next?.kind === "char") ensureDetails();
      if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1200px)").matches) {
        setDetailOpen(true);
      }
    },
    [ensureDetails],
  );

  /* ------------------------------------------------------------ deep link --- */

  /* eslint-disable react-hooks/set-state-in-effect -- one-time bootstrap from the URL once the async data has loaded */
  useEffect(() => {
    if (!core || initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    if (requestedMode && (MODES as string[]).includes(requestedMode)) {
      setMode(requestedMode as Mode);
      if (requestedMode === "ids") ensureDetails();
    } else if (requestedMode && LEGACY_FILTER_MODES.includes(requestedMode)) {
      setMode("filter");
    }

    const u = params.get("u");
    if (u) {
      const entry = findUSourceById(core, u);
      if (entry) {
        setSelection({ kind: "u", entry });
        setCharQuery(entry.id);
      }
    }

    const char = params.get("char");
    if (char) {
      const index = findCharacter(core, char);
      if (index !== null) {
        setSelection({ kind: "char", index });
        setCharQuery(char);
      }
    }

    const radical = params.get("radical");
    if (radical && core.byRadical.has(radical)) {
      setRadicalKey(radical);
      const value = params.get("residual");
      if (value !== null && /^\d+$/.test(value)) setResidual(Number(value));
    }

    const strokeValue = params.get("strokes");
    if (strokeValue && /^\d+$/.test(strokeValue)) setStrokes(Number(strokeValue));

    const pinyin = params.get("pinyin");
    if (pinyin) setPinyinQuery(pinyin);

    const ids = params.get("ids");
    if (ids) setIdsQuery(ids);

    const status = params.get("status");
    if (status && (U_STATUS_FILTERS as readonly string[]).includes(status)) setUFilter(status as UStatusFilter);

    const usourceQuery = params.get("q");
    if (usourceQuery) setUQuery(usourceQuery);

    setUrlReady(true);
  }, [core, ensureDetails]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!core || !urlReady) return;
    const params = new URLSearchParams();
    if (mode !== "filter") params.set("mode", mode);
    if (selection?.kind === "char") params.set("char", core.chars[selection.index]);
    if (selection?.kind === "u") params.set("u", selection.entry.id);
    if (mode === "filter") {
      if (pinyinQuery) params.set("pinyin", pinyinQuery);
      if (radicalKey !== null) {
        params.set("radical", radicalKey);
        if (residual !== null) params.set("residual", String(residual));
      }
      if (strokes !== null) params.set("strokes", String(strokes));
    }
    if (mode === "ids" && idsQuery) params.set("ids", idsQuery);
    if (mode === "usource") {
      params.set("status", uFilter);
      if (uQuery) params.set("q", uQuery);
    }
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [core, urlReady, mode, selection, radicalKey, residual, strokes, pinyinQuery, idsQuery, uFilter, uQuery]);

  /* ---------------------------------------------------------------- data --- */

  useEffect(() => {
    const timer = window.setTimeout(() => setIdsDebounced(idsQuery), 120);
    return () => window.clearTimeout(timer);
  }, [idsQuery]);

  // The component index is built once per dataset, in slices, the first time IDS search is needed.
  useEffect(() => {
    if (!core || !details || idsIndex || mode !== "ids") return;
    const controller = new AbortController();
    buildIdsIndexAsync(core, details, controller.signal)
      .then(setIdsIndex)
      .catch(() => { /* aborted: rebuilt next time IDS mode is opened */ });
    return () => controller.abort();
  }, [core, details, idsIndex, mode]);

  const radicalGroups = useMemo(() => {
    if (!core) return [] as { strokes: number; radicals: RadicalInfo[] }[];
    const groups = new Map<number, RadicalInfo[]>();
    for (const radical of core.radicals) {
      const list = groups.get(radical.strokes);
      if (list) list.push(radical);
      else groups.set(radical.strokes, [radical]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([groupStrokes, radicals]) => ({ strokes: groupStrokes, radicals }));
  }, [core]);

  const currentRadical = useMemo(() => {
    if (!core || radicalKey === null) return undefined;
    return core.radicals.find((radical) => radical.key === radicalKey);
  }, [core, radicalKey]);

  /* Filter page: pinyin, radical (+ residual) and total strokes intersect. Each facet's counts apply the other facets. */
  const pinyinMatches = useMemo(() => {
    if (!core || mode !== "filter" || !pinyinQuery.trim()) return null;
    return searchPinyin(core, pinyinQuery);
  }, [core, mode, pinyinQuery]);
  const pinyinSet = useMemo(() => (pinyinMatches ? new Set(pinyinMatches) : null), [pinyinMatches]);
  const radicalMatches = useMemo(() => {
    if (!core || mode !== "filter" || radicalKey === null) return null;
    return charactersForRadical(core, radicalKey, residual);
  }, [core, mode, radicalKey, residual]);
  const radicalSet = useMemo(() => (radicalMatches ? new Set(radicalMatches) : null), [radicalMatches]);

  const residuals = useMemo(() => {
    if (!core || radicalKey === null) return [] as { residual: number; count: number }[];
    const groups = residualGroups(core, radicalKey);
    if (!pinyinSet && strokes === null) return groups;
    return groups
      .map((group) => ({
        residual: group.residual,
        count: (core.byRadical.get(radicalKey)?.get(group.residual) ?? []).filter(
          (index) => (!pinyinSet || pinyinSet.has(index)) && (strokes === null || core.totalStrokes[index] === strokes),
        ).length,
      }))
      .filter((group) => group.count > 0 || group.residual === residual);
  }, [core, radicalKey, residual, pinyinSet, strokes]);

  /** Radicals that still have characters under the pinyin and stroke filters; null when neither is active. */
  const availableRadicals = useMemo(() => {
    if (!core || mode !== "filter" || (!pinyinMatches && strokes === null)) return null;
    const keys = new Set<string>();
    for (const index of pinyinMatches ?? charactersForStrokes(core, strokes ?? 0)) {
      if (strokes === null || core.totalStrokes[index] === strokes) keys.add(radicalOf(core, index).key);
    }
    return keys;
  }, [core, mode, pinyinMatches, strokes]);

  const strokeCounts = useMemo(() => {
    if (!core) return [] as { strokes: number; count: number }[];
    const narrowed = radicalMatches ?? pinyinMatches;
    if (!narrowed) {
      return [...core.byStrokes.entries()].map(([value, positions]) => ({ strokes: value, count: positions.length })).sort((a, b) => a.strokes - b.strokes);
    }
    const counts = new Map<number, number>();
    for (const index of narrowed) {
      if (radicalMatches && pinyinSet && !pinyinSet.has(index)) continue;
      const value = core.totalStrokes[index];
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    if (strokes !== null && !counts.has(strokes)) counts.set(strokes, 0);
    return [...counts.entries()].map(([value, count]) => ({ strokes: value, count })).sort((a, b) => a.strokes - b.strokes);
  }, [core, radicalMatches, pinyinMatches, pinyinSet, strokes]);

  const uCounts = useMemo(() => {
    const counts = new Map<UStatusFilter, number>();
    if (!core) return counts;
    for (const filter of U_STATUS_FILTERS) {
      counts.set(filter, core.usource.filter((entry) => matchesUStatus(entry, filter)).length);
    }
    return counts;
  }, [core]);

  const filterActive = Boolean(pinyinQuery.trim()) || radicalKey !== null || strokes !== null;
  const charResults = useMemo(() => {
    if (!core || mode !== "filter") return [] as number[];
    // Pinyin order (by reading) wins when present; otherwise the lists are already sorted by commonness.
    const base = pinyinMatches ?? radicalMatches ?? (strokes !== null ? charactersForStrokes(core, strokes) : null);
    if (!base) return [];
    return base.filter(
      (index) => (!radicalSet || radicalSet.has(index)) && (strokes === null || core.totalStrokes[index] === strokes),
    );
  }, [core, mode, pinyinMatches, radicalMatches, radicalSet, strokes]);

  const clearFilters = () => {
    setPinyinQuery("");
    setRadicalKey(null);
    setResidual(null);
    setStrokes(null);
  };

  const idsResults = useMemo(() => {
    if (!core || mode !== "ids") return EMPTY_IDS_RESULT;
    return searchIds(core, idsIndex, idsDebounced, IDS_LIMIT);
  }, [core, idsIndex, mode, idsDebounced]);

  // Preview follows the input live (not the debounced search); unfinished structures preview with "*".
  const idsPreview = useMemo(() => {
    const value = cleanIdsVariant(idsQuery);
    if (!hasIdsOperator(value)) return null;
    return normalizeIds(value) ?? normalizeIds(completeIds(value));
  }, [idsQuery]);

  const structureOperator = useMemo(() => {
    const operators = IDS_OPERATORS as readonly string[];
    return Array.from(idsQuery).find((character) => operators.includes(character)) ?? null;
  }, [idsQuery]);

  // A plain run of 2–3 components can be turned into a structure with one click.
  const arrangeComponents = useMemo(() => {
    const value = cleanIdsVariant(idsQuery);
    if (!value || hasIdsOperator(value)) return null;
    const parts = Array.from(value);
    if (parts.some((part) => part === "?" || part === "*")) return null;
    const layouts = ARRANGE_LAYOUTS[parts.length];
    return layouts ? { value, layouts } : null;
  }, [idsQuery]);

  /* ------------------------------------------------- preview slot editor --- */

  const editTree = useMemo(() => (idsPreview ? parseIds(idsPreview) : null), [idsPreview]);
  // A stale selection (the query was retyped) simply stops applying.
  const activeSlot = useMemo<IdsPath | null>(() => {
    if (!editTree || selectedSlot === null) return null;
    const path = selectedSlot ? selectedSlot.split(".").map(Number) : [];
    const node = idsNodeAt(editTree, path);
    return node && "atom" in node ? path : null;
  }, [editTree, selectedSlot]);
  const activeAtom = activeSlot && editTree ? (idsNodeAt(editTree, activeSlot) as { atom: string }).atom : null;

  const selectSlot = (path: IdsPath | null) => {
    setSelectedSlot(path ? path.join(".") : null);
    setSlotInput("");
  };

  const commitTree = (tree: IdsNode, nextSlot: IdsPath | null) => {
    const value = serializeIds(tree);
    setIdsQuery(value);
    setIdsDebounced(value);
    selectSlot(nextSlot);
  };

  /** Put a component (or a whole sub-structure) into the selected slot, then move to the next empty one. */
  const fillSlot = (replacement: IdsNode) => {
    if (!editTree || !activeSlot) return;
    const next = replaceIdsNode(editTree, activeSlot, replacement);
    if ("atom" in replacement && (replacement.atom === "*" || replacement.atom === "?")) {
      commitTree(next, activeSlot);
      return;
    }
    // Next empty slot in reading order (inside a pasted sub-structure first), wrapping to the start.
    const empties = idsWildcardPaths(next);
    const after = empties.find((path) => comparePaths(path, activeSlot) > 0) ?? empties[0] ?? null;
    commitTree(next, after);
  };

  /** Split the selected slot with an operator: its component becomes the first part, the rest start empty. */
  const splitSlot = (operator: string) => {
    if (!editTree || !activeSlot || !activeAtom) return;
    const keep = activeAtom === "*" || activeAtom === "?" ? "*" : activeAtom;
    const children: IdsNode[] = Array.from({ length: idsArity(operator) }, (_, index) => ({ atom: index === 0 ? keep : "*" }));
    const firstEmpty = children.findIndex((child) => "atom" in child && child.atom === "*");
    commitTree(replaceIdsNode(editTree, activeSlot, { op: operator, children }), [...activeSlot, Math.max(firstEmpty, 0)]);
  };

  /** Undo the split that contains the selected slot, keeping the selected component in its place. */
  const unsplitSlot = () => {
    if (!editTree || !activeSlot?.length || !activeAtom) return;
    const parent = activeSlot.slice(0, -1);
    commitTree(replaceIdsNode(editTree, parent, { atom: activeAtom }), parent.length || hasIdsOperator(activeAtom) ? parent : null);
  };

  const applySlotInput = () => {
    const value = cleanIdsVariant(slotInput);
    if (!value) return;
    const characters = Array.from(value);
    const completed = hasIdsOperator(value) ? completeIds(value) : null;
    const node = completed ? parseIds(completed) : characters.length === 1 ? { atom: characters[0] } : null;
    if (node) fillSlot(node);
  };

  const uResults = useMemo(() => {
    if (!core) return [] as USourceEntry[];
    const query = uQuery.trim().toLowerCase();
    const priority: Record<string, number> = { FutureWS: 0, "WS-2024": 1, NoAction: 2, Rejected: 3, Variant: 4 };
    return core.usource
      .filter((entry) => matchesUStatus(entry, uFilter))
      .filter((entry) => {
        if (!query) return true;
        if (/^u\+/.test(query)) return entry.codepoint.toLowerCase() === query;
        return [entry.id, entry.status, entry.rs, entry.ids, entry.sources, entry.comment].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const left = priority[a.status] ?? 5;
        const right = priority[b.status] ?? 5;
        return left - right || a.id.localeCompare(b.id);
      });
  }, [core, uFilter, uQuery]);

  /* ------------------------------------------------------------- handlers --- */

  const lookup = useCallback(
    (value: string): Selection => {
      if (!core || !value.trim()) return null;
      const entry = findUSourceById(core, value);
      if (entry) return { kind: "u", entry };
      const index = findCharacter(core, value);
      return index === null ? null : { kind: "char", index };
    },
    [core],
  );
  const lookupResult = useMemo(() => lookup(charQuery), [lookup, charQuery]);

  /** Typing updates the side panel live; on narrow screens the detail dialog opens only on Enter. */
  const applyCharQuery = (value: string) => {
    setCharQuery(value);
    const found = lookup(value);
    if (!found) return;
    setSelection(found);
    if (found.kind === "char") ensureDetails();
  };

  const selectChar = (index: number) => {
    openSelection({ kind: "char", index });
  };

  const selectU = (entry: USourceEntry) => {
    openSelection({ kind: "u", entry });
  };

  const searchByIds = (value: string) => {
    const query = cleanIdsVariant(value);
    setMode("ids");
    setIdsQuery(query);
    setIdsDebounced(query);
    ensureDetails();
  };

  const searchByRadical = (key: string) => {
    clearFilters();
    setMode("filter");
    setRadicalKey(key);
  };

  const searchByPinyin = (value: string) => {
    clearFilters();
    setMode("filter");
    setPinyinQuery(value);
  };

  /** Operators, wildcards and components all insert at the caret, so a structure can be composed by clicking. */
  const insertIdsText = (value: string) => {
    if (activeSlot) {
      if (idsArity(value)) splitSlot(value);
      else fillSlot({ atom: value });
      return;
    }
    const input = idsInputRef.current;
    const start = input?.selectionStart ?? idsQuery.length;
    const end = input?.selectionEnd ?? start;
    setIdsQuery(`${idsQuery.slice(0, start)}${value}${idsQuery.slice(end)}`);
    window.requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  const switchToMode = (next: Mode) => {
    setMode(next);
    if (next === "ids") ensureDetails();
  };

  /* --------------------------------------------------------------- detail --- */

  const renderDetail = (): ReactNode => {
    if (!core) return null;
    if (!selection) {
      return (
        <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
          <Typography variant="body2">{text.detail.empty}</Typography>
        </Box>
      );
    }

    if (selection.kind === "u") {
      const entry = selection.entry;
      const info = statusInfo(entry.status);
      const relatedCharacters = codepointCharacters(entry.codepoint);
      const duplicateTarget = info.kind === "duplicate" ? findUSourceById(core, entry.status) : undefined;
      const normalizedIds = normalizeIds(entry.ids);
      const previewIds = normalizedIds && hasIdsOperator(normalizedIds) ? normalizedIds : null;
      const encodedCharacter = codepointCharacters(entry.codepoint)[0];
      const localCharacter = encodedCharacter && fontLikelyCovers(encodedCharacter.codePointAt(0) ?? 0) ? encodedCharacter : null;
      const glyphFallback = localCharacter ?? (previewIds ? <IdsPreview value={previewIds} framed={false} /> : glyphForUSource(entry) || "—");

      return (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 96,
                height: 96,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                fontFamily: HANZI_FONT,
                fontSize: entry.ids && entry.ids.length > 5 ? 20 : 44,
                lineHeight: 1.1,
                p: 1,
                textAlign: "center",
                wordBreak: "break-all",
              }}
            >
              <GlyphWikiGlyph
                name={entry.id}
                alt={glyphForUSource(entry) || entry.id}
                fallback={glyphFallback}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700 }}>
                {entry.id}
              </Typography>
              <Chip size="small" color={info.tone} label={statusLabel(entry, text)} sx={{ mt: 0.75, fontWeight: 600 }} />
              <Link
                href={glyphWikiPage(entry.id)}
                target="_blank"
                rel="noreferrer"
                variant="caption"
                sx={{ display: "inline-block", mt: 0.5 }}
              >
                {text.detail.glyphWiki}
              </Link>
            </Box>
          </Stack>

          <Box>
            <MetaRow label={text.detail.status}>
              <Typography variant="body2">{statusLabel(entry, text)}</Typography>
            </MetaRow>
            {entry.rs ? (
              <MetaRow label={text.detail.radical}>
                <Typography variant="body2" sx={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                  {entry.rs}
                </Typography>
              </MetaRow>
            ) : null}
            {entry.strokes ? (
              <MetaRow label={text.detail.total}>
                <Typography variant="body2">{entry.strokes}</Typography>
              </MetaRow>
            ) : null}
            {entry.firstStroke ? (
              <MetaRow label={text.detail.firstStroke}>
                <Typography variant="body2">{entry.firstStroke}</Typography>
              </MetaRow>
            ) : null}
            {entry.position ? (
              <MetaRow label={text.detail.kangxiPosition}>
                <Typography variant="body2">{entry.position}</Typography>
              </MetaRow>
            ) : null}
            {entry.ids ? (
              <MetaRow label={text.detail.ids}>
                <Typography
                  variant="body1"
                  sx={{ fontFamily: HANZI_FONT, fontSize: entry.ids.length > 12 ? 18 : 24, wordBreak: "break-all", cursor: "pointer" }}
                  onClick={() => searchByIds(entry.ids)}
                  title={entry.ids}
                >
                  {entry.ids}
                </Typography>
                {entry.ids.includes("[") ? (
                  <Typography variant="caption" color="text.secondary">
                    {text.detail.sourceRef}
                  </Typography>
                ) : null}
              </MetaRow>
            ) : (
              <MetaRow label={text.detail.ids}>
                <Typography variant="body2" color="text.secondary">
                  {text.detail.noIds}
                </Typography>
              </MetaRow>
            )}
            {relatedCharacters.length ? (
              <MetaRow label={text.detail.related}>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                  {relatedCharacters.map((character) => {
                    const relatedIndex = core.index.get(character);
                    return relatedIndex === undefined ? (
                      <Chip key={character} size="small" variant="outlined" label={character} sx={{ fontFamily: HANZI_FONT }} />
                    ) : (
                      <Chip
                        key={character}
                        size="small"
                        variant="outlined"
                        label={`${character} ${formatCodepoint(codepointOf(core, relatedIndex))}`}
                        onClick={() => selectChar(relatedIndex)}
                        sx={{ fontFamily: HANZI_FONT }}
                      />
                    );
                  })}
                </Stack>
              </MetaRow>
            ) : null}
            {duplicateTarget ? (
              <MetaRow label={text.detail.related}>
                <Chip size="small" variant="outlined" label={duplicateTarget.id} onClick={() => selectU(duplicateTarget)} />
              </MetaRow>
            ) : null}
            {entry.sources ? (
              <MetaRow label={text.detail.sources}>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {entry.sources}
                </Typography>
              </MetaRow>
            ) : null}
            {entry.comment ? (
              <MetaRow label={text.detail.comment}>
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {entry.comment}
                </Typography>
              </MetaRow>
            ) : null}
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            {entry.ids ? (
              <Button size="small" variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(entry.ids)}>
                {text.detail.ids}
              </Button>
            ) : null}
            <Button size="small" href="https://www.unicode.org/reports/tr45/" target="_blank" rel="noreferrer">
              {text.detail.openUax45}
            </Button>
          </Stack>
        </Stack>
      );
    }

    const index = selection.index;
    const character = core.chars[index];
    const codepoint = codepointOf(core, index);
    const radical = radicalOf(core, index);
    const radicalInfo = core.radicals.find((item) => item.key === radical.key);
    const block = unicodeBlock(codepoint);
    const ids = details?.ids.get(index);
    const definition = details?.definitions.get(index);
    const variants = details?.variants.get(index);
    const extraRs = details?.multiRs.get(index);
    const usourceLink = core.usourceLinks.get(index);
    const uEntry = usourceLink ? core.usourceById.get(usourceLink) : undefined;
    const structureIds = ids
      ?.map((value) => normalizeIds(value))
      .find((value): value is string => Boolean(value && hasIdsOperator(value))) ?? null;

    return (
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              fontFamily: HANZI_FONT,
              fontSize: 58,
              lineHeight: 1,
            }}
          >
            <GlyphWikiGlyph
              name={`u${codepoint.toString(16)}`}
              alt={character}
              fallback={
                structureIds && !fontLikelyCovers(codepoint)
                  ? <IdsPreview value={structureIds} framed={false} />
                  : character
              }
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontFamily: "var(--font-jetbrains-mono)", fontWeight: 700 }}>
              {formatCodepoint(codepoint)}
            </Typography>
            {block ? <Typography variant="body2" color="text.secondary">{text.blocks[block.key as keyof typeof text.blocks]}</Typography> : null}
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
              <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(character)}>
                {text.copy}
              </Button>
              <Button size="small" onClick={() => copy(formatCodepoint(codepoint))}>
                {text.detail.codepoint}
              </Button>
            </Stack>
          </Box>
        </Stack>

        {structureIds ? (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", flexWrap: "wrap", mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{text.detail.structure}</Typography>
              <Typography variant="caption" color="text.secondary">{text.detail.structureHint}</Typography>
            </Stack>
            <IdsPreview value={structureIds} size={160} />
          </Box>
        ) : null}

        <Box>
          <MetaRow label={text.detail.radical}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Chip
                size="small"
                variant="outlined"
                label={`${radical.key}${radicalInfo?.ideograph ? ` ${radicalInfo.ideograph}` : ""}`}
                onClick={() => searchByRadical(radical.key)}
                sx={{ fontFamily: HANZI_FONT }}
              />
              <Typography variant="body2" color="text.secondary">
                {`${text.detail.residual} ${radical.residual} · ${text.detail.total} ${core.totalStrokes[index]}`}
              </Typography>
            </Stack>
          </MetaRow>
          {core.pinyin[index] ? (
            <MetaRow label={text.detail.pinyin}>
              <Typography variant="body2" sx={{ cursor: "pointer" }} onClick={() => searchByPinyin(core.pinyin[index] ?? "")}>
                {core.pinyin[index]}
              </Typography>
            </MetaRow>
          ) : null}
          {extraRs ? (
            <MetaRow label="kRSUnicode">
              <Typography variant="body2" sx={{ fontFamily: "var(--font-jetbrains-mono)" }}>
                {extraRs}
              </Typography>
            </MetaRow>
          ) : null}
          <MetaRow label={text.detail.ids}>
            {details ? (
              ids ? (
                <Stack spacing={0.75}>
                  <Typography
                    variant="body1"
                    sx={{ fontFamily: HANZI_FONT, fontSize: 24, wordBreak: "break-all", cursor: "pointer" }}
                    onClick={() => searchByIds(ids[0])}
                  >
                    {ids[0]}
                  </Typography>
                  {ids.length > 1 ? (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
                      {ids.slice(1).map((variant) => (
                        <Chip key={variant} size="small" variant="outlined" label={variant} onClick={() => searchByIds(variant)} sx={{ fontFamily: HANZI_FONT }} />
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">{text.detail.noIds}</Typography>
              )
            ) : (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">{text.detailsLoading}</Typography>
              </Stack>
            )}
          </MetaRow>
          {definition ? (
            <MetaRow label={text.detail.definition}>
              <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{definition}</Typography>
            </MetaRow>
          ) : null}
          {variants ? (
            <MetaRow label={text.detail.variants}>
              <Stack spacing={0.75}>
                {(["s", "t", "v", "z", "c"] as const).map((key) => {
                  const values = variants[key];
                  if (!values?.length) return null;
                  return (
                    <Stack key={key} direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>
                        {text.detail.variantLabels[key]}
                      </Typography>
                      {values.map((value) => {
                        const variantIndex = core.index.get(value);
                        return (
                          <Chip
                            key={value}
                            size="small"
                            label={value}
                            clickable={variantIndex !== undefined}
                            onClick={variantIndex !== undefined ? () => selectChar(variantIndex) : undefined}
                            sx={{ fontFamily: HANZI_FONT }}
                          />
                        );
                      })}
                    </Stack>
                  );
                })}
              </Stack>
            </MetaRow>
          ) : null}
          <MetaRow label={text.detail.regions}>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
              {regionKeys(core.sourceMasks[index]).map((key) => (
                <Chip key={key} size="small" variant="outlined" label={text.detail.regionNames[key as keyof typeof text.detail.regionNames] ?? key} />
              ))}
            </Stack>
          </MetaRow>
          {uEntry ? (
            <MetaRow label={text.detail.usource}>
              <Chip size="small" variant="outlined" label={`${uEntry.id} · ${statusLabel(uEntry, text)}`} onClick={() => selectU(uEntry)} />
            </MetaRow>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Button size="small" href="https://www.unicode.org/reports/tr38/" target="_blank" rel="noreferrer">
            {text.detail.openUax38}
          </Button>
          <Button size="small" href={glyphWikiPage(`u${codepoint.toString(16)}`)} target="_blank" rel="noreferrer">
            {text.detail.glyphWiki}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">{text.detail.fontNote}</Typography>
      </Stack>
    );
  };

  /* ------------------------------------------------------------------ UI --- */

  const shownCharacters = charResults.slice(0, visible);
  const remaining = charResults.length - shownCharacters.length;
  const charNotFound = charQuery.trim().length > 0 && !lookupResult;

  const renderCharacterGrid = (indices: number[]) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: 0.5 }}>
      {indices.map((index) => {
        const character = core?.chars[index] ?? "";
        const codepoint = core ? codepointOf(core, index) : 0;
        const selected = selection?.kind === "char" && selection.index === index;
        return (
          <Tooltip key={index} title={`${character} ${formatCodepoint(codepoint)}`} enterDelay={400}>
            <ButtonBase
              onClick={() => selectChar(index)}
              sx={{
                height: 56,
                borderRadius: 1,
                border: 1,
                borderColor: selected ? "primary.main" : "divider",
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : "transparent",
                fontFamily: HANZI_FONT,
                fontSize: 26,
                lineHeight: 1,
                transition: "background-color .15s, border-color .15s",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: "primary.main" },
              }}
            >
              {character}
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );

  const renderUSourceGrid = (entries: USourceEntry[]) => (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 0.75 }}>
      {entries.map((entry) => {
        const selected = selection?.kind === "u" && selection.entry.id === entry.id;
        const info = statusInfo(entry.status);
        const label = glyphForUSource(entry);
        const encodedCharacter = codepointCharacters(entry.codepoint)[0];
        const usePreview =
          info.kind !== "encoded" ||
          (encodedCharacter ? !fontLikelyCovers(encodedCharacter.codePointAt(0) ?? 0) : false);
        const normalized = usePreview ? normalizeIds(entry.ids) : null;
        const preview = normalized && hasIdsOperator(normalized) ? normalized : null;
        return (
          <ButtonBase
            key={entry.id}
            onClick={() => selectU(entry)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.25,
              minHeight: 76,
              p: 1,
              borderRadius: 1,
              border: 1,
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : "transparent",
              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: "primary.main" },
            }}
          >
            {preview ? (
              <Box
                sx={{
                  width: 60,
                  height: 60,
                  maxWidth: "100%",
                  color: info.kind === "rejected" ? "text.secondary" : "text.primary",
                }}
                title={label}
              >
                <IdsPreview value={preview} framed={false} label={label} />
              </Box>
            ) : (
              <Box
                sx={{
                  fontFamily: HANZI_FONT,
                  fontSize: label.length > 8 ? 15 : label.length > 4 ? 19 : 24,
                  lineHeight: 1.25,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: info.kind === "rejected" ? "text.secondary" : "text.primary",
                }}
                title={label}
              >
                {label || "—"}
              </Box>
            )}
            <Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary", fontFamily: "var(--font-jetbrains-mono)" }}>
              {entry.id}
            </Typography>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: info.tone === "default" ? "text.disabled" : `${info.tone}.main` }} />
          </ButtonBase>
        );
      })}
    </Box>
  );

  const resultsHeader = (count: number, unit: "characters" | "records") => (
    <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "baseline" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t.tools.hanzi.modes[mode]}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {unit === "characters" ? text.results.characters(count) : text.results.records(count)}
      </Typography>
    </Stack>
  );

  return (
    <div className="page-below-navbar flex flex-col">
      <Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 3 }, py: { xs: 4, sm: 6 } }}>
        <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3, alignItems: { xs: "flex-start", sm: "flex-end" } }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)", mb: 0.75 }}>
                {text.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 820 }}>
                {text.description}
              </Typography>
            </Box>
            {core ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Chip size="small" variant="outlined" label={text.dataVersion(core.version)} />
                <Chip size="small" variant="outlined" label={text.built(core.built)} />
              </Stack>
            ) : null}
          </Stack>

          {coreError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => {
                  setCoreError(false);
                  setReloadToken((value) => value + 1);
                }}>
                  {text.retry}
                </Button>
              }
            >
              {text.loadFailed}
            </Alert>
          ) : !core ? (
            <Paper variant="outlined" sx={{ py: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary">{text.loading}</Typography>
            </Paper>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <TextField
                  label={text.lookup.label}
                  placeholder={text.lookup.placeholder}
                  value={charQuery}
                  onChange={(event) => applyCharQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && lookupResult) {
                      event.preventDefault();
                      openSelection(lookupResult);
                    }
                  }}
                  error={charNotFound}
                  helperText={charNotFound ? `${text.lookup.notFound} ${text.lookup.unencodedHint}` : undefined}
                  fullWidth
                  size="small"
                  autoComplete="off"
                  slotProps={{
                    input: {
                      sx: { fontFamily: HANZI_FONT },
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: charQuery ? (
                        <InputAdornment position="end">
                          {charNotFound && (hasIdsOperator(charQuery) || Array.from(charQuery.trim()).length > 1) ? (
                            <Button size="small" onClick={() => searchByIds(charQuery)} sx={{ mr: 0.5, whiteSpace: "nowrap" }}>
                              {text.lookup.searchIds}
                            </Button>
                          ) : null}
                          {lookupResult ? (
                            <Button size="small" onClick={() => openSelection(lookupResult)} sx={{ mr: 0.5, whiteSpace: "nowrap", display: { lg: "none" } }}>
                              {text.lookup.open}
                            </Button>
                          ) : null}
                          <IconButton size="small" aria-label={text.ids.clear} onClick={() => setCharQuery("")} edge="end">
                            <CloseRoundedIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mb: 3 }}>
                <Tabs
                  value={mode}
                  onChange={(_, value: Mode) => switchToMode(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                  sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
                >
                  {MODES.map((item) => (
                    <Tab key={item} value={item} label={text.modes[item]} />
                  ))}
                </Tabs>

                <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                  {mode === "filter" ? (
                    <Stack spacing={2}>
                      <TextField
                        label={text.pinyin.label}
                        placeholder={text.pinyin.placeholder}
                        value={pinyinQuery}
                        onChange={(event) => setPinyinQuery(event.target.value)}
                        helperText={text.pinyin.hint}
                        fullWidth
                        size="small"
                        autoComplete="off"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" />
                              </InputAdornment>
                            ),
                            endAdornment: pinyinQuery ? (
                              <InputAdornment position="end">
                                <IconButton size="small" aria-label={text.ids.clear} onClick={() => setPinyinQuery("")} edge="end">
                                  <CloseRoundedIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : undefined,
                          },
                        }}
                      />

                      <Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.75 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{text.radical.label}</Typography>
                          <Chip
                            size="small"
                            label={text.filter.any}
                            color={radicalKey === null ? "primary" : "default"}
                            variant={radicalKey === null ? "filled" : "outlined"}
                            onClick={() => {
                              setRadicalKey(null);
                              setResidual(null);
                            }}
                          />
                          {currentRadical ? (
                            <Chip
                              size="small"
                              color="primary"
                              label={text.radical.selected(currentRadical.key, currentRadical.ideograph || currentRadical.radical)}
                              onDelete={() => {
                                setRadicalKey(null);
                                setResidual(null);
                              }}
                            />
                          ) : null}
                        </Stack>
                        <Box
                          sx={{
                            maxHeight: 200,
                            overflow: "auto",
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1,
                            p: 1.25,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          {radicalGroups.map((group) => (
                            <Stack key={group.strokes} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ width: 50, flexShrink: 0, pt: 0.75, whiteSpace: "nowrap" }}>
                                {group.strokes ? text.radical.radicalStrokes(group.strokes) : "—"}
                              </Typography>
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}>
                                {group.radicals.map((radical) => {
                                  const active = radical.key === radicalKey;
                                  const empty = !active && availableRadicals !== null && !availableRadicals.has(radical.key);
                                  return (
                                    <Tooltip key={radical.key} title={`#${radical.key} ${radical.ideograph}`} enterDelay={300}>
                                      <ButtonBase
                                        onClick={() => {
                                          setRadicalKey(active ? null : radical.key);
                                          setResidual(null);
                                        }}
                                        sx={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: 0.75,
                                          border: 1,
                                          borderColor: active ? "primary.main" : "transparent",
                                          bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                                          fontFamily: HANZI_FONT,
                                          fontSize: 18,
                                          opacity: empty ? 0.3 : 1,
                                          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                                        }}
                                      >
                                        {radical.ideograph || radical.radical}
                                      </ButtonBase>
                                    </Tooltip>
                                  );
                                })}
                              </Box>
                            </Stack>
                          ))}
                        </Box>
                      </Box>

                      {radicalKey !== null ? (
                        <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.25 }}>{text.radical.residual}</Typography>
                          <Chip
                            size="small"
                            label={text.filter.any}
                            color={residual === null ? "primary" : "default"}
                            variant={residual === null ? "filled" : "outlined"}
                            onClick={() => setResidual(null)}
                          />
                          {residuals.map((group) => (
                            <Chip
                              key={group.residual}
                              size="small"
                              label={`${group.residual} (${group.count.toLocaleString()})`}
                              color={residual === group.residual ? "primary" : "default"}
                              variant={residual === group.residual ? "filled" : "outlined"}
                              onClick={() => setResidual(residual === group.residual ? null : group.residual)}
                            />
                          ))}
                        </Stack>
                      ) : null}

                      <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Tooltip title={text.strokes.hint} enterDelay={300}>
                          <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.25 }}>{text.strokes.label}</Typography>
                        </Tooltip>
                        <Chip
                          size="small"
                          label={text.filter.any}
                          color={strokes === null ? "primary" : "default"}
                          variant={strokes === null ? "filled" : "outlined"}
                          onClick={() => setStrokes(null)}
                        />
                        {strokeCounts.map((group) => (
                          <Chip
                            key={group.strokes}
                            size="small"
                            label={`${group.strokes} (${group.count.toLocaleString()})`}
                            color={strokes === group.strokes ? "primary" : "default"}
                            variant={strokes === group.strokes ? "filled" : "outlined"}
                            onClick={() => setStrokes(strokes === group.strokes ? null : group.strokes)}
                          />
                        ))}
                      </Stack>

                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="caption" color="text.secondary">{text.filter.hint}</Typography>
                        {filterActive ? (
                          <Button size="small" onClick={clearFilters} sx={{ flexShrink: 0 }}>{text.filter.clear}</Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  ) : null}

                  {mode === "ids" ? (
                    <Stack spacing={1.5}>
                      <TextField
                        inputRef={idsInputRef}
                        label={text.ids.label}
                        placeholder={text.ids.placeholder}
                        value={idsQuery}
                        onChange={(event) => {
                          setIdsQuery(event.target.value);
                          selectSlot(null);
                        }}
                        fullWidth
                        size="small"
                        autoComplete="off"
                        slotProps={{
                          input: {
                            sx: { fontFamily: HANZI_FONT },
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" />
                              </InputAdornment>
                            ),
                            endAdornment: idsQuery ? (
                              <InputAdornment position="end">
                                <IconButton size="small" aria-label={text.ids.clear} onClick={() => { setIdsQuery(""); idsInputRef.current?.focus(); }} edge="end">
                                  <CloseRoundedIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : undefined,
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">{text.ids.hint}</Typography>

                      {/* Composer: everything below inserts at the caret of the field above. */}
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, color: activeSlot ? "primary.main" : undefined }}>
                          {activeSlot ? text.ids.operatorsSplit : text.ids.operators}
                        </Typography>
                        {IDS_OPERATORS.map((operator) => (
                          <Tooltip key={operator} title={`${operator} ${text.ids.operatorNames[operator]}`} enterDelay={250}>
                            <ButtonBase aria-label={text.ids.operatorNames[operator]} onClick={() => insertIdsText(operator)} sx={TOOL_BUTTON_SX}>
                              <IdsOperatorIcon operator={operator} />
                            </ButtonBase>
                          </Tooltip>
                        ))}
                        {(["?", "*"] as const).map((wildcard) => (
                          <Tooltip key={wildcard} title={text.ids.wildcards[wildcard]} enterDelay={250}>
                            <ButtonBase
                              aria-label={text.ids.wildcards[wildcard]}
                              onClick={() => insertIdsText(wildcard)}
                              sx={{ ...TOOL_BUTTON_SX, fontFamily: "var(--font-jetbrains-mono)", fontSize: 18 }}
                            >
                              {wildcard}
                            </ButtonBase>
                          </Tooltip>
                        ))}
                      </Stack>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, color: activeSlot ? "primary.main" : undefined }}>
                          {activeSlot ? text.ids.componentsFill : text.ids.components}
                        </Typography>
                        {COMMON_COMPONENTS.map((component) => (
                          <Chip
                            key={component}
                            size="small"
                            variant="outlined"
                            label={component}
                            onClick={() => insertIdsText(component)}
                            sx={{ fontFamily: HANZI_FONT, minWidth: 30 }}
                          />
                        ))}
                      </Stack>
                      <Stack direction="row" spacing={0.75} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="caption" color="text.secondary">{text.ids.examples}</Typography>
                        {IDS_EXAMPLES.map((example) => (
                          <Chip
                            key={`${example.operator ?? ""}${example.value}`}
                            size="small"
                            icon={example.operator ? <IdsOperatorIcon operator={example.operator} /> : undefined}
                            label={example.value}
                            onClick={() => setIdsQuery(`${example.operator ?? ""}${example.value}`)}
                            sx={{ fontFamily: HANZI_FONT }}
                          />
                        ))}
                      </Stack>

                      {arrangeComponents ? (
                        <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>{text.ids.arrangeAs}</Typography>
                          {arrangeComponents.layouts.map((operator) => (
                            <Chip
                              key={operator}
                              size="small"
                              variant="outlined"
                              icon={<IdsOperatorIcon operator={operator} />}
                              label={text.ids.operatorNames[operator]}
                              onClick={() => setIdsQuery(`${operator}${arrangeComponents.value}`)}
                            />
                          ))}
                        </Stack>
                      ) : null}

                      {idsPreview ? (
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ alignItems: "center" }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape" && activeSlot) selectSlot(null);
                          }}
                        >
                          <IdsPreview
                            value={idsPreview}
                            size={140}
                            label={`IDS ${idsPreview}`}
                            editing={{
                              selected: activeSlot ? activeSlot.join(".") : null,
                              onSelect: (path) => selectSlot(activeSlot?.join(".") === path.join(".") ? null : path),
                              label: (atom) => text.ids.slotLabel(atom),
                            }}
                          />
                          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{text.ids.preview}</Typography>
                              {structureOperator ? (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  icon={<IdsOperatorIcon operator={structureOperator} />}
                                  label={text.ids.operatorNames[structureOperator as keyof typeof text.ids.operatorNames]}
                                />
                              ) : null}
                            </Stack>
                            {activeSlot && activeAtom ? (
                              <>
                                <Typography variant="caption" color="text.secondary">{text.ids.editActive}</Typography>
                                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                                  <TextField
                                    size="small"
                                    value={slotInput}
                                    onChange={(event) => setSlotInput(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        applySlotInput();
                                      }
                                    }}
                                    placeholder={text.ids.editInput(activeAtom)}
                                    autoComplete="off"
                                    slotProps={{ htmlInput: { "aria-label": text.ids.editInput(activeAtom) }, input: { sx: { fontFamily: HANZI_FONT } } }}
                                    sx={{ width: 180 }}
                                  />
                                  <Button size="small" variant="contained" disableElevation onClick={applySlotInput} disabled={!slotInput.trim()}>
                                    {text.ids.editApply}
                                  </Button>
                                  <Button size="small" onClick={() => fillSlot({ atom: "*" })} disabled={activeAtom === "*"}>
                                    {text.ids.editClear}
                                  </Button>
                                  {activeSlot.length ? (
                                    <Button size="small" onClick={unsplitSlot}>{text.ids.editUnsplit}</Button>
                                  ) : null}
                                  <Button size="small" onClick={() => selectSlot(null)}>{text.ids.editDone}</Button>
                                </Stack>
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                {text.ids.editHint} {text.ids.previewHint}
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      ) : null}
                    </Stack>
                  ) : null}

                  {mode === "usource" ? (
                    <Stack spacing={1.5}>
                      <Typography variant="body2" color="text.secondary">{text.usource.intro}</Typography>
                      <TextField
                        label={text.usource.search}
                        value={uQuery}
                        onChange={(event) => setUQuery(event.target.value)}
                        fullWidth
                        size="small"
                        autoComplete="off"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {U_STATUS_FILTERS.map((filter) => (
                          <Chip
                            key={filter}
                            size="small"
                            label={`${text.usource.filters[filter]} (${(uCounts.get(filter) ?? 0).toLocaleString()})`}
                            color={uFilter === filter ? "primary" : "default"}
                            variant={uFilter === filter ? "filled" : "outlined"}
                            onClick={() => setUFilter(filter)}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary">{text.usource.hint}</Typography>
                    </Stack>
                  ) : null}
                </Box>
              </Paper>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 370px" }, gap: 3, alignItems: "start" }}>
                <Box sx={{ minWidth: 0 }}>
                  {mode === "filter" ? (
                    <Box>
                      {resultsHeader(charResults.length, "characters")}
                      {charResults.length ? (
                        <>
                          {renderCharacterGrid(shownCharacters)}
                          {remaining > 0 ? (
                            <Box sx={{ mt: 2, textAlign: "center" }}>
                              <Button variant="outlined" onClick={showMore}>
                                {text.results.more(remaining)}
                              </Button>
                            </Box>
                          ) : null}
                        </>
                      ) : (
                        <Alert severity="info">{filterActive ? text.results.empty : text.filter.empty}</Alert>
                      )}
                    </Box>
                  ) : null}

                  {mode === "ids" ? (
                    <Stack spacing={3}>
                      {idsQuery.trim() ? (
                        <Box>
                          {resultsHeader(idsResults.total, "characters")}
                          {idsResults.completed ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -1, mb: 1.5 }}>
                              {text.ids.completed}{" "}
                              <Box component="span" sx={{ fontFamily: HANZI_FONT, color: "text.primary" }}>{idsResults.completed}</Box>
                            </Typography>
                          ) : null}
                          {!idsIndex ? (
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <CircularProgress size={14} />
                              <Typography variant="caption" color="text.secondary">{details ? text.ids.indexing : text.ids.waiting}</Typography>
                            </Stack>
                          ) : idsResults.characters.length ? (
                            <>
                              {renderCharacterGrid(idsResults.characters.slice(0, visible))}
                              {idsResults.characters.length > visible ? (
                                <Box sx={{ mt: 2, textAlign: "center" }}>
                                  <Button variant="outlined" onClick={showMore}>
                                    {text.results.more(idsResults.characters.length - visible)}
                                  </Button>
                                </Box>
                              ) : idsResults.total > idsResults.characters.length ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                                  {text.ids.capped(idsResults.characters.length, idsResults.total)}
                                </Typography>
                              ) : null}
                            </>
                          ) : (
                            <Alert severity="info">{text.results.empty}</Alert>
                          )}
                        </Box>
                      ) : null}

                      {idsQuery.trim() && idsResults.usource.length ? (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{text.ids.usource}</Typography>
                          {renderUSourceGrid(idsResults.usource)}
                        </Box>
                      ) : null}
                    </Stack>
                  ) : null}

                  {mode === "usource" ? (
                    <Box>
                      {resultsHeader(uResults.length, "records")}
                      {uResults.length ? renderUSourceGrid(uResults.slice(0, visible)) : <Alert severity="info">{text.usource.empty}</Alert>}
                      {uResults.length > visible ? (
                        <Box sx={{ mt: 2, textAlign: "center" }}>
                          <Button variant="outlined" onClick={showMore}>
                            {text.results.more(uResults.length - visible)}
                          </Button>
                        </Box>
                      ) : null}
                    </Box>
                  ) : null}
                </Box>

                <Paper
                  variant="outlined"
                  sx={{
                    display: { xs: "none", lg: "block" },
                    position: "sticky",
                    top: 88,
                    p: 2.5,
                    borderRadius: 2,
                    maxHeight: "calc(100vh - 112px)",
                    overflow: "auto",
                  }}
                >
                  {renderDetail()}
                </Paper>
              </Box>

              <Paper variant="outlined" sx={{ mt: 4, p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{text.about.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{text.about.intro}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 1.5, mb: 2 }}>
                  {text.about.cases.map((item) => (
                    <Box key={item.label} sx={{ display: "flex", gap: 1.25, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                      <Typography sx={{ fontSize: 22, lineHeight: 1.2, fontWeight: 700, color: "primary.main", width: 24, flexShrink: 0 }}>
                        {item.label}
                      </Typography>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{item.body}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>{text.about.note}</Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>{text.about.process}</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>{text.about.sources}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{text.about.sourceList}</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  <Button size="small" href="https://www.unicode.org/reports/tr38/" target="_blank" rel="noreferrer">UAX #38</Button>
                  <Button size="small" href="https://www.unicode.org/reports/tr45/" target="_blank" rel="noreferrer">UAX #45</Button>
                  <Button size="small" href="https://www.unicode.org/charts/unihan.html" target="_blank" rel="noreferrer">Unihan</Button>
                </Stack>
              </Paper>
            </>
          )}
        </Box>
      </Box>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="sm" disableScrollLock>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{text.title}</Typography>
          <IconButton size="small" onClick={() => setDetailOpen(false)} aria-label={text.close}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>{renderDetail()}</DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

function MetaRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "92px minmax(0, 1fr)",
        gap: 1.5,
        py: 0.9,
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ pt: 0.25 }}>{label}</Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
