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
import type { MathfieldElement } from "mathlive";
import Footer from "@components/ui/layout/Footer";
import { toast } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { KEYBOARD_LAYOUTS } from "./keyboard";

type MathfieldClass = typeof MathfieldElement;
type OutputFormat = "display" | "align" | "plain";

interface Line {
  id: string;
  latex: string;
}

const STORAGE_KEY = "tools.latex.lines";
const DEFAULT_LINES = ["f(x)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", ""];

// Inserted templates use MathLive placeholders: #@ wraps the current selection, #? is an empty slot, #0 takes the selection or a slot.
const STRUCTURES: { latex: string; label: string }[] = [
  { latex: "\\frac{#@}{#?}", label: "\\frac{\\square}{\\square}" },
  { latex: "#@^{#?}", label: "\\square^{\\square}" },
  { latex: "#@_{#?}", label: "\\square_{\\square}" },
  { latex: "\\sqrt{#0}", label: "\\sqrt{\\square}" },
  { latex: "\\sqrt[#?]{#0}", label: "\\sqrt[\\square]{\\square}" },
  { latex: "\\left(#0\\right)", label: "(\\square)" },
  { latex: "\\left|#0\\right|", label: "|\\square|" },
  { latex: "\\sum_{#?}^{#?}", label: "\\sum_{\\square}^{\\square}" },
  { latex: "\\prod_{#?}^{#?}", label: "\\prod_{\\square}^{\\square}" },
  { latex: "\\int_{#?}^{#?}#0\\,\\mathrm{d}#?", label: "\\int_{\\square}^{\\square}" },
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

function renderLabel(latex: string) {
  return katex.renderToString(latex, { throwOnError: false, output: "html" });
}

function loadLines(): Line[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length > 0 && stored.every((value) => typeof value === "string")) {
      return stored.map((latex: string) => ({ id: newId(), latex }));
    }
  } catch {
    // Corrupt storage falls back to the sample document.
  }
  return DEFAULT_LINES.map((latex) => ({ id: newId(), latex }));
}

// Unfilled MathLive slots are not valid LaTeX, so exported text keeps only what was typed into them.
function exportLatex(latex: string) {
  return latex.replace(/\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g, "{$1}").trim();
}

function buildOutput(lines: Line[], format: OutputFormat) {
  const values = lines.map((line) => exportLatex(line.latex)).filter(Boolean);
  if (values.length === 0) return "";
  if (format === "plain") return values.join("\n");
  if (format === "display") return values.map((value) => `$$\n${value}\n$$`).join("\n\n");
  return `\\begin{align*}\n${values.map((value) => `  ${value}`).join(" \\\\\n")}\n\\end{align*}`;
}

interface MathLineProps {
  Mathfield: MathfieldClass;
  id: string;
  value: string;
  register: (id: string, element: MathfieldElement | null) => void;
  onChange: (latex: string) => void;
  onFocus: () => void;
  onEnter: () => void;
  onDeleteEmpty: () => void;
  onMoveOut: (direction: "forward" | "backward" | "upward" | "downward") => void;
}

function MathLine({ Mathfield, id, value, register, ...handlers }: MathLineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const handlersRef = useRef(handlers);
  const initialValue = useRef(value);

  useEffect(() => {
    handlersRef.current = handlers;
  });

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
      handlersRef.current.onMoveOut(event.detail.direction);
    };
    // Capture phase runs before MathLive's own key handling inside the shadow root.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        handlersRef.current.onEnter();
      } else if (event.key === "Backspace" && field.value === "") {
        event.preventDefault();
        event.stopPropagation();
        handlersRef.current.onDeleteEmpty();
      }
    };

    // The touch keyboard's return key commits instead of sending Enter; a blur also fires "change", but by then the field has lost focus.
    const onCommit = () => {
      if (field.hasFocus()) handlersRef.current.onEnter();
    };

    field.addEventListener("input", onInput);
    field.addEventListener("change", onCommit);
    field.addEventListener("focus", onFocus);
    field.addEventListener("move-out", onMoveOut);
    field.addEventListener("keydown", onKeyDown, true);
    container.appendChild(field);
    fieldRef.current = field;
    register(id, field);

    return () => {
      field.removeEventListener("input", onInput);
      field.removeEventListener("change", onCommit);
      field.removeEventListener("focus", onFocus);
      field.removeEventListener("move-out", onMoveOut);
      field.removeEventListener("keydown", onKeyDown, true);
      field.remove();
      fieldRef.current = null;
      register(id, null);
    };
  }, [Mathfield, id, register]);

  // Edits from the source panel flow back into the field without re-emitting input events.
  useEffect(() => {
    const field = fieldRef.current;
    if (field && field.value !== value) field.setValue(value, { silenceNotifications: true });
  }, [value]);

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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The on-screen keyboard overlays the page, so reserve its height to keep the source and output panels reachable.
  useEffect(() => {
    if (!Mathfield) return;
    const keyboard = window.mathVirtualKeyboard;
    const sync = () => setKeyboardHeight(keyboard.visible ? Math.ceil(keyboard.boundingRect.height) : 0);
    keyboard.addEventListener("geometrychange", sync);
    return () => keyboard.removeEventListener("geometrychange", sync);
  }, [Mathfield]);

  useEffect(() => {
    if (!Mathfield) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.map((line) => line.latex)));
  }, [Mathfield, lines]);

  const focusLine = useCallback((id: string, atEnd = true) => {
    const field = fields.current.get(id);
    if (!field) return;
    // MathLive moves DOM focus 60ms after a programmatic focus(); focusing its keyboard sink directly
    // makes keys typed right after Enter land in the new line instead of the previous one.
    const sink = field.shadowRoot?.querySelector<HTMLElement>("[part=keyboard-sink]");
    if (sink) sink.focus();
    else field.focus();
    field.position = atEnd ? field.lastOffset : 0;
  }, []);

  const registerField = useCallback((id: string, element: MathfieldElement | null) => {
    if (!element) {
      fields.current.delete(id);
      return;
    }
    fields.current.set(id, element);
  }, []);

  const updateLine = useCallback((id: string, latex: string) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, latex } : line)));
  }, []);

  const insertLineAfter = useCallback((id: string | null) => {
    const line = { id: newId(), latex: "" };
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
      updateLine(id, "");
      focusLine(id);
      return;
    }
    const target = lines[index - 1] ?? lines[index + 1];
    flushSync(() => {
      setLines(lines.filter((line) => line.id !== id));
      setActiveId(target.id);
    });
    focusLine(target.id);
  }, [focusLine, lines, updateLine]);

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

  const insertIntoActive = (latex: string) => {
    if (!activeLine) return;
    const field = fields.current.get(activeLine.id);
    if (!field) return;
    field.focus();
    field.executeCommand(["insert", latex, { selectionMode: "placeholder", focus: true }]);
    updateLine(activeLine.id, field.value);
  };

  const toggleKeyboard = () => {
    if (activeLine) focusLine(activeLine.id);
    const keyboard = window.mathVirtualKeyboard;
    if (keyboard.visible) keyboard.hide();
    else keyboard.show({ animate: true });
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
    const line = { id: newId(), latex: "" };
    flushSync(() => {
      setLines([line]);
      setActiveId(line.id);
    });
    focusLine(line.id);
    toast.info(text.cleared);
  };

  const structureLabels = useMemo(() => STRUCTURES.map((item) => renderLabel(item.label)), []);
  const symbolLabels = useMemo(() => SYMBOLS.map(renderLabel), []);

  // Keep focus in the formula while tapping palette buttons, so the caret and the touch keyboard stay put.
  const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault();

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
                    <Button key={item.latex} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => insertIntoActive(item.latex)} sx={paletteButtonSx}>
                      <span dangerouslySetInnerHTML={{ __html: structureLabels[index] }} />
                    </Button>
                  ))}
                </Box>
                <Box sx={paletteRowSx}>
                  {SYMBOLS.map((symbol, index) => (
                    <Button key={symbol} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => insertIntoActive(symbol)} sx={{ ...paletteButtonSx, height: 38, minWidth: 38 }}>
                      <span dangerouslySetInnerHTML={{ __html: symbolLabels[index] }} />
                    </Button>
                  ))}
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{text.lines}</Typography>
                  <Tooltip title={text.keyboard}>
                    <IconButton size="small" onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={toggleKeyboard} aria-label={text.keyboard}>
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
                  <Typography sx={{ p: 3, color: "text.secondary" }}>{text.loading}</Typography>
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
                          id={line.id}
                          register={registerField}
                          onChange={(latex) => updateLine(line.id, latex)}
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
                  onChange={(event) => activeLine && updateLine(activeLine.id, event.target.value)}
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
