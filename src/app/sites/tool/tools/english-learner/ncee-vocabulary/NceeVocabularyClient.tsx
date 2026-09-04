"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, FormControlLabel, IconButton, LinearProgress, Stack, Switch, Tab, Tabs, TextField, Typography } from "@mui/material";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import QuizRoundedIcon from "@mui/icons-material/QuizRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import Footer from "@tool/components/layout/Footer";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { useI18n } from "@shared/libs/i18n/tool";
import { useSiteUrl } from "@shared/site-url";
import { getLlmModels, getLlmProfiles, LlmClient, type LlmModelProfile, type LlmProfile } from "@shared/libs/llm";

type Mode = "phonetic" | "meaning" | "word";
interface Exercise { id: number; english: string; phonetic: string; chinese: string; hint: string; duplicateCount: number }
interface Grade { isCorrect: boolean; feedback: string }
interface LocalProgress { order: number[]; index: number }

const PROGRESS_PREFIX = "vocabulary-practice-progress-v2:";
const INITIAL_BUCKET_SIZE = 15;
const REFILL_THRESHOLD = 6;
const REFILL_TARGET = 20;
const datasets = [{ id: "ncee", name: "NCEE · 全国高考词汇（3,796）" }] as const;

const labels = {
  en: { title: "Vocabulary Practice", subtitle: "Practice vocabulary from selectable learning databases.", dataset: "Vocabulary database", phonetic: "Sound → word", meaning: "Meaning → word", word: "Word → meaning", autoSpeak: "Read each new word automatically", listen: "Listen again", answerWord: "Type the English word", answerRest: "Type the remaining letters", answerMeaning: "Write the Chinese meaning", check: "Check", checking: "Checking…", next: "Next question", reveal: "Show answer", reset: "Reset and reshuffle this mode", progress: "Progress", correct: "Correct", wrong: "Incorrect", answer: "Answer", ambiguous: "This definition matches multiple entries", loadFailed: "Unable to load questions.", gradeFailed: "The AI did not complete the meaning check.", llmNeeded: "Configure an LLM provider and model in Settings to grade meanings.", settings: "Open Settings", model: "Model", source: "NCEE data: gaokao-vocab · MIT License · © 2025 Jimmy Xu" },
  zh: { title: "词汇练习", subtitle: "从可切换的学习词库中练习英语词汇。", dataset: "词汇数据库", phonetic: "根据音标写单词", meaning: "根据意思写单词", word: "根据单词写意思", autoSpeak: "新题自动朗读", listen: "再次朗读", answerWord: "输入英文单词", answerRest: "填写剩余字母", answerMeaning: "写出中文意思", check: "检查答案", checking: "正在批改…", next: "下一题", reveal: "查看答案", reset: "重置并重新随机当前模式", progress: "当前进度", correct: "正确", wrong: "回答错误", answer: "参考答案", ambiguous: "该释义对应多个词条", loadFailed: "无法批量载入题目。", gradeFailed: "AI 未完成本次词义批改。", llmNeeded: "请先在设置中配置 LLM Provider 和 Model，才能批改中文释义。", settings: "打开设置", model: "模型", source: "NCEE 数据：gaokao-vocab · MIT License · © 2025 Jimmy Xu" },
};

function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " "); }
function lettersOnly(value: string) { return value.toLocaleLowerCase().replace(/[^a-z]/g, ""); }
function shuffle(ids: number[]) { const result = [...ids]; for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; } return result; }

export default function NceeVocabularyClient() {
  const { locale } = useI18n(); const copy = labels[locale]; const settingsUrl = useSiteUrl("main", "/settings"); useDocumentTitle(copy.title);
  const [dataset, setDataset] = useState("ncee"); const [mode, setMode] = useState<Mode>("phonetic"); const [exercise, setExercise] = useState<Exercise | null>(null); const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [autoSpeak, setAutoSpeak] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [position, setPosition] = useState(0); const [total, setTotal] = useState(0);
  const bucketRef = useRef<Exercise[]>([]); const progressRef = useRef<LocalProgress | null>(null); const loadingRef = useRef(false); const loadSequenceRef = useRef(0);
  const [models, setModels] = useState<LlmModelProfile[]>([]); const [providers, setProviders] = useState<LlmProfile[]>([]); const [modelId, setModelId] = useState("");
  const selected = models.find((item) => item.id === modelId); const provider = providers.find((item) => item.id === selected?.providerId);

  useEffect(() => { const timer = window.setTimeout(() => { const available = getLlmModels().filter((item) => item.id && item.providerId && item.modelId.trim()); setModels(available); setProviders(getLlmProfiles()); setModelId(available[0]?.id || ""); }, 0); return () => window.clearTimeout(timer); }, []);
  const speak = useCallback((word: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word); utterance.lang = "en-US"; utterance.rate = .85; window.speechSynthesis.speak(utterance); }, []);
  const fetchWords = useCallback(async (targetDataset: string, targetMode: Mode, ids: number[]) => { if (!ids.length) return []; const response = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&ids=${ids.join(",")}`, { cache: "no-store" }); if (!response.ok) throw new Error(); return (await response.json()).words as Exercise[]; }, []);
  const loadMode = useCallback(async (targetDataset: string, targetMode: Mode, reset = false) => { const sequence = ++loadSequenceRef.current; loadingRef.current = true; setLoading(true); setError(""); setGrade(null); setRevealed(false); setAnswer(""); try {
    const key = `${PROGRESS_PREFIX}${targetDataset}:${targetMode}`; let progress: LocalProgress | null = null;
    if (!reset) { try { const stored = JSON.parse(localStorage.getItem(key) || "null"); if (Array.isArray(stored?.order) && stored.order.length && Number.isInteger(stored.index)) progress = stored; } catch { progress = null; } }
    if (!progress || progress.index < 0 || progress.index >= progress.order.length) { const catalogResponse = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&catalog=1`, { cache: "no-store" }); if (!catalogResponse.ok) throw new Error(); const catalog = await catalogResponse.json(); progress = { order: shuffle(catalog.ids), index: 0 }; }
    localStorage.setItem(key, JSON.stringify(progress));
    const words = await fetchWords(targetDataset, targetMode, progress.order.slice(progress.index, progress.index + INITIAL_BUCKET_SIZE)); if (sequence !== loadSequenceRef.current) return; progressRef.current = progress; bucketRef.current = words; setExercise(words[0] || null); setPosition(progress.index + 1); setTotal(progress.order.length);
  } catch { if (sequence === loadSequenceRef.current) { bucketRef.current = []; progressRef.current = null; setExercise(null); setError(copy.loadFailed); } } finally { if (sequence === loadSequenceRef.current) { loadingRef.current = false; setLoading(false); } } }, [copy.loadFailed, fetchWords]);
  const nextQuestion = useCallback(async () => { const progress = progressRef.current; if (!progress || loadingRef.current) return; setGrade(null); setRevealed(false); setAnswer(""); progress.index++;
    if (progress.index >= progress.order.length) { await loadMode(dataset, mode, true); return; }
    localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress)); const remaining = bucketRef.current.slice(1); bucketRef.current = remaining; setExercise(remaining[0] || null); setPosition(progress.index + 1);
    if (remaining.length < REFILL_THRESHOLD) { loadingRef.current = true; const sequence = loadSequenceRef.current; try { const start = progress.index + remaining.length; const ids = progress.order.slice(start, progress.index + REFILL_TARGET); const added = await fetchWords(dataset, mode, ids); if (sequence === loadSequenceRef.current) { bucketRef.current = [...remaining, ...added]; if (!remaining.length) setExercise(added[0] || null); } } catch { if (sequence === loadSequenceRef.current) setError(copy.loadFailed); } finally { if (sequence === loadSequenceRef.current) loadingRef.current = false; } }
  }, [copy.loadFailed, dataset, fetchWords, loadMode, mode]);
  useEffect(() => { const timer = window.setTimeout(() => void loadMode(dataset, mode), 0); return () => window.clearTimeout(timer); }, [dataset, loadMode, mode]);
  useEffect(() => { if (mode === "phonetic" && exercise && autoSpeak) speak(exercise.english); }, [autoSpeak, exercise, mode, speak]);

  async function checkAnswer() {
    if (!exercise || !answer.trim()) return;
    if (mode !== "word") { const isCorrect = mode === "meaning" ? `${lettersOnly(exercise.hint)}${lettersOnly(answer)}` === lettersOnly(exercise.english) : normalize(answer) === normalize(exercise.english); if (isCorrect) await nextQuestion(); else { setRevealed(false); setGrade({ isCorrect: false, feedback: copy.wrong }); } return; }
    if (!selected || !provider) { setError(copy.llmNeeded); return; }
    setLoading(true); setError(""); let result: Grade | null = null;
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 3 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: JSON.stringify({ englishWord: exercise.english, dictionaryMeaning: exercise.chinese, learnerMeaning: answer.trim() }) }],
        systemPrompt: "你负责批改高考英语词义练习。判断学习者写出的中文释义是否表达了词典释义中至少一个实质、正确的常见义项；不要求措辞完全一致，不因缺少其他义项判错。若释义错误或过于模糊，简短指出问题。必须且只能调用一次 grade_meaning，feedback 使用简体中文。",
        maxTokens: 512, temperature: .1, isComplete: () => result !== null, incompletePrompt: "请立即调用 grade_meaning 完成批改。", maxIncompleteRetries: 2,
        tools: [{ name: "grade_meaning", description: "提交词义批改结果。", parameters: { type: "object", properties: { is_correct: { type: "boolean" }, feedback: { type: "string" } }, required: ["is_correct", "feedback"], additionalProperties: false }, execute: (args) => { result = { isCorrect: Boolean(args.is_correct), feedback: String(args.feedback || "") }; return { accepted: true }; } }],
      })) { if (event.type === "done") break; }
      if (!result) throw new Error("Incomplete grading workflow");
      const completed = result as Grade;
      if (completed.isCorrect) await nextQuestion(); else { setRevealed(false); setGrade(completed); }
    } catch { setError(copy.gradeFailed); } finally { setLoading(false); }
  }

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, py: 5 }}><Box sx={{ maxWidth: 780, mx: "auto" }}>
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3 }}><QuizRoundedIcon color="primary" sx={{ fontSize: 40 }} /><Box><Typography variant="h4" sx={{ fontWeight: 750 }}>{copy.title}</Typography><Typography color="text.secondary">{copy.subtitle}</Typography></Box></Stack>
    <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={2.25}><Autocomplete size="small" options={[...datasets]} value={datasets.find((item) => item.id === dataset)} disableClearable getOptionLabel={(item) => item.name} onChange={(_event, value) => setDataset(value.id)} renderInput={(params) => <TextField {...params} label={copy.dataset} />} /></Stack></CardContent><Tabs value={mode} onChange={(_event, value: Mode) => setMode(value)} variant="fullWidth"><Tab value="phonetic" label={copy.phonetic} /><Tab value="meaning" label={copy.meaning} /><Tab value="word" label={copy.word} /></Tabs><CardContent><Stack spacing={2.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">{copy.progress}：{position} / {total || "…"}</Typography><LinearProgress variant={total ? "determinate" : "indeterminate"} value={total ? position / total * 100 : undefined} sx={{ mt: .5 }} /></Box><Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => void loadMode(dataset, mode, true)}>{copy.reset}</Button></Stack>
      {mode === "phonetic" && <FormControlLabel control={<Switch checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />} label={copy.autoSpeak} />}
      {mode === "word" && models.length > 0 && <Autocomplete size="small" options={models} value={selected} disableClearable getOptionLabel={(item) => item.name || item.modelId} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_e, value) => setModelId(value.id)} renderInput={(params) => <TextField {...params} label={copy.model} />} />}
      {mode === "word" && (!selected || !provider) && <Alert severity="info" action={<Button component={Link} href={settingsUrl}>{copy.settings}</Button>}>{copy.llmNeeded}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {loading && !exercise ? <Box sx={{ display: "grid", placeItems: "center", py: 7 }}><CircularProgress /></Box> : exercise && <>
        <Box sx={{ minHeight: 120, display: "grid", placeItems: "center", textAlign: "center", py: 2 }}>
          {mode === "phonetic" && <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography variant="h3" sx={{ fontFamily: "serif" }}>{exercise.phonetic}</Typography><IconButton aria-label={copy.listen} title={copy.listen} onClick={() => speak(exercise.english)}><CampaignRoundedIcon /></IconButton></Stack>}
          {mode === "meaning" && <Stack spacing={1} sx={{ alignItems: "center" }}><Typography variant="h5" sx={{ fontWeight: 650 }}>{exercise.chinese}</Typography>{exercise.duplicateCount > 1 && <Chip variant="outlined" label={`${copy.ambiguous} (${exercise.duplicateCount})`} />}</Stack>}
          {mode === "word" && <Typography variant="h3" color="primary" sx={{ fontWeight: 750 }}>{exercise.english}</Typography>}
        </Box>
        {mode === "meaning" ? <SpellingSlots word={exercise.english} hint={exercise.hint} value={answer} label={copy.answerRest} onChange={setAnswer} onSubmit={() => void checkAnswer()} /> : <TextField autoFocus multiline={mode === "word"} minRows={mode === "word" ? 3 : undefined} label={mode === "word" ? copy.answerMeaning : copy.answerWord} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && mode !== "word") { event.preventDefault(); void checkAnswer(); } }} />}
        {!grade ? <Button size="large" variant="contained" disabled={loading || !answer.trim() || (mode === "word" && (!selected || !provider))} onClick={() => void checkAnswer()}>{loading ? copy.checking : copy.check}</Button> : <><Alert severity="warning"><Typography sx={{ fontWeight: 700 }}>{copy.wrong}</Typography>{grade.feedback}</Alert>{revealed ? <Typography color="text.secondary"><strong>{copy.answer}：</strong>{mode === "word" ? exercise.chinese : exercise.english}</Typography> : <Button variant="outlined" onClick={() => setRevealed(true)}>{copy.reveal}</Button>}<Button size="large" variant="contained" endIcon={<NavigateNextRoundedIcon />} onClick={() => void nextQuestion()}>{copy.next}</Button></>}
      </>}
      <Typography component="a" href="https://github.com/Jimmy-xuzimo/gaokao-vocab" target="_blank" rel="noreferrer" variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>{copy.source}</Typography>
    </Stack></CardContent></Card>
  </Box></Box><Footer /></div>;
}

function SpellingSlots({ word, hint, value, label, onChange, onSubmit }: { word: string; hint: string; value: string; label: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const hintLetterCount = lettersOnly(hint).length; const typedLetters = lettersOnly(value); const totalLetters = lettersOnly(word).length; let letterIndex = 0;
  return <Stack spacing={1}><Typography variant="caption" color="text.secondary">{label}</Typography><Box sx={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: .75, py: 1.5, cursor: "text" }}>
    {[...word].map((character, index) => { const isLetter = /[a-z]/i.test(character); if (!isLetter) return <Box key={index} sx={{ width: character === " " ? 12 : 18, textAlign: "center", alignSelf: "end" }}>{character.trim()}</Box>; const currentLetter = letterIndex++; const prompted = currentLetter < hintLetterCount; const entered = prompted ? character : typedLetters[currentLetter - hintLetterCount] || ""; return <Box key={index} sx={{ width: 30, height: 38, display: "grid", placeItems: "center", borderBottom: 2, borderColor: prompted ? "primary.main" : "divider", color: prompted ? "primary.main" : "text.primary", fontFamily: "monospace", fontSize: 24, fontWeight: 700 }}>{entered}</Box>; })}
    <Box component="input" autoFocus aria-label={label} value={value} maxLength={Math.max(0, totalLetters - hintLetterCount)} onChange={(event) => onChange(lettersOnly(event.currentTarget.value))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSubmit(); } }} sx={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "text" }} />
  </Box></Stack>;
}
