"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Box,
  Button,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  alpha,
  useTheme as useMuiTheme,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import KeyboardRoundedIcon from "@mui/icons-material/KeyboardRounded";
import ClearAllRoundedIcon from "@mui/icons-material/ClearAllRounded";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { MathfieldElement, Selector } from "mathlive";
import Footer from "@components/ui/layout/Footer";
import { toast } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { KEYBOARD_LAYOUTS } from "./keyboard";
import { buildOutput, exportLatex, type OutputFormat } from "./latex-utils";

type MathfieldClass = typeof MathfieldElement;

interface Line {
  id: string;
  latex: string;
  // Incremented only on external edits (source box, clear, undo) so mathfield typing is never clobbered by stale renders.
  syncVersion: number;
}

type StructureItem =
  | { label: string; latex: string; command?: never }
  | { label: string; command: Selector | [Selector, ...unknown[]]; latex?: never };

const STORAGE_KEY = "tools.latex.lines";
const DEFAULT_LINES = ["f(x)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", ""];

// Inserted templates use MathLive placeholders: #@ wraps the current selection, #? is an empty slot, #0 takes the selection or a slot.
const STRUCTURES: StructureItem[] = [
  { latex: "\\frac{#@}{#?}", label: "\\frac{\\square}{\\square}" },
  { command: "moveToSuperscript", label: "\\square^{\\square}" },
  { command: "moveToSubscript", label: "\\square_{\\square}" },
  { latex: "\\sqrt{#0}", label: "\\sqrt{\\square}" },
  { latex: "\\sqrt[#?]{#0}", label: "\\sqrt[\\square]{\\square}" },
  { latex: "\\left(#0\\right)", label: "(\\square)" },
  { latex: "\\left|#0\\right|", label: "|\\square|" },
  { latex: "\\sum_{#?}^{#?}", label: "\\sum_{\\square}^{\\square}" },
  { latex: "\\prod_{#?}^{#?}", label: "\\prod_{\\square}^{\\square}" },
  { latex: "\\int_{#?}^{#?}", label: "\\int_{\\square}^{\\square}" },
  { latex: "\\lim_{#?\\to#?}", label: "\\lim_{\\square\\to\\square}" },
  { latex: "\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}", label: "\\frac{\\mathrm{d}\\square}{\\mathrm{d}\\square}" },
  { latex: "\\frac{\\partial #?}{\\partial #?}", label: "\\frac{\\partial\\square}{\\partial\\square}" },
  { latex: "\\vec{#0}", label: "\\vec{\\square}" },
  { latex: "\\overline{#0}", label: "\\overline{\\square}" },
  { latex: "\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}", label: "\\begin{pmatrix}\\square&\\square\\\\\\square&\\square\\end{pmatrix}" },
  { latex: "\\begin{cases}#?&#?\\\\#?&#?\\end{cases}", label: "\\begin{cases}\\square\\\\\\square\\end{cases}" },
];

const SYMBOLS = [
  "\\alpha", "\\beta", "\\gamma", "\\delta", "\\epsilon", "\\theta", "\\lambda", "\\mu", "\\pi", "\\sigma", "\\phi", "\\omega", "\\Delta", "\\Omega",
  "\\pm", "\\times", "\\cdot", "\\div", "\\le", "\\ge", "\\ne", "\\approx", "\\equiv", "\\infty", "\\partial", "\\nabla",
  "\\to", "\\Rightarrow", "\\Leftrightarrow", "\\in", "\\notin", "\\subseteq", "\\cup", "\\cap", "\\forall", "\\exists", "\\mathbb{R}", "\\degree",
];

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeLine(latex = "", syncVersion = 0): Line {
  return { id: newId(), latex, syncVersion };
}

function renderLabel(latex: string) {
  return katex.renderToString(latex, { throwOnError: false, output: "html" });
}

function loadLines(): Line[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length > 0 && stored.every((value) => typeof value === "string")) {
      return stored.map((latex: string) => makeLine(latex));
    }
  } catch {
    // Corrupt storage falls back to the sample document.
  }
  return DEFAULT_LINES.map((latex) => makeLine(latex));
}

interface MathLineProps {
  Mathfield: MathfieldClass;
  id: string;
  value: string;
  syncVersion: number;
  register: (id: string, element: MathfieldElement | null) => void;
  onChange: (latex: string) => void;
  onFocus: () => void;
  onEnter: () => void;
  onDeleteEmpty: () => void;
  onMoveOut: (direction: "forward" | "backward" | "upward" | "downward") => void;
}

function MathLine({ Mathfield, id, value, syncVersion, register, ...handlers }: MathLineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const handlersRef = useRef(handlers);
  const initialValue = useRef(value);
  const latestValueRef = useRef(value);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useLayoutEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Layout effect + flushSync in the parent let a new line be focused within the same keystroke, so fast typing is not lost.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const field = new Mathfield();
    field.value = initialValue.current;
    field.smartFence = true;
    field.mathVirtualKeyboardPolicy = "auto";
    field.style.width = "100%";
    field.style.fontSize = "1.35rem";
    field.style.background = "transparent";
    field.style.border = "none";
    field.style.outline = "none";
    field.style.color = "inherit";
    field.style.padding = "6px 4px";

    const onInput = () => handlersRef.current.onChange(field.value);
    const onFocus = () => handlersRef.current.onFocus();
    const onMoveOut = (event: CustomEvent<{ direction: "forward" | "backward" | "upward" | "downward" }>) => {
      event.preventDefault();
      // Tab inside a fraction or bracket emits move-out before the line end; step out of the parent first instead of jumping lines.
      if (event.detail.direction === "forward" && field.position < field.lastOffset) {
        field.executeCommand("moveAfterParent");
        return;
      }
      if (event.detail.direction === "backward" && field.position > 0) {
        field.executeCommand("moveBeforeParent");
        return;
      }
      handlersRef.current.onMoveOut(event.detail.direction);
    };
    // Capture phase runs before MathLive's own key handling inside the shadow root.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Enter" && !event.shiftKey && field.mode !== "latex") {
        event.preventDefault();
        event.stopPropagation();
        handlersRef.current.onEnter();
      } else if (event.key === "Backspace" && field.mode === "math" && field.value === "") {
        event.preventDefault();
        event.stopPropagation();
        handlersRef.current.onDeleteEmpty();
      }
    };
    // Touch keyboard [backspace] deletes via executeCommand("deleteBackward") instead of keydown, firing beforeinput.
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType === "deleteContentBackward" && field.mode === "math" && field.value === "") {
        event.preventDefault();
        handlersRef.current.onDeleteEmpty();
      }
    };

    // The touch keyboard's return key commits instead of sending Enter; a blur also fires "change", but by then the field has lost focus.
    const onCommit = () => {
      if (field.hasFocus() && field.mode !== "latex") handlersRef.current.onEnter();
    };

    field.addEventListener("input", onInput);
    field.addEventListener("beforeinput", onBeforeInput);
    field.addEventListener("change", onCommit);
    field.addEventListener("focus", onFocus);
    field.addEventListener("move-out", onMoveOut);
    field.addEventListener("keydown", onKeyDown, true);
    container.appendChild(field);
    fieldRef.current = field;
    register(id, field);

    return () => {
      field.removeEventListener("input", onInput);
      field.removeEventListener("beforeinput", onBeforeInput);
      field.removeEventListener("change", onCommit);
      field.removeEventListener("focus", onFocus);
      field.removeEventListener("move-out", onMoveOut);
      field.removeEventListener("keydown", onKeyDown, true);
      field.remove();
      fieldRef.current = null;
      register(id, null);
    };
  }, [Mathfield, id, register]);

  // Only external edits (source textarea, clear, undo) increment syncVersion so live mathfield edits never get overwritten.
  useEffect(() => {
    if (syncVersion === 0) return;
    const field = fieldRef.current;
    const nextValue = latestValueRef.current;
    if (field && field.value !== nextValue) field.setValue(nextValue, { silenceNotifications: true });
  }, [syncVersion]);

  return <Box ref={containerRef} sx={{ flex: 1, minWidth: 0, overflowX: "auto" }} />;
}

export default function LatexClient() {
  const { t } = useI18n();
  const theme = useMuiTheme();
  const text = t.tools.latex;
  useDocumentTitle(text.title);

  const [Mathfield, setMathfield] = useState<MathfieldClass | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>("display");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Bumped by the retry button after the editor chunk failed to load.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const fields = useRef(new Map<string, MathfieldElement>());

  useEffect(() => {
    let cancelled = false;
    import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled) return;
      // Fonts are served from /public so the editor works without reaching a CDN.
      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      window.mathVirtualKeyboard.layouts = KEYBOARD_LAYOUTS;
      const loaded = loadLines();
      setLines(loaded);
      setActiveId(loaded[0].id);
      setMathfield(() => MathfieldElement);
    }).catch(() => {
      if (!cancelled) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // The on-screen keyboard overlays the page, so reserve its height to keep the source and output panels reachable.
  useEffect(() => {
    if (!Mathfield) return;
    const keyboard = window.mathVirtualKeyboard;
    const sync = () => setKeyboardHeight(keyboard.visible ? Math.ceil(keyboard.boundingRect.height) : 0);
    sync();
    keyboard.addEventListener("geometrychange", sync);
    return () => {
      keyboard.removeEventListener("geometrychange", sync);
      keyboard.hide();
    };
  }, [Mathfield]);

  useEffect(() => {
    if (!Mathfield) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map((line) => line.latex)));
    } catch {
      // Private mode or a full quota: keep editing in memory only.
    }
  }, [Mathfield, lines]);

  const focusLine = useCallback((id: string, atEnd = true) => {
    const field = fields.current.get(id);
    if (!field) return;
    // Focus the host first so MathLive registers the active mathfield, then focus the keyboard sink synchronously
    // (avoiding MathLive's 60ms timer) so keys typed right after Enter land in the new line.
    field.focus();
    const sink = field.shadowRoot?.querySelector<HTMLElement>("[part=keyboard-sink]");
    sink?.focus({ preventScroll: true });
    field.position = atEnd ? field.lastOffset : 0;
  }, []);

  const registerField = useCallback((id: string, element: MathfieldElement | null) => {
    if (!element) {
      fields.current.delete(id);
      return;
    }
    fields.current.set(id, element);
  }, []);

  const updateLineFromField = useCallback((id: string, latex: string) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, latex } : line)));
  }, []);

  const updateLineExternally = useCallback((id: string, latex: string) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, latex, syncVersion: line.syncVersion + 1 } : line))
    );
  }, []);

  const insertLineAfter = useCallback((id: string | null) => {
    const line = makeLine();
    flushSync(() => {
      setLines((current) => {
        const index = id ? current.findIndex((item) => item.id === id) : current.length - 1;
        const next = [...current];
        next.splice(index + 1, 0, line);
        return next;
      });
      setActiveId(line.id);
    });
    focusLine(line.id);
  }, [focusLine]);

  const deleteLine = useCallback((id: string) => {
    const index = lines.findIndex((line) => line.id === id);
    if (index < 0) return;
    if (lines.length === 1) {
      if (lines[0].latex !== "") updateLineExternally(id, "");
      focusLine(id);
      return;
    }
    const target = lines[index - 1] ?? lines[index + 1];
    flushSync(() => {
      setLines(lines.filter((line) => line.id !== id));
      setActiveId(target.id);
    });
    focusLine(target.id);
  }, [focusLine, lines, updateLineExternally]);

  const moveOut = useCallback((id: string, direction: "forward" | "backward" | "upward" | "downward") => {
    const index = lines.findIndex((line) => line.id === id);
    const forward = direction === "forward" || direction === "downward";
    const target = lines[forward ? index + 1 : index - 1];
    if (target) {
      setActiveId(target.id);
      focusLine(target.id, !forward);
    }
  }, [focusLine, lines]);

  const activeLine = lines.find((line) => line.id === activeId) ?? lines[0];

  const insertIntoActive = (item: StructureItem) => {
    if (!activeLine) return;
    const field = fields.current.get(activeLine.id);
    if (!field) return;
    field.focus();
    if (item.command) {
      if (Array.isArray(item.command)) field.executeCommand(item.command);
      else field.executeCommand(item.command);
    } else {
      field.executeCommand(["insert", item.latex, { selectionMode: "placeholder", focus: true }]);
    }
    updateLineFromField(activeLine.id, field.value);
  };

  const toggleKeyboard = () => {
    const keyboard = window.mathVirtualKeyboard;
    if (keyboard.visible) {
      // MathLive's virtual-keyboard-toggle handler blurs and refocuses focused "auto" fields on hide,
      // which triggers its touch-device focusin listener to re-open the keyboard 300ms later.
      for (const field of fields.current.values()) field.mathVirtualKeyboardPolicy = "manual";
      try {
        keyboard.hide({ animate: true });
      } finally {
        for (const field of fields.current.values()) field.mathVirtualKeyboardPolicy = "auto";
      }
      return;
    }
    if (activeLine) focusLine(activeLine.id);
    keyboard.show({ animate: true });
  };

  const copy = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(text.copied);
    } catch {
      toast.error(text.copyFailed);
    }
  };

  const output = useMemo(() => buildOutput(lines, format), [lines, format]);

  const download = () => {
    const body = buildOutput(lines, "align") || "% empty";
    const documentSource = `\\documentclass{article}\n\\usepackage{amsmath,amssymb}\n\\begin{document}\n${body}\n\\end{document}\n`;
    const url = URL.createObjectURL(new Blob([documentSource], { type: "application/x-tex" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "formulas.tex";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    const previous = lines;
    const previousActive = activeId;
    const line = makeLine();
    flushSync(() => {
      setLines([line]);
      setActiveId(line.id);
    });
    focusLine(line.id);
    // Clearing is one tap away from losing the whole document, so offer an undo instead of asking first.
    const toastId = toast.show(
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
        {text.cleared}
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          sx={{ py: 0, minWidth: 0 }}
          onClick={() => {
            setLines(previous.map((item) => ({ ...item, syncVersion: item.syncVersion + 1 })));
            setActiveId(previousActive ?? previous[0]?.id ?? null);
            toast.dismiss(toastId);
          }}
        >
          {text.undo}
        </Button>
      </Box>,
      { severity: "info", duration: 8000 }
    );
  };

  const structureLabels = useMemo(() => STRUCTURES.map((item) => renderLabel(item.label)), []);
  const symbolLabels = useMemo(() => SYMBOLS.map(renderLabel), []);

  // Keep focus in the formula on desktop mouse clicks without interfering with touch scroll on mobile.
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  const paletteButtonSx = {
    flex: "0 0 auto",
    minWidth: 44,
    height: 44,
    px: 1,
    border: 1,
    borderColor: "divider",
    borderRadius: 1.5,
    color: "text.primary",
    bgcolor: "background.paper",
    textTransform: "none",
    "& .katex": { fontSize: "1.15em" },
    "&:hover": { borderColor: "primary.main", bgcolor: alpha(theme.palette.primary.main, 0.08) },
  } as const;

  const paletteRowSx = {
    display: "flex",
    gap: 0.75,
    flexWrap: { xs: "nowrap", md: "wrap" },
    overflowX: { xs: "auto", md: "visible" },
    pb: { xs: 0.5, md: 0 },
    scrollbarWidth: "thin",
  } as const;

  return (
    <div className="page-below-navbar flex flex-col" style={{ paddingBottom: keyboardHeight }}>
      <Box component="main" sx={{ flex: 1, display: "flex", justifyContent: "center", px: { xs: 1.5, sm: 3 }, py: { xs: 3, md: 6 } }}>
        <Box sx={{ width: "100%", maxWidth: 1200 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center", mb: 1, fontFamily: "var(--font-inter)", fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
            {text.title}
          </Typography>
          <Typography variant="body1" sx={{ textAlign: "center", color: "text.secondary", mb: { xs: 3, md: 4 } }}>
            {text.description}
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.5fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={paletteRowSx}>
                  {STRUCTURES.map((item, index) => (
                    <Button key={item.label} onMouseDown={keepFocus} onClick={() => insertIntoActive(item)} sx={paletteButtonSx}>
                      <span dangerouslySetInnerHTML={{ __html: structureLabels[index] }} />
                    </Button>
                  ))}
                </Box>
                <Box sx={paletteRowSx}>
                  {SYMBOLS.map((symbol, index) => (
                    <Button key={symbol} onMouseDown={keepFocus} onClick={() => insertIntoActive({ latex: symbol, label: symbol })} sx={{ ...paletteButtonSx, height: 38, minWidth: 38 }}>
                      <span dangerouslySetInnerHTML={{ __html: symbolLabels[index] }} />
                    </Button>
                  ))}
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{text.lines}</Typography>
                  <Tooltip title={text.keyboard}>
                    <IconButton size="small" onMouseDown={keepFocus} onClick={toggleKeyboard} aria-label={text.keyboard}>
                      <KeyboardRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={text.clear}>
                    <IconButton size="small" onClick={clearAll} aria-label={text.clear}>
                      <ClearAllRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {!Mathfield ? (
                  loadFailed ? (
                    <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                      <Typography color="error">{text.loadFailed}</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setLoadFailed(false);
                          setLoadAttempt((n) => n + 1);
                        }}
                      >
                        {text.retry}
                      </Button>
                    </Box>
                  ) : (
                    <Typography sx={{ p: 3, color: "text.secondary" }}>{text.loading}</Typography>
                  )
                ) : (
                  lines.map((line, index) => {
                    const active = line.id === activeLine?.id;
                    return (
                      <Box
                        key={line.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          pl: 1,
                          pr: 0.5,
                          minHeight: 56,
                          borderBottom: 1,
                          borderColor: "divider",
                          borderLeft: 3,
                          borderLeftColor: active ? "primary.main" : "transparent",
                          bgcolor: active ? alpha(theme.palette.primary.main, 0.05) : "transparent",
                          "& math-field": {
                            "--caret-color": theme.palette.primary.main,
                            "--selection-background-color": alpha(theme.palette.primary.main, 0.25),
                            "--placeholder-color": theme.palette.text.secondary,
                            "--contains-highlight-background-color": alpha(theme.palette.primary.main, 0.08),
                          },
                          "& math-field::part(menu-toggle)": { display: "none" },
                          "& math-field::part(virtual-keyboard-toggle)": { display: "none" },
                        }}
                      >
                        <Typography variant="caption" sx={{ width: 22, textAlign: "right", color: "text.secondary", fontFamily: "var(--font-jetbrains-mono, monospace)", flexShrink: 0 }}>
                          {index + 1}
                        </Typography>
                        <MathLine
                          Mathfield={Mathfield}
                          value={line.latex}
                          syncVersion={line.syncVersion}
                          id={line.id}
                          register={registerField}
                          onChange={(latex) => updateLineFromField(line.id, latex)}
                          onFocus={() => setActiveId(line.id)}
                          onEnter={() => insertLineAfter(line.id)}
                          onDeleteEmpty={() => deleteLine(line.id)}
                          onMoveOut={(direction) => moveOut(line.id, direction)}
                        />
                        <Tooltip title={text.copyLine}>
                          <IconButton size="small" onClick={() => copy(exportLatex(line.latex))} aria-label={text.copyLine}>
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={text.deleteLine}>
                          <IconButton size="small" onClick={() => deleteLine(line.id)} aria-label={text.deleteLine}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    );
                  })
                )}

                <Button startIcon={<AddRoundedIcon />} onClick={() => insertLineAfter(lines[lines.length - 1]?.id ?? null)} disabled={!Mathfield} sx={{ m: 1, textTransform: "none" }}>
                  {text.addLine}
                </Button>
              </Paper>

              <Typography variant="caption" sx={{ color: "text.secondary", px: 0.5 }}>{text.tips}</Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, position: { md: "sticky" }, top: { md: 88 } }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {text.source}{activeLine ? ` · ${lines.indexOf(activeLine) + 1}` : ""}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>{text.sourceHint}</Typography>
                <TextField
                  value={activeLine?.latex ?? ""}
                  onChange={(event) => activeLine && updateLineExternally(activeLine.id, event.target.value)}
                  disabled={!activeLine}
                  multiline
                  minRows={2}
                  maxRows={8}
                  fullWidth
                  spellCheck={false}
                  slotProps={{ htmlInput: { autoCapitalize: "off", autoCorrect: "off", style: { fontFamily: "var(--font-jetbrains-mono, monospace)", fontSize: 14 } } }}
                />
                <Button size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(exportLatex(activeLine?.latex ?? ""))} sx={{ mt: 1, textTransform: "none" }}>
                  {text.copyLine}
                </Button>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{text.output}</Typography>
                  <ToggleButtonGroup size="small" exclusive value={format} onChange={(_, value: OutputFormat | null) => value && setFormat(value)} sx={{ "& .MuiToggleButton-root": { textTransform: "none", px: 1.25, py: 0.25 } }}>
                    <ToggleButton value="display">{text.formatDisplay}</ToggleButton>
                    <ToggleButton value="align">{text.formatAlign}</ToggleButton>
                    <ToggleButton value="plain">{text.formatPlain}</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>{text.outputHint}</Typography>
                <TextField
                  value={output}
                  multiline
                  minRows={3}
                  maxRows={12}
                  fullWidth
                  slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: "var(--font-jetbrains-mono, monospace)", fontSize: 13 } } }}
                />
                <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                  <Button variant="contained" size="small" startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(output)} disabled={!output} sx={{ textTransform: "none" }}>
                    {text.copyAll}
                  </Button>
                  <Button size="small" startIcon={<DownloadRoundedIcon />} onClick={download} disabled={!output} sx={{ textTransform: "none" }}>
                    {text.download}
                  </Button>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Box>
      </Box>
      <Footer />
    </div>
  );
}
