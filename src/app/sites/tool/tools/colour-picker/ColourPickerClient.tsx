"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Slider,
  Snackbar,
  Stack,
  TextField,
  Typography,
  alpha as muiAlpha,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@shared/libs/i18n/tool";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";

type Rgba = { r: number; g: number; b: number; a: number };
type Hsv = { h: number; s: number; v: number };
type FormatKey = "HEX" | "HEXA" | "RGB" | "RGBA" | "HSL" | "HSLA" | "HSV" | "CMYK";
type FormatInputs = Record<FormatKey, string>;

const FORMAT_KEYS: FormatKey[] = ["HEX", "HEXA", "RGB", "RGBA", "HSL", "HSLA", "HSV", "CMYK"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, places = 0) => Number(value.toFixed(places));
const byteHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0").toUpperCase();

function hsvToRgb({ h, s, v }: Hsv): Omit<Rgba, "a"> {
  const c = v * s;
  const segment = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((segment % 2) - 1));
  const [r1, g1, b1] = segment < 1 ? [c, x, 0] : segment < 2 ? [x, c, 0] : segment < 3 ? [0, c, x] : segment < 4 ? [0, x, c] : segment < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function rgbToHsv({ r, g, b }: Rgba): Hsv {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  return { h: Math.round((h + 360) % 360), s: max ? delta / max : 0, v: max };
}

function rgbToHsl({ r, g, b }: Rgba) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: Math.round((h + 360) % 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToCmyk({ r, g, b }: Rgba) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function hslToRgb(h: number, s: number, l: number): Omit<Rgba, "a"> {
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const x = c * (1 - Math.abs((segment % 2) - 1));
  const [r1, g1, b1] = segment < 1 ? [c, x, 0] : segment < 2 ? [x, c, 0] : segment < 3 ? [0, c, x] : segment < 4 ? [0, x, c] : segment < 5 ? [x, 0, c] : [c, 0, x];
  const m = lightness - c / 2;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function parseHex(value: string): Rgba | null {
  const raw = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{3,4}$|^[\da-f]{6}([\da-f]{2})?$/i.test(raw)) return null;
  const expanded = raw.length <= 4 ? raw.split("").map((x) => x + x).join("") : raw;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

function formatValues(rgba: Rgba, hsv: Hsv): FormatInputs {
  const hex = `#${byteHex(rgba.r)}${byteHex(rgba.g)}${byteHex(rgba.b)}`;
  const hsl = rgbToHsl(rgba);
  const cmyk = rgbToCmyk(rgba);
  return {
    HEX: hex,
    HEXA: `${hex}${byteHex(rgba.a * 255)}`,
    RGB: `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`,
    RGBA: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round(rgba.a, 2)})`,
    HSL: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    HSLA: `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${round(rgba.a, 2)})`,
    HSV: `hsv(${hsv.h}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%)`,
    CMYK: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
  };
}

function parseFormat(format: FormatKey, value: string, currentAlpha: number): { rgba: Rgba; hsv?: Hsv } | null {
  if (format === "HEX" || format === "HEXA") {
    const parsed = parseHex(value);
    if (!parsed) return null;
    if (format === "HEX" && value.trim().replace(/^#/, "").length !== 3 && value.trim().replace(/^#/, "").length !== 6) return null;
    if (format === "HEXA" && value.trim().replace(/^#/, "").length !== 4 && value.trim().replace(/^#/, "").length !== 8) return null;
    return { rgba: format === "HEX" ? { ...parsed, a: currentAlpha } : parsed };
  }

  const match = value.trim().match(/^([a-z]+)\((.*)\)$/i);
  if (!match || match[1].toUpperCase() !== format) return null;
  const parts = match[2].split(",").map((part) => part.trim());
  const expected = ["RGB", "HSL", "HSV"].includes(format) ? 3 : 4;
  if (parts.length !== expected) return null;

  if (format === "RGB" || format === "RGBA") {
    const rgb = parts.slice(0, 3).map(Number);
    const a = format === "RGBA" ? Number(parts[3]) : currentAlpha;
    if (rgb.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255) || !Number.isFinite(a) || a < 0 || a > 1) return null;
    return { rgba: { r: Math.round(rgb[0]), g: Math.round(rgb[1]), b: Math.round(rgb[2]), a } };
  }

  if (format === "HSL" || format === "HSLA") {
    if (!parts[1].endsWith("%") || !parts[2].endsWith("%")) return null;
    const h = Number(parts[0]);
    const s = Number(parts[1].slice(0, -1));
    const l = Number(parts[2].slice(0, -1));
    const a = format === "HSLA" ? Number(parts[3]) : currentAlpha;
    if (![h, s, l, a].every(Number.isFinite) || h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100 || a < 0 || a > 1) return null;
    return { rgba: { ...hslToRgb(h === 360 ? 0 : h, s, l), a } };
  }

  if (format === "HSV") {
    if (!parts[1].endsWith("%") || !parts[2].endsWith("%")) return null;
    const next = { h: Number(parts[0]), s: Number(parts[1].slice(0, -1)) / 100, v: Number(parts[2].slice(0, -1)) / 100 };
    if (![next.h, next.s, next.v].every(Number.isFinite) || next.h < 0 || next.h > 360 || next.s < 0 || next.s > 1 || next.v < 0 || next.v > 1) return null;
    if (next.h === 360) next.h = 0;
    return { rgba: { ...hsvToRgb(next), a: currentAlpha }, hsv: next };
  }

  if (!parts.every((part) => part.endsWith("%"))) return null;
  const [c, m, y, k] = parts.map((part) => Number(part.slice(0, -1)));
  if (![c, m, y, k].every(Number.isFinite) || [c, m, y, k].some((channel) => channel < 0 || channel > 100)) return null;
  return {
    rgba: {
      r: Math.round(255 * (1 - c / 100) * (1 - k / 100)),
      g: Math.round(255 * (1 - m / 100) * (1 - k / 100)),
      b: Math.round(255 * (1 - y / 100) * (1 - k / 100)),
      a: currentAlpha,
    },
  };
}

const SWATCH_STORAGE_KEY = "colour-picker-swatches";

function Channel({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <TextField
        size="small"
        label={label}
        value={value}
        type="number"
        onChange={(event) => onChange(clamp(Number(event.target.value), 0, max))}
        slotProps={{ htmlInput: { min: 0, max, "aria-label": label } }}
        sx={{ width: "100%", "& input": { fontFamily: "var(--font-jetbrains-mono), monospace", textAlign: "center", px: 1 } }}
      />
    </Box>
  );
}

export default function ColourPickerClient() {
  const { t } = useI18n();
  useDocumentTitle(t.tools.colourPicker.title);
  const initialRgba: Rgba = { r: 99, g: 102, b: 241, a: 1 };
  const initialHsv = rgbToHsv(initialRgba);
  const [rgba, setRgba] = useState<Rgba>(initialRgba);
  const [hsv, setHsv] = useState<Hsv>(initialHsv);
  const [hexInput, setHexInput] = useState("#6366F1");
  const [formatInputs, setFormatInputs] = useState<FormatInputs>(() => formatValues(initialRgba, initialHsv));
  const [formatErrors, setFormatErrors] = useState<Partial<Record<FormatKey, boolean>>>({});
  const [swatches, setSwatches] = useState<string[]>([]);
  const [toast, setToast] = useState({ open: false, message: "" });
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(SWATCH_STORAGE_KEY) ?? "[]");
        if (Array.isArray(saved)) {
          setSwatches(saved.filter((color): color is string => typeof color === "string" && parseHex(color) !== null));
        }
      } catch {
        localStorage.removeItem(SWATCH_STORAGE_KEY);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const solidHex = `#${byteHex(rgba.r)}${byteHex(rgba.g)}${byteHex(rgba.b)}`;
  const hexa = `${solidHex}${byteHex(rgba.a * 255)}`;
  const cssRgba = `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round(rgba.a, 2)})`;

  const applyHsv = (next: Hsv, alphaValue = rgba.a) => {
    const rgb = hsvToRgb(next);
    const nextRgba = { ...rgb, a: alphaValue };
    setHsv(next);
    setRgba(nextRgba);
    setHexInput(`#${byteHex(rgb.r)}${byteHex(rgb.g)}${byteHex(rgb.b)}`);
    setFormatInputs(formatValues(nextRgba, next));
    setFormatErrors({});
  };

  const applyRgb = (next: Rgba) => {
    const safe = { r: Math.round(clamp(next.r, 0, 255)), g: Math.round(clamp(next.g, 0, 255)), b: Math.round(clamp(next.b, 0, 255)), a: clamp(next.a, 0, 1) };
    setRgba(safe);
    const nextHsv = rgbToHsv(safe);
    setHsv(nextHsv);
    setHexInput(`#${byteHex(safe.r)}${byteHex(safe.g)}${byteHex(safe.b)}`);
    setFormatInputs(formatValues(safe, nextHsv));
    setFormatErrors({});
  };

  const handleFormatChange = (format: FormatKey, value: string) => {
    setFormatInputs((current) => ({ ...current, [format]: value }));
    const parsed = parseFormat(format, value, rgba.a);
    if (!parsed) {
      setFormatErrors((current) => ({ ...current, [format]: true }));
      return;
    }

    const safe = parsed.rgba;
    const nextHsv = parsed.hsv ?? rgbToHsv(safe);
    setRgba(safe);
    setHsv(nextHsv);
    setHexInput(`#${byteHex(safe.r)}${byteHex(safe.g)}${byteHex(safe.b)}`);
    setFormatInputs({ ...formatValues(safe, nextHsv), [format]: value });
    setFormatErrors({});
  };

  const normalizeFormat = (format: FormatKey) => {
    if (!formatErrors[format]) setFormatInputs(formatValues(rgba, hsv));
  };

  const updateField = (event: PointerEvent<HTMLDivElement>) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    applyHsv({ ...hsv, s, v });
  };

  const handleFieldPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateField(event);
  };

  const commitHex = () => {
    const next = parseHex(hexInput);
    if (next) applyRgb(next);
    else setHexInput(solidHex);
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ open: true, message: t.tools.colourPicker.copied });
    } catch {
      setToast({ open: true, message: t.tools.colourPicker.copyFailed });
    }
  };

  const saveSwatches = (next: string[]) => {
    setSwatches(next);
    try {
      localStorage.setItem(SWATCH_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The picker still works when browser storage is unavailable.
    }
  };

  const addSwatch = () => {
    if (swatches.includes(hexa)) return;
    saveSwatches([hexa, ...swatches].slice(0, 24));
  };

  const removeSwatch = (color: string) => saveSwatches(swatches.filter((swatch) => swatch !== color));

  const checker = "linear-gradient(45deg, #d5d5d5 25%, transparent 25%), linear-gradient(-45deg, #d5d5d5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d5d5d5 75%), linear-gradient(-45deg, transparent 75%, #d5d5d5 75%)";

  return (
    <div className="page-below-navbar flex flex-col">
      <Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 3 }, py: { xs: 5, md: 8 } }}>
        <Box sx={{ width: "100%", maxWidth: 1040, mx: "auto" }}>
          <Stack direction="row" spacing={1.2} sx={{ mb: 1, justifyContent: "center", alignItems: "center" }}>
            <ColorLensIcon color="primary" sx={{ fontSize: 34 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>{t.tools.colourPicker.title}</Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mb: 5, textAlign: "center" }}>{t.tools.colourPicker.description}</Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.08fr) minmax(340px, .92fr)" }, gap: 3, alignItems: "start" }}>
            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>{t.tools.colourPicker.picker}</Typography>
                <Box
                  ref={fieldRef}
                  role="slider"
                  aria-label={t.tools.colourPicker.picker}
                  aria-valuetext={`${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%`}
                  tabIndex={0}
                  onPointerDown={handleFieldPointer}
                  onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateField(event); }}
                  sx={{
                    position: "relative", height: { xs: 260, sm: 330 }, borderRadius: 2.5, cursor: "crosshair", touchAction: "none", overflow: "hidden",
                    backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                    backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
                  }}
                >
                  <Box sx={{ position: "absolute", left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, width: 22, height: 22, border: "3px solid white", borderRadius: "50%", transform: "translate(-50%, -50%)", bgcolor: solidHex, boxShadow: "0 1px 5px #0008", pointerEvents: "none" }} />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>{t.tools.colourPicker.hue}</Typography>
                <Slider value={hsv.h} min={0} max={359} onChange={(_, value) => applyHsv({ ...hsv, h: value as number })} aria-label={t.tools.colourPicker.hue} sx={{ height: 10, py: 1.5, color: "transparent", "& .MuiSlider-rail": { opacity: 1, background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }, "& .MuiSlider-track": { display: "none" }, "& .MuiSlider-thumb": { bgcolor: `hsl(${hsv.h}, 100%, 50%)`, border: "3px solid white", boxShadow: "0 1px 5px #0008" } }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{t.tools.colourPicker.saturation}</Typography>
                <Slider value={hsv.s * 100} min={0} max={100} valueLabelDisplay="auto" onChange={(_, value) => applyHsv({ ...hsv, s: (value as number) / 100 })} aria-label={t.tools.colourPicker.saturation} sx={{ py: 1.5 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{t.tools.colourPicker.brightness}</Typography>
                <Slider value={hsv.v * 100} min={0} max={100} valueLabelDisplay="auto" onChange={(_, value) => applyHsv({ ...hsv, v: (value as number) / 100 })} aria-label={t.tools.colourPicker.brightness} sx={{ py: 1.5 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{t.tools.colourPicker.opacity}</Typography>
                <Box sx={{ height: 10, my: 1.5, px: 0.25, borderRadius: 2, backgroundImage: checker, backgroundSize: "10px 10px", backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0" }}>
                  <Slider value={rgba.a * 100} min={0} max={100} onChange={(_, value) => applyRgb({ ...rgba, a: (value as number) / 100 })} aria-label={t.tools.colourPicker.opacity} sx={{ display: "block", height: 10, p: 0, color: "transparent", "& .MuiSlider-rail": { opacity: 1, background: `linear-gradient(to right, transparent, ${solidHex})` }, "& .MuiSlider-track": { display: "none" }, "& .MuiSlider-thumb": { bgcolor: cssRgba, border: "3px solid white", boxShadow: "0 1px 5px #0008" } }} />
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1.5, fontWeight: 700 }}>{t.tools.colourPicker.channels}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1 }}>
                  <Channel label="R" value={rgba.r} max={255} onChange={(r) => applyRgb({ ...rgba, r })} />
                  <Channel label="G" value={rgba.g} max={255} onChange={(g) => applyRgb({ ...rgba, g })} />
                  <Channel label="B" value={rgba.b} max={255} onChange={(b) => applyRgb({ ...rgba, b })} />
                  <Channel label="A" value={Math.round(rgba.a * 100)} max={100} onChange={(a) => applyRgb({ ...rgba, a: a / 100 })} />
                  <TextField size="small" label="HEX" value={hexInput} onChange={(event) => setHexInput(event.target.value)} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") commitHex(); }} sx={{ gridColumn: { xs: "span 5", sm: "auto" }, "& input": { fontFamily: "var(--font-jetbrains-mono), monospace", textAlign: "center", px: 1 } }} />
                </Box>
              </CardContent>
            </Card>

            <Stack spacing={3}>
              <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
                <Box sx={{ height: 150, position: "relative", backgroundImage: checker, backgroundSize: "18px 18px", backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0" }}>
                  <Box sx={{ position: "absolute", inset: 0, bgcolor: cssRgba }} />
                  <Typography sx={{ position: "absolute", left: 22, bottom: 16, fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 700, px: 1.2, py: .5, borderRadius: 1.5, bgcolor: muiAlpha("#000", .55), color: "white" }}>{hexa}</Typography>
                </Box>
                <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>{t.tools.colourPicker.formats}</Typography>
                  <Stack spacing={1.25}>
                    {FORMAT_KEYS.map((format) => (
                      <Box key={format} sx={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr) 36px", alignItems: "start", gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ pt: 1.35, fontWeight: 700 }}>{format}</Typography>
                        <TextField
                          size="small"
                          fullWidth
                          value={formatInputs[format]}
                          error={Boolean(formatErrors[format])}
                          helperText={formatErrors[format] ? t.tools.colourPicker.invalidFormat(format) : ""}
                          onChange={(event) => handleFormatChange(format, event.target.value)}
                          onBlur={() => normalizeFormat(format)}
                          slotProps={{ htmlInput: { "aria-label": format, spellCheck: false } }}
                          sx={{
                            "& input": { fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: ".82rem" },
                            "& .MuiFormHelperText-root": { mx: .25 },
                          }}
                        />
                        <IconButton size="small" aria-label={`${t.tools.colourPicker.copy} ${format}`} onClick={() => copy(formatInputs[format])} disabled={Boolean(formatErrors[format])} sx={{ mt: .35 }}><ContentCopyIcon sx={{ fontSize: 17 }} /></IconButton>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={2} sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{t.tools.colourPicker.swatches}</Typography>
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addSwatch} disabled={swatches.includes(hexa)} sx={{ textTransform: "none", borderRadius: 2 }}>{t.tools.colourPicker.addSwatch}</Button>
                  </Stack>
                  {swatches.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>{t.tools.colourPicker.emptySwatches}</Typography>
                  ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1 }}>
                      {swatches.map((color) => {
                        const parsed = parseHex(color)!;
                        const swatchBackground = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.a})`;
                        return (
                          <Box key={color} sx={{ position: "relative", minWidth: 0 }}>
                            <Box component="button" title={color} aria-label={color} onClick={() => applyRgb(parsed)} sx={{ appearance: "none", width: "100%", height: 52, border: color === hexa ? "3px solid" : "2px solid", borderColor: color === hexa ? "text.primary" : "background.paper", bgcolor: swatchBackground, borderRadius: 2, cursor: "pointer", boxShadow: 1, transition: "transform .15s", "&:hover": { transform: "translateY(-2px)" } }} />
                            <IconButton size="small" aria-label={`${t.tools.colourPicker.removeSwatch} ${color}`} onClick={() => removeSwatch(color)} sx={{ position: "absolute", top: -7, right: -7, width: 24, height: 24, bgcolor: "background.paper", border: 1, borderColor: "divider", "&:hover": { bgcolor: "error.main", color: "error.contrastText" } }}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>
      </Box>
      <Footer />
      <Snackbar open={toast.open} autoHideDuration={1800} onClose={() => setToast((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>{toast.message}</Alert>
      </Snackbar>
    </div>
  );
}
