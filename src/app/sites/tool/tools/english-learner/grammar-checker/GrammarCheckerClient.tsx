"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, InputLabel, LinearProgress, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import SpellcheckRoundedIcon from "@mui/icons-material/SpellcheckRounded";
import StopCircleRoundedIcon from "@mui/icons-material/StopCircleRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@shared/libs/i18n/tool";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { useSiteUrl } from "@shared/site-url";
import { getLlmModels, getLlmProfiles, LlmClient, LlmModelProfile, LlmProfile, ReasoningEffort } from "@shared/libs/llm";
import { parseGrammarMarkup, validateGrammarMarkup } from "@shared/libs/llm/grammar-markup";

type CheckMode = "strict" | "normal" | "lenient";
const PREFERENCES_KEY = "english-grammar-checker-preferences";
const HISTORY_KEY = "english-grammar-checker-history";
interface CheckHistory { id: string; createdAt: number; input: string; mode: CheckMode; modelId: string; marked: string; explanations: Record<number, string>; reconstruction: { sentence: string; reason: string } | null; ok: boolean; invalidReason?: string; elapsed: number; outputTokens: number }
interface PolishItem { id: string; text: string; running: boolean; error: string; elapsed: number; modelName: string }

export default function GrammarCheckerClient() {
  const { t } = useI18n(); const copy = t.tools.englishLearner.grammar; useDocumentTitle(copy.title);
  const settingsUrl = useSiteUrl("main", "/settings");
  const storageBridgeUrl = useSiteUrl("main", "/settings/llm-storage-bridge");
  const [models, setModels] = useState<LlmModelProfile[]>([]); const [modelId, setModelId] = useState("");
  const [providers, setProviders] = useState<LlmProfile[]>([]);
  const [input, setInput] = useState(""); const [mode, setMode] = useState<CheckMode>("normal");
  const [thinkingOpen, setThinkingOpen] = useState(false); const [thinking, setThinking] = useState(false); const [effort, setEffort] = useState<ReasoningEffort>("medium"); const [budget, setBudget] = useState(2048);
  const [running, setRunning] = useState(false); const [error, setError] = useState(""); const [marked, setMarked] = useState("");
  const [explanations, setExplanations] = useState<Record<number, string>>({}); const [reconstruction, setReconstruction] = useState<{ sentence: string; reason: string } | null>(null);
  const [isOk, setIsOk] = useState(false);
  const [invalidReason, setInvalidReason] = useState("");
  const [expected, setExpected] = useState(0); const [elapsed, setElapsed] = useState(0); const [outputTokens, setOutputTokens] = useState(0);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [history, setHistory] = useState<CheckHistory[]>([]); const [historyOpen, setHistoryOpen] = useState(false);
  const startedAt = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [polishes, setPolishes] = useState<PolishItem[]>([]);
  const polishControllers = useRef(new Map<string, AbortController>());

  useEffect(() => { const items = getLlmModels(); setModels(items); setProviders(getLlmProfiles()); setModelId((current) => current || items[0]?.id || ""); }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null") as { modelId?: string; mode?: CheckMode; thinking?: boolean; effort?: ReasoningEffort; budget?: number } | null;
      if (saved?.modelId) setModelId(saved.modelId);
      if (saved?.mode && ["strict", "normal", "lenient"].includes(saved.mode)) setMode(saved.mode);
      if (typeof saved?.thinking === "boolean") setThinking(saved.thinking);
      if (saved?.effort && ["none", "minimal", "low", "medium", "high", "xhigh"].includes(saved.effort)) setEffort(saved.effort);
      if (typeof saved?.budget === "number" && Number.isFinite(saved.budget) && saved.budget > 0) setBudget(saved.budget);
    } catch { /* Invalid old preferences are ignored. */ }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ modelId, mode, thinking, effort, budget }));
  }, [budget, effort, mode, modelId, preferencesReady, thinking]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); if (Array.isArray(saved)) setHistory(saved.slice(0, 32)); } catch { /* Ignore invalid history. */ } }, []);
  useEffect(() => {
    if (storageBridgeUrl === "#" || models.length > 0) return;
    const requestId = `${Date.now()}-${Math.random()}`;
    const frame = document.createElement("iframe");
    frame.src = storageBridgeUrl; frame.hidden = true; frame.setAttribute("aria-hidden", "true");
    const bridgeOrigin = new URL(storageBridgeUrl).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== bridgeOrigin || event.data?.type !== "jadren:llm-config-response" || event.data.requestId !== requestId) return;
      const nextModels = Array.isArray(event.data.models) ? event.data.models as LlmModelProfile[] : [];
      const nextProviders = Array.isArray(event.data.profiles) ? event.data.profiles as LlmProfile[] : [];
      setModels(nextModels); setProviders(nextProviders); setModelId((current) => current || nextModels[0]?.id || ""); cleanup();
    };
    const cleanup = () => { window.removeEventListener("message", receive); frame.remove(); };
    frame.onload = () => frame.contentWindow?.postMessage({ type: "jadren:llm-config-request", requestId }, bridgeOrigin);
    window.addEventListener("message", receive); document.body.appendChild(frame);
    const timeout = window.setTimeout(cleanup, 5000);
    return () => { window.clearTimeout(timeout); cleanup(); };
  }, [models.length, storageBridgeUrl]);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 100); return () => clearInterval(timer); }, [running]);
  const selected = models.find((item) => item.id === modelId);
  const explanationCount = Object.keys(explanations).length;
  const progressText = invalidReason ? copy.invalidProgress : isOk ? copy.okProgress : reconstruction ? copy.reconstructedProgress : marked ? (expected ? copy.explaining.replace("{done}", String(explanationCount)).replace("{total}", String(expected)) : copy.marked) : copy.waitingMark;
  const modeHelp = copy[`${mode}Help` as "strictHelp" | "normalHelp" | "lenientHelp"];

  const updatePolish = (id: string, patch: Partial<PolishItem>) => setPolishes((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const clearPolishes = () => {
    polishControllers.current.forEach((controller) => controller.abort());
    polishControllers.current.clear();
    setPolishes([]);
  };
  const polish = async () => {
    if (!selected || !input.trim()) return;
    const provider = providers.find((item) => item.id === selected.providerId);
    if (!provider) { setError(copy.noModel); return; }
    const id = `${Date.now()}-${Math.random()}`; const controller = new AbortController(); const started = Date.now();
    polishControllers.current.set(id, controller);
    setPolishes((items) => [...items, { id, text: "", running: true, error: "", elapsed: 0, modelName: selected.name || selected.modelId }]);
    const timer = window.setInterval(() => updatePolish(id, { elapsed: (Date.now() - started) / 1000 }), 100);
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId });
      for await (const event of client.stream({ messages: [{ role: "user", content: input }], systemPrompt: "Polish the supplied English text. Improve clarity, naturalness, flow, word choice, grammar, and punctuation while preserving its original meaning and tone. Output only the polished English text, with no explanation, preface, markdown fence, or quotation marks.", maxTokens: 4096, temperature: .5, reasoningEffort: thinking ? effort : "none", thinkingBudget: thinking ? budget : undefined, signal: controller.signal })) {
        if (event.type === "text_delta") setPolishes((items) => items.map((item) => item.id === id ? { ...item, text: item.text + event.text } : item));
      }
    } catch (cause) { updatePolish(id, { error: controller.signal.aborted ? copy.stopped : `${copy.polishFailed}: ${cause instanceof Error ? cause.message : String(cause)}` }); }
    finally { window.clearInterval(timer); polishControllers.current.delete(id); updatePolish(id, { running: false, elapsed: (Date.now() - started) / 1000 }); }
  };

  const run = async () => {
    if (!selected || !input.trim()) return;
    const provider = providers.find((item) => item.id === selected.providerId);
    if (!provider) { setError(copy.noModel); return; }
    clearPolishes();
    setRunning(true); setError(""); setMarked(""); setExplanations({}); setReconstruction(null); setIsOk(false); setInvalidReason(""); setExpected(0); setElapsed(0); setOutputTokens(0); startedAt.current = Date.now();
    const controller = new AbortController(); abortRef.current = controller;
    let runMarked = false; let runReconstructed = false; let runOk = false; let runInvalid = false; let invalidReasonValue = ""; let markedValue = ""; let reconstructedValue: { sentence: string; reason: string } | null = null; let total = 0; const described = new Set<number>(); const explanationValues: Record<number, string> = {}; let streamedCharacters = 0; let finalTokens = 0;
    const strictness = mode === "strict" ? "Flag every collocation error, grammar error, unnatural expression, spelling issue, and punctuation issue." : mode === "normal" ? "Flag collocation, grammar, spelling, and standard usage errors. Do not over-correct harmless stylistic preferences." : "Only flag clear grammar, collocation, and spelling errors. Tolerate informal contractions, slang, and abbreviations such as ain't, bro, and lib when contextually understandable.";
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 10 });
      const events = client.stream({
        messages: [{ role: "user", content: input }],
        systemPrompt: `You are an English grammar checker. ${strictness}\nFirst determine whether the input is an English passage suitable for grammar checking. Chinese text, unrelated requests or instructions, source code, random data, and content without meaningful English must use workflow D.\nYou MUST use exactly one of these mutually exclusive workflows:\nA) If there are local errors, call mark_error once with the entire corrected annotation. Format every correction exactly as [original](replacement){n}; references must begin at {1} and increment without gaps. Then call desp_error exactly once for every reference.\nB) If the input is English but too broken to correct locally, call recon_sen with a fully rewritten sentence and a concise reason.\nC) If the input has no errors under the selected strictness, call the parameterless ok tool.\nD) If the input is not suitable English text, call invalid_input with a concise Simplified Chinese reason.\nEvery desp_error explanation MUST be written in Simplified Chinese. The reasons passed to recon_sen and invalid_input MUST also be written in Simplified Chinese. Keep the source text, corrections, and reconstructed sentence in English.\nDo not merely describe corrections in normal text. Preserve unmodified text exactly where practical.`,
        maxTokens: 4096, temperature: .2, reasoningEffort: thinking ? effort : "none", thinkingBudget: thinking ? budget : undefined, signal: controller.signal,
        tools: [
          { name: "mark_error", description: "Mark every error using [original](correction){sequential reference}.", parameters: { type: "object", properties: { marked_text: { type: "string" } }, required: ["marked_text"], additionalProperties: false }, execute: (args) => { if (runMarked || runReconstructed || runOk || runInvalid) throw new Error("Output workflows are mutually exclusive"); const value = String(args.marked_text ?? ""); const found = validateGrammarMarkup(value); runMarked = true; markedValue = value; total = found.length; setMarked(value); setExpected(total); return { accepted: true, references: total }; } },
          { name: "desp_error", description: "用简体中文解释 mark_error 中的一处编号修正。", parameters: { type: "object", properties: { reference: { type: "integer", minimum: 1 }, explanation: { type: "string", description: "简体中文错误解释" } }, required: ["reference", "explanation"], additionalProperties: false }, execute: (args) => { const reference = Number(args.reference); if (!runMarked || !Number.isInteger(reference) || reference < 1 || reference > total || described.has(reference)) throw new Error("Invalid, missing, or duplicate desp_error reference"); described.add(reference); const explanation = String(args.explanation ?? ""); explanationValues[reference] = explanation; setExplanations((current) => ({ ...current, [reference]: explanation })); return { accepted: true }; } },
          { name: "recon_sen", description: "局部修改不可行时重写整个英文输入，并用简体中文说明原因。", parameters: { type: "object", properties: { sentence: { type: "string", description: "重写后的英文句子" }, reason: { type: "string", description: "简体中文重写原因" } }, required: ["sentence", "reason"], additionalProperties: false }, execute: (args) => { if (runMarked || runReconstructed || runOk || runInvalid) throw new Error("Output workflows are mutually exclusive"); runReconstructed = true; const value = { sentence: String(args.sentence ?? ""), reason: String(args.reason ?? "") }; reconstructedValue = value; setReconstruction(value); return { accepted: true }; } },
          { name: "ok", description: "句子在当前检查模式下没有任何需要标出的错误时调用。此工具没有参数。", parameters: { type: "object", properties: {}, additionalProperties: false }, execute: () => { if (runMarked || runReconstructed || runOk || runInvalid) throw new Error("Output workflows are mutually exclusive"); runOk = true; setIsOk(true); return { accepted: true }; } },
          { name: "invalid_input", description: "输入不是适合语法检查的英文内容时调用，并用简体中文给出原因。", parameters: { type: "object", properties: { reason: { type: "string", description: "简体中文拒绝原因" } }, required: ["reason"], additionalProperties: false }, execute: (args) => { if (runMarked || runReconstructed || runOk || runInvalid) throw new Error("Output workflows are mutually exclusive"); runInvalid = true; invalidReasonValue = String(args.reason ?? ""); setInvalidReason(invalidReasonValue); return { accepted: true }; } },
        ],
      });
      for await (const event of events) {
        if (event.type === "text_delta") streamedCharacters += event.text.length;
        if (event.type === "thinking_delta") streamedCharacters += event.thinking.length;
        if (event.type === "tool_call_delta") streamedCharacters += event.argumentsDelta.length;
        if (event.type === "done" && event.response.usage?.outputTokens !== undefined) finalTokens = event.response.usage.outputTokens;
        else finalTokens = Math.max(0, Math.ceil(streamedCharacters / 4));
        setOutputTokens(finalTokens);
      }
      if (!runMarked && !runReconstructed && !runOk && !runInvalid) throw new Error("The model did not call a required output tool");
      if (runMarked && described.size !== total) throw new Error(`Missing explanations: ${described.size}/${total}`);
      const duration = (Date.now() - startedAt.current) / 1000;
      const record: CheckHistory = { id: `${Date.now()}-${Math.random()}`, createdAt: Date.now(), input, mode, modelId: selected.id, marked: markedValue, explanations: explanationValues, reconstruction: reconstructedValue, ok: runOk, invalidReason: invalidReasonValue, elapsed: duration, outputTokens: finalTokens };
      setHistory((current) => { const next = [record, ...current].slice(0, 32); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); return next; });
    } catch (cause) { if (controller.signal.aborted) setError(copy.stopped); else setError(cause instanceof Error && /reference|\[original\]|mark_error|explanation/i.test(cause.message) ? `${copy.invalidMarkup} ${cause.message}` : `${copy.failed}: ${cause instanceof Error ? cause.message : String(cause)}`); }
    finally { abortRef.current = null; setElapsed((Date.now() - startedAt.current) / 1000); setRunning(false); }
  };

  const renderedMarkup = useMemo(() => marked ? parseGrammarMarkup(marked) : [], [marked]);
  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 } }}><Box sx={{ maxWidth: 1080, mx: "auto" }}>
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}><SpellcheckRoundedIcon color="primary" sx={{ fontSize: 34 }} /><Box><Typography variant="h4" fontWeight={700}>{copy.title}</Typography><Typography color="text.secondary">{copy.cardDescription}</Typography></Box></Stack>
    {models.length === 0 && <Alert severity="warning" action={<Button component={Link} href={settingsUrl} startIcon={<SettingsRoundedIcon />}>{copy.openSettings}</Button>} sx={{ mb: 2 }}>{copy.noModel}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: 2.5 }}><Stack spacing={2}>
        <TextField label={copy.input} placeholder={copy.placeholder} value={input} onChange={(e) => setInput(e.target.value)} multiline minRows={12} maxRows={24} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>{(["strict", "normal", "lenient"] as CheckMode[]).map((item) => <Button key={item} variant={mode === item ? "contained" : "outlined"} onClick={() => setMode(item)} fullWidth>{copy[item]}</Button>)}</Stack>
        <Typography variant="caption" color="text.secondary">{modeHelp}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          {running ? <Button fullWidth variant="contained" color="error" size="large" startIcon={<StopCircleRoundedIcon />} onClick={() => abortRef.current?.abort()}>{copy.stop}</Button> : <Button fullWidth variant="contained" size="large" disabled={!input.trim() || !selected} onClick={run}>{copy.check}</Button>}
          <Button fullWidth variant="outlined" size="large" startIcon={<AutoFixHighRoundedIcon />} disabled={!input.trim() || !selected} onClick={polish}>{copy.polish}</Button>
        </Stack>
      </Stack></CardContent></Card>
      <Card variant="outlined" sx={{ borderRadius: 3, minHeight: 420, maxHeight: { xs: "70vh", md: 620 }, overflow: "hidden" }}><CardContent sx={{ p: 2.5, height: "100%", overflowY: "scroll", scrollbarGutter: "stable" }}><Typography variant="h6" fontWeight={700}>{copy.result}</Typography><Divider sx={{ my: 2 }} />
        {invalidReason ? <Alert severity="warning"><strong>{copy.invalidInput}：</strong>{invalidReason}</Alert> : isOk ? <Stack spacing={2}><Alert severity="success">{copy.ok}</Alert><Typography component="div" sx={{ color: "success.main", fontWeight: 600, lineHeight: 2, whiteSpace: "pre-wrap" }}>{input}</Typography></Stack> : reconstruction ? <Stack spacing={2}><Typography component="div"><Box component="span" sx={{ color: "error.main", textDecoration: "line-through" }}>{input}</Box></Typography><Typography component="div" sx={{ color: "success.main", fontWeight: 600 }}>{reconstruction.sentence}</Typography><Alert severity="info"><strong>{copy.reason}:</strong> {reconstruction.reason}</Alert></Stack> : marked ? <><Typography component="div" sx={{ lineHeight: 2 }}>{renderedMarkup.map((part, index) => part.type === "text" ? <span key={index}>{part.value}</span> : <span key={index}><Box component="span" sx={{ color: "error.main", textDecoration: "line-through" }}>{part.original}</Box><Box component="span" sx={{ color: "success.main", ml: .5 }}>{part.replacement}</Box><Box component="sup" sx={{ color: "primary.main", ml: .25, fontWeight: 700 }}>{part.reference}</Box></span>)}</Typography>{expected > 0 && <><Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>{copy.explanations}</Typography><Stack spacing={1}>{Array.from({ length: expected }, (_, i) => i + 1).map((reference) => <Box key={reference} sx={{ display: "flex", gap: 1 }}><Chip label={reference} size="small" color={explanations[reference] ? "primary" : "default"} /><Typography variant="body2" color={explanations[reference] ? "text.primary" : "text.disabled"}>{explanations[reference] || "…"}</Typography></Box>)}</Stack></>}</> : polishes.length === 0 && <Typography color="text.secondary">{copy.noResult}</Typography>}
        {polishes.length > 0 && <Box sx={{ mt: 3 }}><Divider sx={{ mb: 2 }} /><Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>{copy.polishedVersions}</Typography><Stack spacing={1.5}>{polishes.map((item, index) => <Card key={item.id} variant="outlined" sx={{ borderRadius: 2 }}><CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}><Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}><Chip size="small" label={`#${index + 1}`} color="primary" /><Typography variant="caption" color="text.secondary">{item.modelName} · {item.elapsed.toFixed(1)}s</Typography><Box sx={{ flex: 1 }} />{item.running && <Button size="small" color="error" startIcon={<StopCircleRoundedIcon />} onClick={() => polishControllers.current.get(item.id)?.abort()}>{copy.stop}</Button>}</Stack>{item.error ? <Alert severity={item.error === copy.stopped ? "warning" : "error"}>{item.error}</Alert> : <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{item.text}{item.running && <Box component="span" sx={{ display: "inline-block", width: 7, height: 18, ml: .4, bgcolor: "primary.main", verticalAlign: "text-bottom", animation: "pulse 1s infinite" }} />}</Typography>}{item.running && <LinearProgress sx={{ mt: 1.25 }} />}</CardContent></Card>)}</Stack></Box>}
      </CardContent></Card>
    </Box>
    <Card variant="outlined" sx={{ mt: 2, borderRadius: 2.5 }}><CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
      <FormControl size="small" sx={{ minWidth: 220 }}><InputLabel>{copy.model}</InputLabel><Select label={copy.model} value={modelId} onChange={(e) => setModelId(e.target.value)}>{models.map((model) => <MenuItem key={model.id} value={model.id}>{model.name || model.modelId}</MenuItem>)}</Select></FormControl>
      <Button size="small" variant="outlined" startIcon={<PsychologyRoundedIcon />} onClick={() => setThinkingOpen(true)}>{copy.thinking}: {thinking ? effort : "Off"}</Button>
      <Button size="small" variant="outlined" startIcon={<HistoryRoundedIcon />} onClick={() => setHistoryOpen(true)}>{copy.history} ({history.length})</Button>
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" color="text.secondary">{copy.tokens}: ~{outputTokens}</Typography><Typography variant="caption" color="text.secondary">{copy.elapsed}: {elapsed.toFixed(1)}s</Typography><Chip size="small" label={progressText} color={running ? "primary" : "default"} />
    </Stack>{running && <LinearProgress sx={{ mt: 1.25 }} />}</CardContent></Card>
  </Box></Box><Footer />
  <Dialog open={thinkingOpen} onClose={() => setThinkingOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{copy.thinkingSettings}</DialogTitle><DialogContent><Stack spacing={2.5} sx={{ pt: 1 }}><FormControlLabel control={<Switch checked={thinking} onChange={(e) => setThinking(e.target.checked)} />} label={copy.enableThinking} /><FormControl fullWidth disabled={!thinking}><InputLabel>{copy.reasoningEffort}</InputLabel><Select label={copy.reasoningEffort} value={effort} onChange={(e) => setEffort(e.target.value as ReasoningEffort)}>{["low", "medium", "high", "xhigh"].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl><TextField disabled={!thinking} type="number" label={copy.thinkingBudget} value={budget} onChange={(e) => setBudget(Math.max(1, Number(e.target.value)))} /></Stack></DialogContent><DialogActions><Button onClick={() => setThinkingOpen(false)}>{copy.close}</Button></DialogActions></Dialog>
  <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{copy.history}</DialogTitle><DialogContent dividers>
    {history.length === 0 ? <Typography color="text.secondary">{copy.noHistory}</Typography> : <Stack spacing={1.25}>{history.map((record) => <Card key={record.id} variant="outlined" sx={{ borderRadius: 2 }}><Button fullWidth color="inherit" onClick={() => { clearPolishes(); setInput(record.input); setMode(record.mode); setModelId(record.modelId); setMarked(record.marked); setExplanations(record.explanations); setReconstruction(record.reconstruction); setIsOk(Boolean(record.ok)); setInvalidReason(record.invalidReason || ""); setExpected(record.marked ? validateGrammarMarkup(record.marked).length : 0); setElapsed(record.elapsed); setOutputTokens(record.outputTokens); setError(""); setHistoryOpen(false); }} sx={{ p: 1.5, display: "block", textAlign: "left", textTransform: "none" }}><Typography variant="body2" fontWeight={700} noWrap>{record.input}</Typography><Typography variant="caption" color="text.secondary">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(record.createdAt)} · {copy.tokens}: {record.outputTokens} · {record.elapsed.toFixed(1)}s</Typography></Button></Card>)}</Stack>}
  </DialogContent><DialogActions><Button onClick={() => setHistoryOpen(false)}>{copy.close}</Button></DialogActions></Dialog>
  </div>;
}
