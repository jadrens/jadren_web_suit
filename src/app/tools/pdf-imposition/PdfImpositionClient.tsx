"use client";

import { useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Footer from "@components/ui/layout/Footer";
import { toast } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import {
  ImpositionError,
  defaultOptions,
  plan,
  type ImpositionErrorCode,
  type Layout,
  type Options,
  type Slot,
  type Volume,
} from "@lib/pdf-imposition/imposition";
import { downloadResult, imposeAll, inspectPdf } from "@lib/pdf-imposition/render";

type ErrorCode = ImpositionErrorCode | "generic" | "read";
type SplitMode = "every" | "custom" | "none";
type StatusKind = "idle" | "running" | "ok" | "error";

interface FileEntry {
  id: number;
  file: File;
  name: string;
  pages: number | null;
  error: ErrorCode | null;
}

type PreviewState =
  | { kind: "empty" }
  | { kind: "message"; text: string; error: boolean }
  | { kind: "plan"; entry: FileEntry; volumes: Volume[] };

function parseSplitPoints(text: string): number[] {
  return text
    .split(/[\s,，、;；]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export default function PdfImpositionClient() {
  const { t } = useI18n();
  const s = t.tools.pdfImposition;
  const theme = useTheme();
  useDocumentTitle(s.title);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout>(defaultOptions.layout);
  const [rtl, setRtl] = useState(defaultOptions.rtl);
  const [pageNumbers, setPageNumbers] = useState(defaultOptions.pageNumbers);
  const [sheetLabels, setSheetLabels] = useState(defaultOptions.sheetLabels);
  const [splitMode, setSplitMode] = useState<SplitMode>("every");
  const [splitEveryInput, setSplitEveryInput] = useState(String(defaultOptions.splitEvery));
  const [splitAtInput, setSplitAtInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ kind: StatusKind; text: string }>({ kind: "idle", text: "" });

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const options: Options = useMemo(
    () => ({
      layout,
      rtl,
      pageNumbers,
      sheetLabels,
      splitEvery: layout === "single_fold" || splitMode !== "every" ? 0 : Number.parseInt(splitEveryInput, 10) || 0,
      splitAt: layout === "single_fold" || splitMode !== "custom" ? [] : parseSplitPoints(splitAtInput),
    }),
    [layout, rtl, pageNumbers, sheetLabels, splitMode, splitEveryInput, splitAtInput],
  );

  function messageForError(code: ErrorCode): string {
    switch (code) {
      case "emptyPdf":
        return s.errEmptyPdf;
      case "invalidSplitEvery":
        return s.errInvalidSplitEvery;
      case "invalidSplitAt":
        return s.errInvalidSplitAt;
      case "splitOutOfRange":
        return s.errSplitOutOfRange;
      case "encrypted":
        return s.errEncrypted;
      case "invalidPdf":
        return s.errInvalidPdf;
      case "read":
        return s.errReadFailed;
      default:
        return s.errGeneric;
    }
  }

  async function addFiles(list: FileList | File[]) {
    const all = Array.from(list);
    const pdfs = all.filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (pdfs.length === 0) {
      toast.warning(s.invalidType);
      return;
    }
    if (pdfs.length !== all.length) toast.info(s.invalidType);

    const entries: FileEntry[] = pdfs.map((file) => ({
      id: nextId.current++,
      file,
      name: file.name,
      pages: null,
      error: null,
    }));
    setFiles((prev) => [...prev, ...entries]);
    setSelectedId((prev) => prev ?? entries[0].id);

    await Promise.all(
      entries.map(async (entry) => {
        try {
          const bytes = new Uint8Array(await entry.file.arrayBuffer());
          const pages = await inspectPdf(bytes);
          setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, pages } : f)));
        } catch (error) {
          const code: ErrorCode = error instanceof ImpositionError ? error.code : "read";
          setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, error: code } : f)));
        }
      }),
    );
  }

  function removeFile(id: number) {
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    if (selectedId === id) setSelectedId(next.length ? next[0].id : null);
  }

  async function run() {
    const valid = files.filter((f) => f.pages !== null);
    if (running || valid.length === 0) return;
    setRunning(true);
    setStatus({ kind: "running", text: s.running });
    try {
      const inputs = await Promise.all(
        valid.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.file.arrayBuffer()) })),
      );
      const result = await imposeAll(inputs, options);
      downloadResult(result);
      const text = s.done(result.name);
      setStatus({ kind: "ok", text });
      toast.success(text);
    } catch (error) {
      const text = messageForError(error instanceof ImpositionError ? error.code : "generic");
      setStatus({ kind: "error", text });
      toast.error(text);
    } finally {
      setRunning(false);
    }
  }

  const entry = files.find((f) => f.id === selectedId) ?? null;
  let preview: PreviewState;
  if (!entry) {
    preview = { kind: "empty" };
  } else if (entry.pages === null) {
    preview = {
      kind: "message",
      text: entry.error ? messageForError(entry.error) : s.reading,
      error: Boolean(entry.error),
    };
  } else {
    try {
      preview = { kind: "plan", entry, volumes: plan(entry.pages, options) };
    } catch (error) {
      preview = {
        kind: "message",
        text: messageForError(error instanceof ImpositionError ? error.code : "generic"),
        error: true,
      };
    }
  }

  const hasValidFiles = files.some((f) => f.pages !== null);
  const layoutOptions: { value: Layout; label: string; hint: string }[] = [
    { value: "booklet", label: s.booklet, hint: s.bookletHint },
    { value: "single_fold", label: s.singleFold, hint: s.singleFoldHint },
    { value: "two_up", label: s.twoUp, hint: s.twoUpHint },
  ];
  const splitDisabled = layout === "single_fold";
  const note = layout === "booklet" ? s.noteBooklet : layout === "single_fold" ? s.noteSingleFold : s.noteTwoUp;

  return (
    <div className="page-below-navbar flex flex-col">
      <Box
        component="main"
        sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", px: 3, py: 8 }}
      >
        <Box sx={{ width: "100%", maxWidth: 1080 }}>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 0.95fr) minmax(0, 1.05fr)" },
              alignItems: "start",
            }}
          >
            {/* Controls */}
            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={3}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AutoStoriesIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {s.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {s.description}
                  </Typography>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    hidden
                    onChange={(event) => {
                      if (event.target.files) void addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      void addFiles(event.dataTransfer.files);
                    }}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.5,
                      py: 3,
                      px: 2,
                      textAlign: "center",
                      cursor: "pointer",
                      borderRadius: 2,
                      border: "2px dashed",
                      borderColor: dragging ? "primary.main" : "divider",
                      bgcolor: dragging ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                      transition: "all .15s ease",
                      "&:hover": { borderColor: "primary.main" },
                    }}
                  >
                    <UploadFileIcon color="primary" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {dragging ? s.dropActive : s.dropTitle}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.dropHint}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      {s.filesTitle}
                    </Typography>
                    {files.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        {s.noFiles}
                      </Typography>
                    ) : (
                      <Stack spacing={0.75}>
                        {files.map((f) => {
                          const selected = f.id === selectedId;
                          return (
                            <Box
                              key={f.id}
                              onClick={() => setSelectedId(f.id)}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                px: 1,
                                py: 0.75,
                                borderRadius: 1.5,
                                cursor: "pointer",
                                border: 1,
                                borderColor: selected ? "primary.main" : "transparent",
                                bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                              }}
                            >
                              <PictureAsPdfIcon fontSize="small" color={f.error ? "error" : "action"} />
                              <Typography variant="body2" noWrap title={f.name} sx={{ flex: 1, minWidth: 0 }}>
                                {f.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                noWrap
                                sx={{ maxWidth: 160, color: f.error ? "error.main" : "text.secondary" }}
                                title={f.error ? messageForError(f.error) : undefined}
                              >
                                {f.error
                                  ? messageForError(f.error)
                                  : f.pages === null
                                    ? s.reading
                                    : s.pages(f.pages)}
                              </Typography>
                              <IconButton
                                size="small"
                                aria-label={s.remove}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeFile(f.id);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </Box>

                  <FormControl component="fieldset" variant="standard">
                    <FormLabel component="legend" sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                      {s.layoutTitle}
                    </FormLabel>
                    <RadioGroup value={layout} onChange={(event) => setLayout(event.target.value as Layout)}>
                      {layoutOptions.map((option) => (
                        <FormControlLabel
                          key={option.value}
                          value={option.value}
                          control={<Radio size="small" />}
                          sx={{ alignItems: "flex-start", mb: 0.5 }}
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {option.label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {option.hint}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>

                  <FormControl component="fieldset" variant="standard" disabled={splitDisabled}>
                    <FormLabel component="legend" sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                      {s.splitTitle}
                    </FormLabel>
                    <Stack spacing={0.25}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                        <Radio size="small" checked={splitMode === "every"} onChange={() => setSplitMode("every")} disabled={splitDisabled} />
                        <Typography variant="body2">{s.splitEvery}</Typography>
                        {splitMode === "every" ? (
                          <TextField
                            type="number"
                            size="small"
                            value={splitEveryInput}
                            onChange={(event) => setSplitEveryInput(event.target.value)}
                            slotProps={{ htmlInput: { min: 4, step: 4, "aria-label": s.splitEvery } }}
                            sx={{ width: 96 }}
                          />
                        ) : null}
                        <Typography variant="body2">{s.splitEveryUnit}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Radio size="small" checked={splitMode === "custom"} onChange={() => setSplitMode("custom")} disabled={splitDisabled} />
                        <Typography variant="body2">{s.splitCustom}</Typography>
                      </Box>
                      {splitMode === "custom" ? (
                        <TextField
                          size="small"
                          fullWidth
                          value={splitAtInput}
                          onChange={(event) => setSplitAtInput(event.target.value)}
                          placeholder={s.splitCustomPlaceholder}
                          slotProps={{ htmlInput: { "aria-label": s.splitCustom } }}
                          sx={{ pl: 4, mt: 0.5 }}
                        />
                      ) : null}
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Radio size="small" checked={splitMode === "none"} onChange={() => setSplitMode("none")} disabled={splitDisabled} />
                        <Typography variant="body2">{s.splitNone}</Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {splitDisabled ? s.splitDisabled : s.splitHint}
                    </Typography>
                  </FormControl>

                  <FormControl component="fieldset" variant="standard">
                    <FormLabel component="legend" sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: 0.5 }}>
                      {s.optionsTitle}
                    </FormLabel>
                    <Stack spacing={0.25}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked={rtl} onChange={(event) => setRtl(event.target.checked)} />}
                        label={<Typography variant="body2">{s.rtl}</Typography>}
                      />
                      <FormControlLabel
                        control={<Checkbox size="small" checked={pageNumbers} onChange={(event) => setPageNumbers(event.target.checked)} />}
                        label={<Typography variant="body2">{s.pageNumbers}</Typography>}
                      />
                      <FormControlLabel
                        control={<Checkbox size="small" checked={sheetLabels} onChange={(event) => setSheetLabels(event.target.checked)} />}
                        label={<Typography variant="body2">{s.sheetLabels}</Typography>}
                      />
                    </Stack>
                  </FormControl>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<DownloadIcon />}
                    disabled={!hasValidFiles || running}
                    onClick={() => void run()}
                    sx={{ py: 1.3, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                  >
                    {running ? s.running : s.run}
                  </Button>
                  {status.text ? (
                    <Typography
                      variant="body2"
                      role="status"
                      sx={{ color: status.kind === "error" ? "error.main" : status.kind === "ok" ? "success.main" : "text.secondary" }}
                    >
                      {status.text}
                    </Typography>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {s.previewTitle}
                </Typography>
                <Box sx={{ maxHeight: 760, overflowY: "auto", pr: 0.5 }}>
                  {preview.kind === "empty" ? (
                    <Typography variant="body2" color="text.secondary">
                      {s.previewEmpty}
                    </Typography>
                  ) : preview.kind === "message" ? (
                    <Typography variant="body2" color={preview.error ? "error.main" : "text.secondary"}>
                      {preview.text}
                    </Typography>
                  ) : (
                    <PlanPreview entry={preview.entry} volumes={preview.volumes} note={note} />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
      <Footer />
    </div>
  );
}

type Translations = ReturnType<typeof useI18n>["t"]["tools"]["pdfImposition"];

function PlanPreview({ entry, volumes, note }: { entry: FileEntry; volumes: Volume[]; note: string }) {
  const { t } = useI18n();
  const s = t.tools.pdfImposition;
  const sides = volumes.reduce((n, v) => n + v.sides.length, 0);
  const blanks = sides * 2 - (entry.pages ?? 0);
  const sheets = sides / 2;

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        {s.summary({ name: entry.name, pages: entry.pages ?? 0, blanks, volumes: volumes.length, sheets, note })}
      </Typography>
      {volumes.map((volume) => (
        <Box key={volume.index}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", alignItems: "baseline" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {volumes.length > 1 ? s.volume(volume.index) : s.all}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.volumeRange(volume.first, volume.last, volume.sides.length / 2)}
            </Typography>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
            }}
          >
            {Array.from({ length: Math.ceil(volume.sides.length / 2) }, (_, i) => (
              <SheetCard
                key={i}
                n={i + 1}
                front={volume.sides[i * 2]}
                back={volume.sides[i * 2 + 1] ?? [null, null]}
                translations={s}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function SheetCard({
  n,
  front,
  back,
  translations: s,
}: {
  n: number;
  front: [Slot, Slot];
  back: [Slot, Slot];
  translations: Translations;
}) {
  const theme = useTheme();
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
      <Typography
        variant="caption"
        sx={{ display: "block", px: 1.5, py: 0.75, fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.08) }}
      >
        {s.sheet(n)}
      </Typography>
      <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 1 }}>
        <SideRow tag={s.front} pair={front} translations={s} />
        <SideRow tag={s.back} pair={back} translations={s} />
      </Box>
    </Box>
  );
}

function SideRow({ tag, pair, translations: s }: { tag: string; pair: [Slot, Slot]; translations: Translations }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 24, flexShrink: 0 }}>
        {tag}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, flex: 1 }}>
        {pair.map((page, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              textAlign: "center",
              py: 0.75,
              borderRadius: 1,
              border: 1,
              borderColor: page === null ? "divider" : "primary.main",
              bgcolor: page === null ? "action.hover" : alpha(theme.palette.primary.main, 0.06),
              color: page === null ? "text.disabled" : "text.primary",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: "0.8rem",
              fontStyle: page === null ? "italic" : "normal",
            }}
          >
            {page === null ? s.blank : page}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
