"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { Snackbar } from "@components/ui/feedback/toast";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloudSyncRoundedIcon from "@mui/icons-material/CloudSyncRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveRoundedIcon from "@mui/icons-material/DriveFileMoveRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import CreateNewFolderRoundedIcon from "@mui/icons-material/CreateNewFolderRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import Footer from "@components/ui/layout/Footer";
import CollectionDialog from "@components/vocabulary/CollectionDialog";
import VocabularyItemDialog from "@components/vocabulary/VocabularyItemDialog";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useI18n } from "@lib/i18n/app";
import { useSiteUrl } from "@lib/site-url";
import { getLlmModels, getLlmProfiles, LlmClient, type LlmModelProfile, type LlmProfile } from "@lib/llm";
import { useAuth } from "@lib/client-api/use-auth";
import { vocabularyDrillApi, type DrillMeaning, type VocabularyCollection } from "@lib/client-api";
import { DictionaryLookup } from "../../dictionary/DictionaryClient";

type Mode = "phonetic" | "meaning" | "word";
interface Exercise { id: number; english: string; phonetic: string; phonetics?: Array<{ accent: "uk" | "us" | "other"; text: string }>; chinese: string; examples?: Array<{ en: string; zh: string }>; hintIndexes: number[]; duplicateCount: number; meanings?: DrillMeaning[]; sourceDataset?: string }
interface Grade { isCorrect: boolean; feedback: string }
interface LocalProgress { order: number[]; index: number }

const PROGRESS_PREFIX = "vocabulary-practice-progress-v2:";
const AUTO_SPEAK_KEY = "vocabulary-practice-auto-speak";
const FIRST_LETTER_HINT_KEY = "vocabulary-practice-first-letter-hint";
const PAUSE_AFTER_CORRECT_KEY = "vocabulary-practice-pause-after-correct";
const STAT_DELTAS_PREFIX = "vocabulary-practice-stat-deltas-v1:";
const DEFAULT_BUCKET_SIZE = 20;
const DEFAULT_REFILL_THRESHOLD = 6;
const WORD_INITIAL_BUCKET_SIZE = 5;
const WORD_BUCKET_SIZE = 10;
const WORD_REFILL_THRESHOLD = 3;
const WORD_WORKERS = 3;
const builtInDatasets = [{ id: "ncee", name: "NCEE · 全国高考词汇（3,796）" }];
const modes: Mode[] = ["phonetic", "meaning", "word"];
const phoneticTabGlyphs = ["ə", "æ", "ʃ", "θ", "ŋ", "ɜ", "ɔ", "ʊ"];
interface StatDelta { collectionId: string; dataset: string; sourceWordId: number; appearances: number; correct: number; wrong: number }

const labels = {
  en: { title: "Vocabulary Practice", subtitle: "Practice vocabulary from selectable learning databases.", dataset: "Vocabulary database", phonetic: "Sound → word", meaning: "Meaning → word", word: "Word → meaning", autoSpeak: "Read each new word automatically", listen: "Listen again", answerWord: "Type the English word", answerRest: "Type the remaining letters", answerMeaning: "Meaning", check: "Check", checking: "Checking…", next: "Next question", reveal: "Show answer", reset: "Regenerate", progress: "Progress", correct: "Correct", wrong: "Incorrect", answer: "Answer", ambiguous: "This definition matches multiple entries", loadFailed: "Unable to load questions.", gradeFailed: "The AI did not complete the meaning check.", llmNeeded: "Configure an LLM provider and model in Settings to grade meanings.", settings: "Open Settings", model: "Model", source: "NCEE headwords: gaokao-vocab · definitions and examples: built-in dictionary", favorite: "Add to collection", chooseCollection: "Choose a collection", newCollection: "+ New…", collectionName: "Collection name", saved: "Saved to collection", cloudSaved: "Progress uploaded", sync: "Sync", syncTitle: "Manual progress sync", uploadProgress: "Upload local progress", downloadProgress: "Download cloud progress", syncHint: "Only the current database and practice mode are affected. Download replaces local progress.", noCloudProgress: "No cloud progress exists for this database and mode.", syncFailed: "Unable to sync progress." },
  zh: { title: "词汇练习", subtitle: "从可切换的学习词库中练习英语词汇。", dataset: "词汇数据库", phonetic: "根据音标写单词", meaning: "根据意思写单词", word: "根据单词写意思", autoSpeak: "新题自动朗读", listen: "再次朗读", answerWord: "输入英文单词", answerRest: "填写剩余字母", answerMeaning: "填写这个义项", check: "检查答案", checking: "正在批改…", next: "下一题", reveal: "查看答案", reset: "重新生成", progress: "当前进度", correct: "正确", wrong: "回答错误", answer: "参考答案", ambiguous: "该释义对应多个词条", loadFailed: "无法批量载入题目。", gradeFailed: "AI 未完成本次词义批改。", llmNeeded: "请先在设置中配置 LLM Provider 和 Model，才能批改中文释义。", settings: "打开设置", model: "模型", source: "NCEE 词目：gaokao-vocab · 释义与例句：内置词典", favorite: "收藏到词汇表", chooseCollection: "选择收藏夹", newCollection: "+ 新建…", collectionName: "收藏夹名称", saved: "已收藏（云端保存）", cloudSaved: "本地进度已上传", sync: "同步", syncTitle: "手动同步进度", uploadProgress: "上传本地进度", downloadProgress: "下载云端进度", syncHint: "仅同步当前词库和练习模式；下载会覆盖本地进度。", noCloudProgress: "云端没有当前词库和模式的进度。", syncFailed: "进度同步失败。" },
};

function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " "); }
function lettersOnly(value: string) { return value.toLocaleLowerCase().replace(/[^a-z]/g, ""); }
function wordInputOnly(value: string) { return value.toLocaleLowerCase().replace(/[^a-z -]/g, ""); }
function modeFromHash(hash: string): Mode | null { const value = hash.replace(/^#/, "").toLocaleLowerCase(); return modes.includes(value as Mode) ? value as Mode : null; }
function shuffled<T>(items: T[]) { const result = [...items]; for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; } return result; }
function adaptiveCollectionOrder(items: VocabularyCollection["items"]) { return items.map(item => ({ item, priority: (item.appearanceCount || 0) - (item.wrongCount || 0) * 2 + Math.random() * 1.5 })).sort((a, b) => a.priority - b.priority).map(entry => Number(entry.item.sourceWordId)); }
function isSameCatalog(order: number[], ids: number[]) { if (order.length !== ids.length) return false; const available = new Set(ids); return order.every(id => available.has(id)); }
function isCatalogOrder(order: number[], ids: number[]) { return order.length === ids.length && order.every((id, index) => id === ids[index]); }
function randomHintIndexes(word: string, firstMustBeInitial = false) { const count = lettersOnly(word).length; if (count <= 1) return []; const hintCount = count <= 6 ? 1 : 2; const indexes = Array.from({ length: count }, (_, index) => index).filter(index => !firstMustBeInitial || index !== 0); for (let index = indexes.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]]; } return [...(firstMustBeInitial ? [0] : []), ...indexes.slice(0, hintCount - (firstMustBeInitial ? 1 : 0))].sort((a, b) => a - b); }
function normalizeMeanings(value: unknown): DrillMeaning[] { let parsed = value; if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } } if (!Array.isArray(parsed)) return []; return parsed.flatMap(item => { if (!item || typeof item !== "object") return []; const text = String((item as { text?: unknown }).text || "").trim(); const rawPart = String((item as { partOfSpeech?: unknown }).partOfSpeech || "other"); const normalizedPart = rawPart === "vti" ? "v" : rawPart; const allowed: DrillMeaning["partOfSpeech"][] = ["vt", "vi", "v", "adj", "adv", "n", "prep", "conj", "pron", "int", "num", "art", "other"]; const partOfSpeech = allowed.includes(normalizedPart as DrillMeaning["partOfSpeech"]) ? normalizedPart as DrillMeaning["partOfSpeech"] : "other"; return text ? [{ text, partOfSpeech }] : []; }); }

const meaningColors: Record<DrillMeaning["partOfSpeech"], "primary" | "secondary" | "success" | "info" | "warning" | "error" | "default"> = {
  n: "primary", v: "secondary", vt: "secondary", vi: "secondary",
  adj: "success", adv: "info", prep: "warning", conj: "warning",
  pron: "error", int: "error", num: "info", art: "default", other: "default",
};

function MeaningDisplay({ exercise }: { exercise: Exercise }) {
  const meanings = exercise.meanings?.length
    ? exercise.meanings
    : [{ partOfSpeech: "other" as const, text: exercise.chinese }];
  return <Stack spacing={.75} sx={{ width: "100%", maxWidth: 800 }}>
    {meanings.map((meaning, meaningIndex) => {
      const definitions = meaning.text.split(/\s*\/\s*/).map(item => item.trim()).filter(Boolean);
      return <Box key={`${meaning.partOfSpeech}-${meaningIndex}`} sx={{ display: "grid", gridTemplateColumns: { xs: "52px minmax(0,1fr)", sm: "58px minmax(0,1fr)" }, gap: 1, alignItems: "start", p: 1, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", textAlign: "left" }}>
        <Chip size="small" color={meaningColors[meaning.partOfSpeech]} label={meaning.partOfSpeech} sx={{ minWidth: 48, fontWeight: 800, textTransform: "lowercase" }} />
        <Box sx={{ display: "grid", minWidth: 0, gridTemplateColumns: { xs: "1fr", md: definitions.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr" }, gap: .65 }}>
          {definitions.map((definition, index) => <Typography key={`${definition}-${index}`} sx={{ px: 1, py: .55, borderRadius: 1.25, bgcolor: "action.hover", fontSize: { xs: ".95rem", sm: "1rem" }, fontWeight: 540, lineHeight: 1.45, overflowWrap: "anywhere" }}>{definition}</Typography>)}
        </Box>
      </Box>;
    })}
  </Stack>;
}

function InitialHintIcon({ active }: { active: boolean }) {
  return <Box aria-hidden sx={{ display: "inline-flex", alignItems: "baseline", minWidth: 26, fontFamily: "var(--font-inter)", fontWeight: 850, letterSpacing: "-.12em" }}><Box component="span" sx={{ color: active ? "primary.contrastText" : "primary.main", fontSize: 18 }}>A</Box><Box component="span" sx={{ color: active ? "rgba(255,255,255,.6)" : "text.disabled", fontSize: 15 }}>b</Box></Box>;
}

function ModeLabel({ from, to }: { from: string; to: string }) {
  return <Stack direction="row" spacing={.65} sx={{ alignItems: "center", fontWeight: 750, fontSize: { xs: 16, sm: 18 }, lineHeight: 1 }}><Box component="span">{from}</Box><Box component="span" sx={{ color: "text.secondary", fontSize: 14 }}>→</Box><Box component="span">{to}</Box></Stack>;
}

function MeaningOptionButtons({ locale, firstLetterHint, pauseAfterCorrect, onFirstLetterHint, onPauseAfterCorrect }: { locale: "en" | "zh"; firstLetterHint: boolean; pauseAfterCorrect: boolean; onFirstLetterHint: () => void; onPauseAfterCorrect: () => void }) {
  return <><Tooltip title={locale === "zh" ? "开启后，每题至少显示首字母作为固定提示。" : "Always reveal the first letter as one of the hints."}><IconButton size="small" aria-label={locale === "zh" ? "首字母提示" : "First-letter hint"} aria-pressed={firstLetterHint} onClick={onFirstLetterHint} sx={{ width: 36, height: 36, borderRadius: 1.5, color: firstLetterHint ? "primary.contrastText" : "text.secondary", bgcolor: firstLetterHint ? "primary.main" : "transparent", "&:hover": { bgcolor: firstLetterHint ? "primary.dark" : "action.hover" } }}><InitialHintIcon active={firstLetterHint} /></IconButton></Tooltip><Tooltip title={locale === "zh" ? "开启后，答对不会自动进入下一题，便于查看答案和例句。" : "Stay on the current question after a correct answer to review it."}><IconButton size="small" aria-label={locale === "zh" ? "答对后停留" : "Pause after correct"} aria-pressed={pauseAfterCorrect} onClick={onPauseAfterCorrect} sx={{ width: 36, height: 36, borderRadius: 1.5, color: pauseAfterCorrect ? "primary.contrastText" : "text.secondary", bgcolor: pauseAfterCorrect ? "primary.main" : "transparent", "&:hover": { bgcolor: pauseAfterCorrect ? "primary.dark" : "action.hover" } }}><PauseCircleOutlineRoundedIcon fontSize="small" /></IconButton></Tooltip></>;
}

function AutoSpeakButton({ locale, active, onClick }: { locale: "en" | "zh"; active: boolean; onClick: () => void }) {
  return <Tooltip title={locale === "zh" ? "开启后，每道新题都会自动朗读当前单词。" : "Automatically pronounce the word when each new question appears."}><IconButton size="small" aria-label={locale === "zh" ? "新题自动朗读" : "Automatically speak new questions"} aria-pressed={active} onClick={onClick} sx={{ width: 36, height: 36, borderRadius: 1.5, color: active ? "primary.contrastText" : "text.secondary", bgcolor: active ? "primary.main" : "transparent", "&:hover": { bgcolor: active ? "primary.dark" : "action.hover" } }}><VolumeUpRoundedIcon fontSize="small" /></IconButton></Tooltip>;
}

function PronunciationCard({ exercise, listenLabel, onSpeak }: { exercise: Exercise; listenLabel: string; onSpeak?: () => void }) {
  const pronunciations = exercise.phonetics?.length
    ? exercise.phonetics
    : exercise.phonetic ? [{ accent: "other" as const, text: exercise.phonetic }] : [];
  return <Box sx={{ display: "flex", alignItems: "stretch", maxWidth: "100%", border: 1, borderColor: "divider", borderRadius: 2.5, overflow: "hidden", bgcolor: "background.paper", boxShadow: "0 8px 28px rgba(0,0,0,.08)" }}>
    <Stack direction="row" spacing={{ xs: 1.5, sm: 2.5 }} useFlexGap sx={{ px: { xs: 1.75, sm: 2.5 }, py: 1.5, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
      {pronunciations.map(item => <Stack key={`${item.accent}-${item.text}`} direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box component="span" sx={{ minWidth: 30, px: .75, py: .25, borderRadius: 1, bgcolor: item.accent === "uk" ? "primary.main" : item.accent === "us" ? "secondary.main" : "text.secondary", color: item.accent === "uk" ? "primary.contrastText" : item.accent === "us" ? "secondary.contrastText" : "background.paper", fontSize: 11, lineHeight: 1.5, fontWeight: 800, letterSpacing: ".08em", textAlign: "center", textTransform: "uppercase" }}>{item.accent === "other" ? "IPA" : item.accent}</Box>
        <Typography component="span" sx={{ color: "text.primary", fontFamily: 'var(--font-inter), "MiSans", "Noto Sans", sans-serif', fontSize: { xs: "1.2rem", sm: "1.4rem" }, fontWeight: 500, letterSpacing: ".025em", lineHeight: 1.35 }}>{item.text}</Typography>
      </Stack>)}
    </Stack>
    {onSpeak && <Tooltip title={listenLabel}><IconButton aria-label={listenLabel} onClick={onSpeak} sx={{ width: 52, borderRadius: 0, borderLeft: 1, borderColor: "divider", color: "primary.main", bgcolor: "action.hover", "&:hover": { bgcolor: "primary.main", color: "primary.contrastText" } }}><CampaignRoundedIcon /></IconButton></Tooltip>}
  </Box>;
}

function concurrentOrderedMap<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>, onProgress: (ready: R[]) => void) {
  const results: Array<R | undefined> = Array(items.length); let nextIndex = 0; let readyCount = 0; let resolveFirst!: (value: R) => void;
  const first = new Promise<R>(resolve => { resolveFirst = resolve; });
  const run = async () => { while (true) { const index = nextIndex++; if (index >= items.length) return; results[index] = await worker(items[index]); const previousReadyCount = readyCount; while (readyCount < results.length && results[readyCount] !== undefined) readyCount++; if (readyCount !== previousReadyCount) { const ready = results.slice(0, readyCount) as R[]; if (previousReadyCount === 0) resolveFirst(ready[0]); onProgress(ready); } } };
  const done = items.length ? Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)).then(() => results as R[]) : Promise.resolve([] as R[]);
  return { first, done };
}

export default function NceeVocabularyClient() {
  const { locale } = useI18n(); const copy = labels[locale]; const settingsUrl = useSiteUrl("main", "/settings"); const { status, user } = useAuth(); useDocumentTitle(copy.title);
  const [dataset, setDataset] = useState("ncee"); const [mode, setMode] = useState<Mode>("phonetic"); const [hashReady, setHashReady] = useState(false); const [exercise, setExercise] = useState<Exercise | null>(null); const [answer, setAnswer] = useState("");
  const [meaningAnswers, setMeaningAnswers] = useState<string[]>([]); const [collections, setCollections] = useState<VocabularyCollection[]>([]); const [favoriteOpen, setFavoriteOpen] = useState(false); const [collectionId, setCollectionId] = useState(""); const [toast, setToast] = useState("");
  const [customWordOpen, setCustomWordOpen] = useState(false); const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [resumeFavoriteAfterCollectionCreate, setResumeFavoriteAfterCollectionCreate] = useState(false);
  const [collectionDeleteOpen, setCollectionDeleteOpen] = useState(false); const [deletingCollection, setDeletingCollection] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false); const [syncBusy, setSyncBusy] = useState(false); const [syncError, setSyncError] = useState("");
  const [searchWord, setSearchWord] = useState("");
  const [searchOpen, setSearchOpen] = useState(false); const [searchBusy, setSearchBusy] = useState(false); const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [deleting, setDeleting] = useState(false); const [transferring, setTransferring] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [autoSpeak, setAutoSpeak] = useState(true);
  const [firstLetterHint, setFirstLetterHint] = useState(false);
  const [pauseAfterCorrect, setPauseAfterCorrect] = useState(false); const [answerCorrect, setAnswerCorrect] = useState(false);
  const [phoneticTabGlyph, setPhoneticTabGlyph] = useState("ə");
  const [phoneticRevealed, setPhoneticRevealed] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false); const [forgotten, setForgotten] = useState(false);
  const [position, setPosition] = useState(0); const [total, setTotal] = useState(0); const [bucketRemaining, setBucketRemaining] = useState(0); const [tokenUsage, setTokenUsage] = useState(0);
  const bucketRef = useRef<Exercise[]>([]); const pendingBucketRef = useRef<Promise<Exercise[]> | null>(null); const refillInFlightRef = useRef(false); const progressRef = useRef<LocalProgress | null>(null); const loadingRef = useRef(false); const loadSequenceRef = useRef(0); const collectionsRef = useRef<VocabularyCollection[]>([]);
  const shownQuestionRef = useRef(""); const outcomeRecordedRef = useRef(false); const statsFlushRef = useRef<Promise<void> | null>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<LlmModelProfile[]>([]); const [providers, setProviders] = useState<LlmProfile[]>([]); const [modelId, setModelId] = useState("");
  const selected = models.find((item) => item.id === modelId); const provider = providers.find((item) => item.id === selected?.providerId);
  const datasets = [...builtInDatasets, ...collections.map(item => ({ id: `collection:${item.collectionId}`, name: `★ ${item.name} (${item.items.length})` }))];
  const selectedCollection = dataset.startsWith("collection:") ? collections.find(item => item.collectionId === dataset.slice(11)) : undefined;
  const bucketCapacity = mode === "word" ? WORD_BUCKET_SIZE : DEFAULT_BUCKET_SIZE; const refillThreshold = mode === "word" ? WORD_REFILL_THRESHOLD : DEFAULT_REFILL_THRESHOLD;
  const choosePhoneticTabGlyph = () => setPhoneticTabGlyph(phoneticTabGlyphs[Math.floor(Math.random() * phoneticTabGlyphs.length)]);

  useEffect(() => { const timer = window.setTimeout(() => { const available = getLlmModels().filter((item) => item.id && item.providerId && item.modelId.trim()); setModels(available); setProviders(getLlmProfiles()); setModelId(available[0]?.id || ""); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const applyHash = () => {
      const hashMode = modeFromHash(window.location.hash);
      if (hashMode) setMode(hashMode);
      else window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#phonetic`);
      setHashReady(true);
    };
    const timer = window.setTimeout(applyHash, 0);
    window.addEventListener("hashchange", applyHash);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", applyHash); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedAutoSpeak = localStorage.getItem(AUTO_SPEAK_KEY);
      const savedFirstLetterHint = localStorage.getItem(FIRST_LETTER_HINT_KEY);
      const savedPauseAfterCorrect = localStorage.getItem(PAUSE_AFTER_CORRECT_KEY);
      if (savedAutoSpeak !== null) setAutoSpeak(savedAutoSpeak === "true");
      if (savedFirstLetterHint !== null) setFirstLetterHint(savedFirstLetterHint === "true");
      if (savedPauseAfterCorrect !== null) setPauseAfterCorrect(savedPauseAfterCorrect === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { collectionsRef.current = collections; }, [collections]);
  const speak = useCallback((word: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word); utterance.lang = "en-US"; utterance.rate = .85; window.speechSynthesis.speak(utterance); }, []);
  const flushStats = useCallback(async () => {
    if (status !== "authenticated" || user?.status !== 1 || !user.userId) return;
    if (statsFlushRef.current) return statsFlushRef.current;
    const task = (async () => {
      const key = `${STAT_DELTAS_PREFIX}${user.userId}`; const snapshot = localStorage.getItem(key); if (!snapshot) return;
      let deltas: StatDelta[]; try { deltas = JSON.parse(snapshot); } catch { localStorage.removeItem(key); return; }
      if (!Array.isArray(deltas) || !deltas.length) { localStorage.removeItem(key); return; }
      await vocabularyDrillApi.saveStatDeltas(deltas);
      const currentRaw = localStorage.getItem(key); if (!currentRaw) return;
      try {
        const current = JSON.parse(currentRaw) as StatDelta[]; const sent = new Map(deltas.map(item => [`${item.collectionId}\u0000${item.dataset}\u0000${item.sourceWordId}`, item]));
        const remaining = current.flatMap(item => { const prior = sent.get(`${item.collectionId}\u0000${item.dataset}\u0000${item.sourceWordId}`); if (!prior) return [item]; const next = { ...item, appearances: Math.max(0, item.appearances - prior.appearances), correct: Math.max(0, item.correct - prior.correct), wrong: Math.max(0, item.wrong - prior.wrong) }; return next.appearances || next.correct || next.wrong ? [next] : []; });
        if (remaining.length) localStorage.setItem(key, JSON.stringify(remaining)); else localStorage.removeItem(key);
      } catch { /* keep newer local deltas for a later retry */ }
    })();
    statsFlushRef.current = task;
    try { await task; } finally { if (statsFlushRef.current === task) statsFlushRef.current = null; }
  }, [status, user?.status, user?.userId]);
  useEffect(() => { if (status !== "authenticated" || user?.status !== 1) return; const timer = window.setTimeout(() => { void (async () => { try { await flushStats(); const data = await vocabularyDrillApi.userData(); const normalized = data.collections.map(collection => ({ ...collection, items: collection.items.map(item => ({ ...item, sourceWordId: Number(item.sourceWordId), meanings: normalizeMeanings(item.meanings) })) })); collectionsRef.current = normalized; setCollections(normalized); setCollectionId(normalized[0]?.collectionId || ""); } catch { /* retry when the next practice sequence is loaded */ } })(); }, 0); return () => window.clearTimeout(timer); }, [flushStats, status, user?.status, user?.userId]);
  const fetchWords = useCallback(async (targetDataset: string, targetMode: Mode, ids: number[]) => { if (!ids.length) return []; if (targetDataset.startsWith("collection:")) { const collection = collectionsRef.current.find(item => targetDataset === `collection:${item.collectionId}`); if (!collection) throw new Error("collection_not_found"); const byId = new Map(collection.items.map(item => [Number(item.sourceWordId), item])); return ids.flatMap(rawId => { const id = Number(rawId); const item = byId.get(id); if (!item) return []; return [{ id, english: item.word, phonetic: item.phonetic, chinese: item.meanings.map(m => m.text).join("；"), hintIndexes: randomHintIndexes(item.word, firstLetterHint), duplicateCount: 1, meanings: item.meanings, sourceDataset: item.dataset }]; }); } const response = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&ids=${ids.join(",")}`, { cache: "no-store" }); if (!response.ok) throw new Error(); const words = (await response.json()).words as Exercise[]; return firstLetterHint ? words.map(word => ({ ...word, hintIndexes: randomHintIndexes(word.english, true) })) : words; }, [firstLetterHint]);
  const enrichWord = useCallback(async (word: Exercise) => {
    if (word.meanings?.length) return word;
    if (!selected || !provider) return { ...word, meanings: [{ text: word.chinese, partOfSpeech: "other" as const }] };
    const byId = new Map<number, DrillMeaning[]>(); let completed = false;
    try { const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 2 }); for await (const event of client.stream({
      messages: [{ role: "user", content: JSON.stringify({ id: word.id, english: word.english, dictionary: word.chinese }) }],
      systemPrompt: "预处理一个英语默写词。拆分词典中的不同常见中文义项，并标注词性。词性只能是 v/adj/adv/n/prep/conj/pron/other。不要虚构词义；相近表述合并。必须调用 prepare_word。",
      maxTokens: 3000, temperature: .1, isComplete: () => completed, incompletePrompt: "立即调用 prepare_word。", maxIncompleteRetries: 1,
      tools: [{ name: "prepare_word", description: "提交单词的结构化义项", parameters: { type: "object", properties: { id: { type: "integer" }, meanings: { type: "array", minItems: 1, items: { type: "object", properties: { text: { type: "string" }, partOfSpeech: { type: "string", enum: ["v","adj","adv","n","prep","conj","pron","other"] } }, required: ["text","partOfSpeech"], additionalProperties: false } } }, required: ["id","meanings"], additionalProperties: false }, execute: args => { byId.set(Number(args.id), args.meanings as DrillMeaning[]); completed = true; return { accepted: true }; } }]
    })) { if (event.type === "done") { const usage = event.response.usage; setTokenUsage(value => value + (usage?.totalTokens ?? (usage?.inputTokens || 0) + (usage?.outputTokens || 0))); break; } } } catch { /* dictionary fallback keeps practice available */ }
    return { ...word, meanings: byId.get(word.id) || [{ text: word.chinese, partOfSpeech: "other" as const }] };
  }, [provider, selected]);
  const loadMode = useCallback(async (targetDataset: string, targetMode: Mode, reset = false) => { void flushStats().catch(() => undefined); const sequence = ++loadSequenceRef.current; loadingRef.current = true; pendingBucketRef.current = null; refillInFlightRef.current = false; setLoading(true); setExercise(null); setPosition(0); setTotal(0); setBucketRemaining(0); setError(""); setGrade(null); setPhoneticRevealed(false); setForgotten(false); setWrongFlash(false); setAnswerCorrect(false); setAnswer(""); setMeaningAnswers([]); try {
    const key = `${PROGRESS_PREFIX}${targetDataset}:${targetMode}`; let progress: LocalProgress | null = null;
    if (!reset) { try { const stored = JSON.parse(localStorage.getItem(key) || "null"); if (Array.isArray(stored?.order) && stored.order.length && Number.isInteger(stored.index)) progress = stored; } catch { /* ignore corrupt local progress */ } }
    let ids: number[]; if (targetDataset.startsWith("collection:")) { const collection = collectionsRef.current.find(item => targetDataset === `collection:${item.collectionId}`); if (!collection) throw new Error("collection_not_found"); ids = adaptiveCollectionOrder(collection.items); } else { const catalogResponse = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&catalog=1`, { cache: "no-store" }); if (!catalogResponse.ok) throw new Error(); ids = (await catalogResponse.json()).ids.map(Number); }
    if (!ids.length) throw new Error("empty_dataset");
    const savedProgress = !reset && progress && isSameCatalog(progress.order, ids) ? progress : null;
    const savedIndex = savedProgress ? Math.min(Math.max(savedProgress.index, 0), ids.length - 1) : 0;
    progress = savedProgress
      ? { order: isCatalogOrder(savedProgress.order, ids) ? [...ids.slice(0, savedIndex), ...shuffled(ids.slice(savedIndex))] : savedProgress.order, index: savedIndex }
      : { order: targetDataset.startsWith("collection:") ? ids : shuffled(ids), index: 0 };
    localStorage.setItem(key, JSON.stringify(progress));
    progressRef.current = progress; setPosition(progress.index + 1); setTotal(progress.order.length); const initialSize = targetMode === "word" ? WORD_INITIAL_BUCKET_SIZE : DEFAULT_BUCKET_SIZE; const fetched = await fetchWords(targetDataset, targetMode, progress.order.slice(progress.index, progress.index + initialSize)); if (!fetched.length) throw new Error("words_not_found"); if (sequence !== loadSequenceRef.current) return;
    if (targetMode === "word") { let shown = false; const queue = concurrentOrderedMap(fetched, WORD_WORKERS, enrichWord, ready => { if (sequence !== loadSequenceRef.current) return; bucketRef.current = ready; setBucketRemaining(ready.length); if (!shown) { shown = true; setExercise(ready[0]); setMeaningAnswers(Array(ready[0]?.meanings?.length || 1).fill("")); setLoading(false); loadingRef.current = false; } }); pendingBucketRef.current = queue.done; await queue.first; void queue.done.then(words => { if (sequence === loadSequenceRef.current) { bucketRef.current = words; pendingBucketRef.current = null; setBucketRemaining(words.length); } }); }
    else { bucketRef.current = fetched; setExercise(fetched[0] || null); setMeaningAnswers(Array(fetched[0]?.meanings?.length || 1).fill("")); setBucketRemaining(fetched.length); }
  } catch { if (sequence === loadSequenceRef.current) { bucketRef.current = []; progressRef.current = null; setExercise(null); setError(copy.loadFailed); } } finally { if (sequence === loadSequenceRef.current) { loadingRef.current = false; setLoading(false); } } }, [copy.loadFailed, enrichWord, fetchWords, flushStats]);
  const nextQuestion = useCallback(async () => { const progress = progressRef.current; if (!progress || loadingRef.current) return; if (pendingBucketRef.current) { setExercise(null); setLoading(true); bucketRef.current = await pendingBucketRef.current; pendingBucketRef.current = null; setLoading(false); } setGrade(null); setPhoneticRevealed(false); setForgotten(false); setWrongFlash(false); setAnswerCorrect(false); setAnswer(""); progress.index++;
    if (progress.index >= progress.order.length) { await loadMode(dataset, mode, true); return; }
    localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress)); const remaining = bucketRef.current.slice(1); bucketRef.current = remaining; setBucketRemaining(remaining.length); setExercise(remaining[0] || null); setMeaningAnswers(Array(remaining[0]?.meanings?.length || 1).fill("")); setPosition(progress.index + 1);
    const refillThreshold = mode === "word" ? WORD_REFILL_THRESHOLD : DEFAULT_REFILL_THRESHOLD; const refillTarget = mode === "word" ? WORD_BUCKET_SIZE : DEFAULT_BUCKET_SIZE;
    if (remaining.length < refillThreshold && !refillInFlightRef.current) { refillInFlightRef.current = true; const sequence = loadSequenceRef.current; if (!remaining.length) { loadingRef.current = true; setLoading(true); } try { const start = progress.index + remaining.length; const ids = progress.order.slice(start, progress.index + refillTarget); const fetched = await fetchWords(dataset, mode, ids); if (mode === "word") { let appended = 0; const queue = concurrentOrderedMap(fetched, WORD_WORKERS, enrichWord, ready => { if (sequence !== loadSequenceRef.current) return; const additions = ready.slice(appended); appended = ready.length; bucketRef.current = [...bucketRef.current, ...additions]; setBucketRemaining(bucketRef.current.length); if (!remaining.length && bucketRef.current.length) { setExercise(bucketRef.current[0]); setMeaningAnswers(Array(bucketRef.current[0]?.meanings?.length || 1).fill("")); setLoading(false); loadingRef.current = false; } }); void queue.done.catch(() => { if (sequence === loadSequenceRef.current) setError(copy.loadFailed); }).finally(() => { if (sequence === loadSequenceRef.current) refillInFlightRef.current = false; }); }
      else if (sequence === loadSequenceRef.current) { bucketRef.current = [...bucketRef.current, ...fetched]; setBucketRemaining(bucketRef.current.length); refillInFlightRef.current = false; if (!remaining.length) { setExercise(fetched[0] || null); setLoading(false); loadingRef.current = false; } }
    } catch { if (sequence === loadSequenceRef.current) { refillInFlightRef.current = false; setError(copy.loadFailed); setLoading(false); loadingRef.current = false; } } }
  }, [copy.loadFailed, dataset, enrichWord, fetchWords, loadMode, mode]);
  useEffect(() => { if (!hashReady) return; const timer = window.setTimeout(() => void loadMode(dataset, mode), 0); return () => window.clearTimeout(timer); }, [dataset, hashReady, loadMode, mode]);
  useEffect(() => { if (mode === "phonetic" && exercise && autoSpeak) speak(exercise.english); }, [autoSpeak, exercise, mode, speak]);
  useEffect(() => {
    if (!exercise || loading || forgotten || grade || searchOpen || syncOpen || favoriteOpen) return;
    const frame = window.requestAnimationFrame(() => answerInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [exercise, favoriteOpen, forgotten, grade, loading, mode, searchOpen, syncOpen, wrongFlash]);

  const previousQuestion = useCallback(async () => { const progress = progressRef.current; if (!progress || progress.index <= 0 || loadingRef.current) return; progress.index--; localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress)); await loadMode(dataset, mode); }, [dataset, loadMode, mode]);
  const revealPronunciation = useCallback(() => {
    if (mode !== "meaning" || !exercise || loading) return;
    setPhoneticRevealed(true);
    speak(exercise.english);
  }, [exercise, loading, mode, speak]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat) return;
      const key = event.key.toLocaleLowerCase();
      if (key !== "f" && key !== "j" && key !== "p") return;
      if (key === "p" && (mode !== "meaning" || !exercise || loading || dictionaryOpen || searchOpen || syncOpen || favoriteOpen || customWordOpen || collectionDialogOpen)) return;
      if (dictionaryOpen) return;
      event.preventDefault();
      if (key === "f" && position > 1 && !loading) void previousQuestion();
      if (key === "j" && position < total && !loading) void nextQuestion();
      if (key === "p") revealPronunciation();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [collectionDialogOpen, customWordOpen, dictionaryOpen, exercise, favoriteOpen, loading, mode, nextQuestion, position, previousQuestion, revealPronunciation, searchOpen, syncOpen, total]);
  useEffect(() => {
    const handlePracticeKeyboard = (event: KeyboardEvent) => {
      if (mode === "word" || !exercise || loading || dictionaryOpen || searchOpen || syncOpen || favoriteOpen || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      const isEditable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
      if (isEditable) return;
      if (event.key === ";") {
        event.preventDefault();
        if (!forgotten) void forgetAnswer();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (forgotten || answerCorrect) void nextQuestion(); else void checkAnswer();
        return;
      }
      if (forgotten || answerCorrect) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        setAnswer(value => value.slice(0, -1));
        answerInputRef.current?.focus();
        return;
      }
      if (/^[a-zA-Z -]$/.test(event.key)) {
        event.preventDefault();
        setAnswer(value => wordInputOnly(value + event.key));
        answerInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handlePracticeKeyboard);
    return () => window.removeEventListener("keydown", handlePracticeKeyboard);
  });

  function queueCollectionStat(kind: "appearances" | "correct" | "wrong") {
    if (!exercise || !dataset.startsWith("collection:") || !user?.userId) return;
    const collectionId = dataset.slice(11); const sourceDataset = exercise.sourceDataset || "custom"; const storageKey = `${STAT_DELTAS_PREFIX}${user.userId}`;
    let deltas: StatDelta[] = []; try { const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(parsed)) deltas = parsed; } catch { /* replace corrupt pending stats */ }
    const existing = deltas.find(item => item.collectionId === collectionId && item.dataset === sourceDataset && item.sourceWordId === exercise.id);
    if (existing) existing[kind]++; else deltas.push({ collectionId, dataset: sourceDataset, sourceWordId: exercise.id, appearances: kind === "appearances" ? 1 : 0, correct: kind === "correct" ? 1 : 0, wrong: kind === "wrong" ? 1 : 0 });
    localStorage.setItem(storageKey, JSON.stringify(deltas));
    setCollections(current => current.map(collection => collection.collectionId !== collectionId ? collection : { ...collection, items: collection.items.map(item => item.dataset !== sourceDataset || Number(item.sourceWordId) !== exercise.id ? item : { ...item, appearanceCount: (item.appearanceCount || 0) + (kind === "appearances" ? 1 : 0), correctCount: (item.correctCount || 0) + (kind === "correct" ? 1 : 0), wrongCount: (item.wrongCount || 0) + (kind === "wrong" ? 1 : 0) }) }));
  }
  function recordCorrect() { if (outcomeRecordedRef.current) return; outcomeRecordedRef.current = true; queueCollectionStat("correct"); }
  useEffect(() => {
    if (!exercise || loading || !dataset.startsWith("collection:")) return;
    const questionKey = `${dataset}:${mode}:${position}:${exercise.sourceDataset || "custom"}:${exercise.id}`;
    if (shownQuestionRef.current === questionKey) return;
    shownQuestionRef.current = questionKey; outcomeRecordedRef.current = false; queueCollectionStat("appearances");
  });

  async function findWord() {
    const query = searchWord.trim().toLocaleLowerCase(); if (!query) return; setSearchOpen(true); setSearchBusy(true); setSearchResults([]);
    try {
      if (dataset.startsWith("collection:")) {
        const items = collections.find(item => item.collectionId === dataset.slice(11))?.items || [];
        const matches = items.filter(item => item.word.toLocaleLowerCase().includes(query)).slice(0, 20);
        setSearchResults(matches.map(item => ({ id: Number(item.sourceWordId), english: item.word, phonetic: item.phonetic, chinese: item.meanings.map(meaning => meaning.text).join("；"), meanings: item.meanings, hintIndexes: [], duplicateCount: 1 })));
      } else {
        const response = await fetch(`/api/vocabulary-drill?dataset=${dataset}&mode=${mode}&search=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const matches = (await response.json()).matches as Array<{ id: number; english: string }>;
        setSearchResults(await fetchWords(dataset, mode, matches.map(item => item.id)));
      }
    } catch { setSearchResults([]); } finally { setSearchBusy(false); }
  }

  async function checkAnswer() {
    if (answerCorrect) { await nextQuestion(); return; }
    const submittedMeanings = meaningAnswers.map(value => value.trim()).filter(Boolean);
    if (!exercise || (mode === "word" ? !submittedMeanings.length : !answer.trim())) return;
    if (mode !== "word") { const isCorrect = mode === "meaning" ? lettersOnly(answer) === lettersOnly(exercise.english) : normalize(answer) === normalize(exercise.english); if (isCorrect) { recordCorrect(); if (mode === "meaning" && pauseAfterCorrect) setAnswerCorrect(true); else await nextQuestion(); } else { setWrongFlash(false); window.requestAnimationFrame(() => { setWrongFlash(true); window.setTimeout(() => setWrongFlash(false), 650); }); } return; }
    if (!selected || !provider) { setError(copy.llmNeeded); return; }
    setLoading(true); setError(""); let result: Grade | null = null;
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 3 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: JSON.stringify({ englishWord: exercise.english, dictionaryMeanings: exercise.meanings, learnerMeanings: submittedMeanings }) }],
        systemPrompt: "你负责批改高考英语词义练习。判断学习者写出的中文释义是否表达了词典释义中至少一个实质、正确的常见义项；不要求措辞完全一致，不因缺少其他义项判错。若释义错误或过于模糊，简短指出问题。必须且只能调用一次 grade_meaning，feedback 使用简体中文。",
        maxTokens: 512, temperature: .1, isComplete: () => result !== null, incompletePrompt: "请立即调用 grade_meaning 完成批改。", maxIncompleteRetries: 2,
        tools: [{ name: "grade_meaning", description: "提交词义批改结果。", parameters: { type: "object", properties: { is_correct: { type: "boolean" }, feedback: { type: "string" } }, required: ["is_correct", "feedback"], additionalProperties: false }, execute: (args) => { result = { isCorrect: Boolean(args.is_correct), feedback: String(args.feedback || "") }; return { accepted: true }; } }],
      })) { if (event.type === "done") { const usage = event.response.usage; setTokenUsage(value => value + (usage?.totalTokens ?? (usage?.inputTokens || 0) + (usage?.outputTokens || 0))); break; } }
      if (!result) throw new Error("Incomplete grading workflow");
      const completed = result as Grade;
      if (completed.isCorrect) { recordCorrect(); setLoading(false); await nextQuestion(); } else { setGrade(null); setWrongFlash(false); window.requestAnimationFrame(() => { setWrongFlash(true); window.setTimeout(() => setWrongFlash(false), 650); }); }
    } catch { setError(copy.gradeFailed); } finally { setLoading(false); }
  }

  async function saveFavorite() {
    if (!exercise || !collectionId) return;
    try {
      setFavoriteOpen(false); void vocabularyDrillApi.addItem({ collectionId, dataset: exercise.sourceDataset || dataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, phonetics: exercise.phonetics, meanings: exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" }], example: exercise.examples?.[0]?.en || "" }).then(() => setToast(copy.saved)).catch(() => undefined);
    } catch { /* dialog remains usable after a failed collection creation */ }
  }

  async function forgetAnswer() {
    if (!exercise || loading) return; if (!outcomeRecordedRef.current) { outcomeRecordedRef.current = true; queueCollectionStat("wrong"); } setForgotten(true); setGrade(null); if (mode === "word") setMeaningAnswers((exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]).map(meaning => meaning.text)); else setAnswer(exercise.english);
    if (status !== "authenticated" || user?.status !== 1) return;
    try { let target = collections.find(item => item.name.toLocaleLowerCase() === "default"); if (!target) { const created = await vocabularyDrillApi.createCollection("default"); target = created.collection; setCollections(current => [...current, created.collection]); }
      const meanings = exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]; const sourceDataset = exercise.sourceDataset || dataset; await vocabularyDrillApi.addItem({ collectionId: target.collectionId, dataset: sourceDataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, phonetics: exercise.phonetics, meanings, example: exercise.examples?.[0]?.en || "" }); setCollections(current => current.map(collection => collection.collectionId !== target.collectionId || collection.items.some(item => Number(item.sourceWordId) === exercise.id && item.dataset === sourceDataset) ? collection : { ...collection, items: [...collection.items, { dataset: sourceDataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, phonetics: exercise.phonetics, meanings, example: exercise.examples?.[0]?.en || "", appearanceCount: 0, correctCount: 0, wrongCount: 0 }] })); setToast(locale === "zh" ? "答案已显示，并已收藏到 default" : "Answer shown and saved to default");
    } catch { setToast(locale === "zh" ? "答案已显示，但收藏失败" : "Answer shown, but it could not be saved"); }
  }

  async function deleteFromCollection() {
    if (!exercise || !dataset.startsWith("collection:") || deleting) return; const collection = collections.find(item => dataset === `collection:${item.collectionId}`); if (!collection) return; setDeleting(true);
    try {
      await flushStats();
      await vocabularyDrillApi.deleteItem(collection.collectionId, exercise.id, exercise.sourceDataset);
      const remainingItems = collection.items.filter(word => Number(word.sourceWordId) !== exercise.id || (exercise.sourceDataset && word.dataset !== exercise.sourceDataset));
      const updatedCollections = collections.map(item => item.collectionId === collection.collectionId ? { ...item, items: remainingItems } : item); collectionsRef.current = updatedCollections; setCollections(updatedCollections); setToast(locale === "zh" ? "已从收藏夹删除" : "Removed from collection");
      if (!remainingItems.length) { setDataset("ncee"); return; }
      const progress = progressRef.current;
      if (progress) {
        const remainingIds = remainingItems.map(item => Number(item.sourceWordId)); const available = new Set(remainingIds); const seen = new Set<number>();
        const afterCurrent = [...progress.order.slice(progress.index + 1), ...progress.order.slice(0, progress.index)].filter(id => available.has(id) && !seen.has(id) && Boolean(seen.add(id)));
        progress.order = [...afterCurrent, ...remainingIds.filter(id => !seen.has(id) && Boolean(seen.add(id)))]; progress.index = 0;
        localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress));
      }
      await loadMode(dataset, mode);
    }
    catch { setToast(locale === "zh" ? "删除失败" : "Unable to remove word"); } finally { setDeleting(false); }
  }

  async function deleteSelectedCollection() {
    if (!selectedCollection || deletingCollection) return;
    setDeletingCollection(true);
    try {
      await flushStats().catch(() => undefined);
      await vocabularyDrillApi.deleteCollection(selectedCollection.collectionId);
      const nextCollections = collections.filter(item => item.collectionId !== selectedCollection.collectionId);
      collectionsRef.current = nextCollections;
      setCollections(nextCollections); setDataset("ncee"); setCollectionDeleteOpen(false);
      for (const practiceMode of modes) localStorage.removeItem(`${PROGRESS_PREFIX}collection:${selectedCollection.collectionId}:${practiceMode}`);
      setToast(locale === "zh" ? "收藏夹已删除" : "Collection deleted");
    } catch { setToast(locale === "zh" ? "无法删除收藏夹" : "Unable to delete the collection"); }
    finally { setDeletingCollection(false); }
  }

  async function transferCollectionItem() {
    if (!exercise || !dataset.startsWith("collection:") || transferring) return;
    const sourceCollection = collections.find(item => dataset === `collection:${item.collectionId}`); if (!sourceCollection) return;
    setTransferring(true);
    try {
      await flushStats();
      const result = await vocabularyDrillApi.transferItem({ collectionId: sourceCollection.collectionId, dataset: exercise.sourceDataset || "custom", sourceWordId: exercise.id });
      const data = await vocabularyDrillApi.userData();
      const normalized = data.collections.map(collection => ({ ...collection, items: collection.items.map(item => ({ ...item, sourceWordId: Number(item.sourceWordId), meanings: normalizeMeanings(item.meanings) })) }));
      collectionsRef.current = normalized; setCollections(normalized);
      const remaining = normalized.find(item => item.collectionId === sourceCollection.collectionId)?.items || [];
      setToast(result.restored ? (locale === "zh" ? "已恢复到原收藏夹" : "Restored to the original collection") : (locale === "zh" ? "已转移到 transferred" : "Moved to transferred"));
      if (!remaining.length) setDataset(`collection:${result.destinationCollectionId}`); else await loadMode(dataset, mode);
    } catch { setToast(locale === "zh" ? "转移失败；目标中可能已有这个词，或原收藏夹已不存在" : "Unable to move; the destination may already contain this word, or the original collection no longer exists"); }
    finally { setTransferring(false); }
  }

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() !== "d" || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (!dataset.startsWith("collection:") || !exercise || loading || deleting || dictionaryOpen || searchOpen || syncOpen || favoriteOpen || customWordOpen || collectionDialogOpen) return;
      event.preventDefault();
      void deleteFromCollection();
    };
    window.addEventListener("keydown", handleDeleteShortcut);
    return () => window.removeEventListener("keydown", handleDeleteShortcut);
  });
  useEffect(() => {
    const handleTransferShortcut = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() !== "i" || !event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (!dataset.startsWith("collection:") || !exercise || loading || deleting || transferring || dictionaryOpen || searchOpen || syncOpen || favoriteOpen || customWordOpen || collectionDialogOpen) return;
      event.preventDefault();
      void transferCollectionItem();
    };
    window.addEventListener("keydown", handleTransferShortcut);
    return () => window.removeEventListener("keydown", handleTransferShortcut);
  });

  async function uploadProgress() {
    const progress = progressRef.current; if (!progress) return; setSyncBusy(true); setSyncError("");
    try { await vocabularyDrillApi.saveProgress({ dataset, mode, order: progress.order, index: progress.index }); setSyncOpen(false); setToast(copy.cloudSaved); }
    catch { setSyncError(copy.syncFailed); } finally { setSyncBusy(false); }
  }

  async function downloadProgress() {
    setSyncBusy(true); setSyncError("");
    try { const data = await vocabularyDrillApi.userData(); const progress = data.progress.find(item => item.dataset === dataset && item.mode === mode); if (!progress) { setSyncError(copy.noCloudProgress); return; }
      localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify({ order: progress.order, index: progress.index })); setSyncOpen(false); await loadMode(dataset, mode); setToast(locale === "zh" ? "云端进度已下载" : "Cloud progress downloaded");
    } catch { setSyncError(copy.syncFailed); } finally { setSyncBusy(false); }
  }

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, py: 5 }}><Box sx={{ maxWidth: 780, mx: "auto" }}>
    <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,1fr) auto" }, gap: 1.25, alignItems: "center" }}><Autocomplete size="small" options={datasets} value={datasets.find((item) => item.id === dataset) || builtInDatasets[0]} disableClearable getOptionLabel={(item) => item.name} onChange={(_event, value) => setDataset(value.id)} renderInput={(params) => <TextField {...params} label={copy.dataset} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: true, sx: { userSelect: "none", cursor: "pointer" } } }} />} /><Stack direction="row" spacing={.5} sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}><Tooltip title={locale === "zh" ? "新增自定义词汇" : "Add custom word"}><span><IconButton size="small" aria-label={locale === "zh" ? "新增自定义词汇" : "Add custom word"} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => setCustomWordOpen(true)}><AddRoundedIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title={locale === "zh" ? "新建收藏夹" : "New collection"}><span><IconButton size="small" aria-label={locale === "zh" ? "新建收藏夹" : "New collection"} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => { setResumeFavoriteAfterCollectionCreate(false); setCollectionDialogOpen(true); }}><CreateNewFolderRoundedIcon fontSize="small" /></IconButton></span></Tooltip>{selectedCollection && <Tooltip title={locale === "zh" ? "删除当前收藏夹" : "Delete current collection"}><IconButton size="small" color="error" aria-label={locale === "zh" ? "删除当前收藏夹" : "Delete current collection"} onClick={() => setCollectionDeleteOpen(true)}><DeleteForeverRoundedIcon fontSize="small" /></IconButton></Tooltip>}</Stack></Box></CardContent><Tabs value={mode} onChange={(_event, value: Mode) => { if (value === "phonetic") choosePhoneticTabGlyph(); setMode(value); window.location.hash = value; }} variant="fullWidth"><Tab value="phonetic" aria-label={copy.phonetic} label={<Tooltip title={copy.phonetic}><Box><ModeLabel from={phoneticTabGlyph} to="A" /></Box></Tooltip>} /><Tab value="meaning" aria-label={copy.meaning} label={<Tooltip title={copy.meaning}><Box><ModeLabel from="文" to="A" /></Box></Tooltip>} /><Tab value="word" aria-label={copy.word} label={<Tooltip title={copy.word}><Box><ModeLabel from="A" to="文" /></Box></Tooltip>} /></Tabs><CardContent><Stack spacing={2.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">{copy.progress}：{position} / {total || "…"}</Typography><LinearProgress variant={total ? "determinate" : "indeterminate"} value={total ? position / total * 100 : undefined} sx={{ mt: .5 }} /><Stack direction="row" spacing={1.5} sx={{ mt: .5 }}><Typography variant="caption" color="text.secondary">{locale === "zh" ? "桶剩余" : "Bucket"}: {bucketRemaining} / {bucketCapacity} · {locale === "zh" ? "补充阈值" : "Refill threshold"}: {refillThreshold}</Typography>{mode === "word" && <Typography variant="caption" color="text.secondary">Tokens: {tokenUsage}</Typography>}</Stack></Box><Stack direction="row" spacing={.5}><Tooltip title={copy.sync}><span><IconButton size="small" aria-label={copy.sync} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => { setSyncError(""); setSyncOpen(true); }}><CloudSyncRoundedIcon fontSize="small" /></IconButton></span></Tooltip><Tooltip title={copy.reset}><IconButton size="small" aria-label={copy.reset} onClick={() => void loadMode(dataset, mode, true)}><RestartAltRoundedIcon fontSize="small" /></IconButton></Tooltip></Stack></Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Tooltip title={locale === "zh" ? "后退（Ctrl + F）" : "Previous (Ctrl + F)"} arrow><span><IconButton aria-label={locale === "zh" ? "后退" : "Previous"} disabled={loading || position <= 1} onClick={() => void previousQuestion()}><ChevronLeftRoundedIcon /></IconButton></span></Tooltip><TextField fullWidth size="small" label={locale === "zh" ? "查找英文单词" : "Find an English word"} value={searchWord} onChange={event => setSearchWord(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void findWord(); } }} slotProps={{ input: { endAdornment: <Tooltip title={locale === "zh" ? "查找（Enter）" : "Search (Enter)"}><IconButton edge="end" onClick={() => void findWord()}><SearchRoundedIcon /></IconButton></Tooltip> } }} /><Tooltip title={locale === "zh" ? "前进（Ctrl + J）" : "Next (Ctrl + J)"} arrow><span><IconButton aria-label={locale === "zh" ? "前进" : copy.next} disabled={loading || position >= total} onClick={() => void nextQuestion()}><NavigateNextRoundedIcon /></IconButton></span></Tooltip></Stack>
      {mode === "word" && models.length > 0 && <Autocomplete size="small" options={models} value={selected} disableClearable getOptionLabel={(item) => item.name || item.modelId} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_e, value) => setModelId(value.id)} renderInput={(params) => <TextField {...params} label={copy.model} />} />}
      {mode === "word" && (!selected || !provider) && <Alert severity="info" action={<Button component={Link} href={settingsUrl}>{copy.settings}</Button>}>{copy.llmNeeded}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {loading && !exercise ? <Box sx={{ display: "grid", placeItems: "center", py: 7 }}><CircularProgress /></Box> : exercise && <>
        <Box sx={{ display: "grid", placeItems: "center", textAlign: "center", pt: 5.25, pb: .5, position: "relative" }}><Stack direction="row" spacing={.5} sx={{ position: "absolute", left: 0, top: 0, alignItems: "center" }}><Tooltip title={locale === "zh" ? "在词典中查看当前单词" : "Look up the current word in Dictionary"}><IconButton size="small" color="primary" aria-label={locale === "zh" ? "打开词典" : "Open dictionary"} onClick={() => setDictionaryOpen(true)} sx={{ width: 36, height: 36, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}><MenuBookRoundedIcon fontSize="small" /></IconButton></Tooltip>{mode === "phonetic" && <AutoSpeakButton locale={locale} active={autoSpeak} onClick={() => { const checked = !autoSpeak; setAutoSpeak(checked); localStorage.setItem(AUTO_SPEAK_KEY, String(checked)); }} />}{mode === "meaning" && <MeaningOptionButtons locale={locale} firstLetterHint={firstLetterHint} pauseAfterCorrect={pauseAfterCorrect} onFirstLetterHint={() => { const checked = !firstLetterHint; setFirstLetterHint(checked); localStorage.setItem(FIRST_LETTER_HINT_KEY, String(checked)); }} onPauseAfterCorrect={() => { const checked = !pauseAfterCorrect; setPauseAfterCorrect(checked); localStorage.setItem(PAUSE_AFTER_CORRECT_KEY, String(checked)); }} />}</Stack><Stack direction="row" sx={{ position: "absolute", right: 0, top: 0 }}>{dataset.startsWith("collection:") && <><IconButton size="small" color="primary" title={(collections.find(item => dataset === `collection:${item.collectionId}`)?.name.toLocaleLowerCase() === "transferred" ? (locale === "zh" ? "恢复到原收藏夹" : "Restore to original collection") : (locale === "zh" ? "转移到 transferred" : "Move to transferred")) + " (Ctrl + I)"} disabled={transferring || deleting} onClick={() => void transferCollectionItem()}>{transferring ? <CircularProgress size={18} /> : <DriveFileMoveRoundedIcon fontSize="small" />}</IconButton><IconButton size="small" color="error" title={locale === "zh" ? "从收藏夹删除（Ctrl + D）" : "Remove from collection (Ctrl + D)"} disabled={deleting || transferring} onClick={() => void deleteFromCollection()}>{deleting ? <CircularProgress size={18} /> : <DeleteOutlineRoundedIcon fontSize="small" />}</IconButton></>}<IconButton size="small" title={copy.favorite} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => setFavoriteOpen(true)}><BookmarkAddRoundedIcon fontSize="small" /></IconButton></Stack>
          {mode === "phonetic" && <PronunciationCard exercise={exercise} listenLabel={copy.listen} onSpeak={() => speak(exercise.english)} />}
          {mode === "meaning" && <Stack spacing={1} sx={{ width: "100%", alignItems: "center" }}><MeaningDisplay exercise={exercise} />{exercise.duplicateCount > 1 && <Chip size="small" variant="outlined" label={`${copy.ambiguous} (${exercise.duplicateCount})`} />}{phoneticRevealed && <PronunciationCard exercise={exercise} listenLabel={copy.listen} />}<Tooltip title={locale === "zh" ? "显示音标并朗读（Ctrl + P）" : "Show pronunciation and speak (Ctrl + P)"}><Button size="small" variant="text" startIcon={<CampaignRoundedIcon />} onClick={revealPronunciation}>{locale === "zh" ? "显示音标并朗读" : "Show pronunciation and speak"}</Button></Tooltip></Stack>}
          {mode === "word" && <Stack spacing={1} sx={{ alignItems: "center" }}><Typography variant="h3" color={wrongFlash ? "error" : "primary"} sx={{ fontWeight: 750, animation: wrongFlash ? "wrongPulse .22s ease-in-out 3" : "none", "@keyframes wrongPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: .2 } } }}>{exercise.english}</Typography><Stack direction="row" spacing={.5}>{(exercise.meanings || []).map((meaning, index) => <Chip key={index} size="small" label={meaning.partOfSpeech} />)}</Stack></Stack>}
        </Box>
        {mode === "meaning" ? <SpellingSlots inputRef={answerInputRef} word={exercise.english} hintIndexes={exercise.hintIndexes} value={answer} label={copy.answerWord} wrongFlash={wrongFlash} correct={answerCorrect} autoFilled={forgotten} onChange={setAnswer} onSubmit={() => void checkAnswer()} onForget={() => void forgetAnswer()} /> : mode === "word" ? <Stack spacing={1}>{(exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]).map((meaning, index) => <TextField key={index} inputRef={index === 0 ? answerInputRef : undefined} autoFocus={index === 0} multiline minRows={2} label={`${meaning.partOfSpeech} · ${copy.answerMeaning} ${index + 1}`} value={meaningAnswers[index] || ""} onChange={event => setMeaningAnswers(values => { const next = [...values]; next[index] = event.target.value; return next; })} onKeyDown={event => { if (event.key === ";") { event.preventDefault(); void forgetAnswer(); } }} sx={forgotten ? { bgcolor: "rgba(255, 193, 7, .18)" } : undefined} />)}</Stack> : <TextField inputRef={answerInputRef} autoFocus label={copy.answerWord} value={answer} error={wrongFlash} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === ";") { event.preventDefault(); void forgetAnswer(); } else if (event.key === "Enter") { event.preventDefault(); void checkAnswer(); } }} sx={forgotten ? { bgcolor: "rgba(255, 193, 7, .18)" } : undefined} />}
        {(forgotten || answerCorrect) && Boolean(exercise.examples?.length) && <Box sx={{ p: 2, borderLeft: 3, borderColor: "primary.main", bgcolor: "action.hover", borderRadius: 1 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{locale === "zh" ? "词典例句" : "Dictionary examples"}</Typography>{exercise.examples?.slice(0, 3).map((example, index) => <Box key={index} sx={{ mt: .75 }}><Typography variant="body2" sx={{ fontStyle: "italic" }}>{example.en}</Typography>{example.zh && <Typography variant="body2" color="text.secondary">{example.zh}</Typography>}</Box>)}</Box>}
        <Tooltip title={locale === "zh" ? "忘记了（;）" : "Forgot (;)"}><Box component="span" sx={{ display: "flex", width: "100%" }}><Button fullWidth size="large" variant="outlined" disabled={loading || forgotten || answerCorrect} onClick={() => void forgetAnswer()}>{locale === "zh" ? "忘记了" : "Forgot"}<Box component="kbd" sx={{ minWidth: 22, height: 22, ml: .75, px: .6, display: "inline-grid", placeItems: "center", border: "1px solid #808080", borderRadius: 1, bgcolor: "background.paper", color: "inherit", boxShadow: "0 2px 0 rgba(0,0,0,.35)", fontFamily: "monospace", fontSize: 13, lineHeight: 1 }}>;</Box></Button></Box></Tooltip>
        {forgotten || answerCorrect ? <Tooltip title={`${copy.next} (Ctrl + J)`}><Button fullWidth size="large" variant="contained" color={answerCorrect ? "success" : "primary"} endIcon={<NavigateNextRoundedIcon />} onClick={() => void nextQuestion()}>{copy.next}</Button></Tooltip> : !grade ? <Tooltip title={mode === "word" ? copy.check : `${copy.check} (Enter)`}><Box component="span" sx={{ display: "flex", justifyContent: "center" }}><Button size="large" variant="contained" disabled={loading || (mode === "word" ? !meaningAnswers.some(value => value.trim()) || !selected || !provider : !answer.trim())} onClick={() => void checkAnswer()}>{loading ? copy.checking : copy.check}</Button></Box></Tooltip> : <><Alert severity="warning">{grade.feedback}</Alert><Tooltip title={`${copy.next} (Ctrl + J)`}><Button fullWidth size="large" variant="contained" endIcon={<NavigateNextRoundedIcon />} onClick={() => void nextQuestion()}>{copy.next}</Button></Tooltip></>}
      </>}
      <Typography component="a" href="https://github.com/Jimmy-xuzimo/gaokao-vocab" target="_blank" rel="noreferrer" variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>{copy.source}</Typography>
    </Stack></CardContent></Card>
    <VocabularyItemDialog open={customWordOpen} locale={locale} collections={collections} initialCollectionId={dataset.startsWith("collection:") ? dataset.slice(11) : collectionId} onClose={() => setCustomWordOpen(false)} onCollectionCreated={collection => { setCollections(current => [...current, collection]); setCollectionId(collection.collectionId); }} onSaved={(targetCollectionId, item) => { setCollections(current => current.map(collection => collection.collectionId === targetCollectionId ? { ...collection, items: [...collection.items, item] } : collection)); setCollectionId(targetCollectionId); setToast(locale === "zh" ? "自定义词汇已保存" : "Custom word saved"); }} />
  </Box></Box><Footer />
  <Dialog open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} fullWidth maxWidth="lg" slotProps={{ paper: { sx: { height: { xs: "92dvh", sm: "82dvh" }, borderRadius: { xs: 2, sm: 3 } } } }}>
    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, pr: 1 }}><MenuBookRoundedIcon color="primary" /><Box sx={{ flex: 1 }}><Typography component="span" variant="h6" sx={{ fontWeight: 700 }}>{locale === "zh" ? "词典" : "Dictionary"}</Typography>{exercise && <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>· {exercise.english}</Typography>}</Box><IconButton aria-label={locale === "zh" ? "关闭词典" : "Close dictionary"} onClick={() => setDictionaryOpen(false)}><CloseRoundedIcon /></IconButton></DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 }, bgcolor: "background.default" }}>{dictionaryOpen && exercise && <DictionaryLookup key={exercise.english} initialWord={exercise.english} embedded />}</DialogContent>
  </Dialog>
  <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{locale === "zh" ? `查找单词：${searchWord.trim()}` : `Search: ${searchWord.trim()}`}</DialogTitle><DialogContent dividers>{searchBusy ? <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress /></Box> : searchResults.length ? <Stack spacing={1.5}>{searchResults.map(item => <Box key={item.id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{item.english}</Typography>{item.phonetic && <Typography color="primary" sx={{ fontFamily: "serif" }}>{item.phonetic}</Typography>}<Typography color="text.secondary">{item.chinese}</Typography></Box>)}</Stack> : <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>{locale === "zh" ? "没有找到匹配的单词" : "No matching words found"}</Typography>}</DialogContent><DialogActions><Button onClick={() => setSearchOpen(false)}>{locale === "zh" ? "关闭" : "Close"}</Button></DialogActions></Dialog>
  <Dialog open={syncOpen} onClose={() => { if (!syncBusy) setSyncOpen(false); }} fullWidth maxWidth="xs"><DialogTitle>{copy.syncTitle}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="info">{copy.syncHint}</Alert>{syncError && <Alert severity="error">{syncError}</Alert>}<Typography>{datasets.find(item => item.id === dataset)?.name} · {copy[mode]}</Typography></Stack></DialogContent><DialogActions><Button disabled={syncBusy} startIcon={<CloudDownloadRoundedIcon />} onClick={() => void downloadProgress()}>{copy.downloadProgress}</Button><Button disabled={syncBusy || !exercise} variant="contained" startIcon={syncBusy ? <CircularProgress size={16} /> : <CloudUploadRoundedIcon />} onClick={() => void uploadProgress()}>{copy.uploadProgress}</Button></DialogActions></Dialog>
  <Dialog open={favoriteOpen} onClose={() => setFavoriteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{copy.favorite}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Autocomplete options={[...collections, { collectionId: "__new__", name: copy.newCollection, items: [] }]} value={collections.find(item => item.collectionId === collectionId) || null} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.collectionId === b.collectionId} onChange={(_e, value) => { if (value?.collectionId === "__new__") { setFavoriteOpen(false); setResumeFavoriteAfterCollectionCreate(true); setCollectionDialogOpen(true); } else setCollectionId(value?.collectionId || ""); }} renderInput={params => <TextField {...params} label={copy.chooseCollection} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: true, sx: { userSelect: "none", cursor: "pointer" } } }} />} /></Stack></DialogContent><DialogActions><Button onClick={() => setFavoriteOpen(false)}>Cancel</Button><Button variant="contained" disabled={!collectionId} onClick={() => void saveFavorite()}>{copy.favorite}</Button></DialogActions></Dialog>
  <CollectionDialog open={collectionDialogOpen} locale={locale} onClose={() => { setCollectionDialogOpen(false); setResumeFavoriteAfterCollectionCreate(false); }} onCreated={collection => { setCollections(current => [...current, collection]); setCollectionId(collection.collectionId); if (resumeFavoriteAfterCollectionCreate) setFavoriteOpen(true); }} />
  <Dialog open={collectionDeleteOpen} onClose={deletingCollection ? undefined : () => setCollectionDeleteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{locale === "zh" ? "删除收藏夹" : "Delete collection"}</DialogTitle><DialogContent><Alert severity="warning">{locale === "zh" ? `确定删除“${selectedCollection?.name || ""}”吗？其中的所有词条和练习进度都会被删除，此操作无法撤销。` : `Delete “${selectedCollection?.name || ""}”? All its words and practice progress will be permanently deleted.`}</Alert></DialogContent><DialogActions><Button disabled={deletingCollection} onClick={() => setCollectionDeleteOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button><Button color="error" variant="contained" disabled={deletingCollection || !selectedCollection} onClick={() => void deleteSelectedCollection()}>{deletingCollection ? <CircularProgress size={20} color="inherit" /> : (locale === "zh" ? "删除" : "Delete")}</Button></DialogActions></Dialog>
  <Snackbar open={Boolean(toast)} autoHideDuration={2200} onClose={() => setToast("")} message={toast} /></div>;
}

function SpellingSlots({ inputRef, word, hintIndexes, value, label, wrongFlash, correct, autoFilled, onChange, onSubmit, onForget }: { inputRef: RefObject<HTMLInputElement | null>; word: string; hintIndexes: number[]; value: string; label: string; wrongFlash: boolean; correct: boolean; autoFilled: boolean; onChange: (value: string) => void; onSubmit: () => void; onForget: () => void }) {
  const typedLetters = lettersOnly(value); const totalLetters = lettersOnly(word).length; const hinted = new Set(hintIndexes); let letterIndex = 0;
  return <Stack spacing={1}><Typography variant="caption" color="text.secondary">{label}</Typography><Box sx={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: ".08em", py: 1.5, cursor: correct ? "default" : "text", fontSize: 22 }}>
    {[...word].map((character, index) => { const isLetter = /[a-z]/i.test(character); if (!isLetter) return <Box component="span" aria-hidden key={index} sx={{ width: character === " " ? ".66em" : ".45em", overflow: "visible", whiteSpace: "pre", textAlign: "center", alignSelf: "end", color: correct ? "success.main" : character === " " ? "rgba(255,255,255,.45)" : "text.secondary", fontFamily: "monospace", fontSize: character === " " ? ".8em" : "1em", lineHeight: "36px" }}>{character === " " ? "␣" : character}</Box>; const currentLetter = letterIndex++; const isHinted = hinted.has(currentLetter); const entered = typedLetters[currentLetter] || ""; const wrongHint = isHinted && Boolean(entered) && entered !== character.toLocaleLowerCase(); const isCursor = !correct && currentLetter === typedLetters.length && typedLetters.length < totalLetters; const display = entered || (isHinted ? character : ""); return <Box key={index} sx={{ position: "relative", width: ".66em", height: 36, display: "grid", placeItems: "center", bgcolor: correct ? "rgba(46, 125, 50, .16)" : autoFilled ? "rgba(255, 193, 7, .28)" : "transparent", borderBottom: 2, borderColor: correct ? "success.main" : wrongFlash || wrongHint ? "error.main" : isHinted ? "primary.main" : "divider", color: correct ? "success.main" : wrongFlash || wrongHint ? "error.main" : isHinted ? "primary.main" : "text.primary", opacity: isHinted && !entered && !wrongFlash && !correct ? .45 : 1, animation: wrongFlash ? "wrongPulse .22s ease-in-out 3" : "none", "&::after": isCursor ? { content: "\"\"", position: "absolute", left: 0, right: 0, bottom: -2, height: 2, bgcolor: "primary.main", animation: "cursorBlink 1s steps(1,end) infinite" } : undefined, "@keyframes cursorBlink": { "0%,45%": { opacity: 1 }, "46%,100%": { opacity: 0 } }, "@keyframes wrongPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: .2 } }, fontFamily: "monospace", fontSize: "1em", fontWeight: 700 }}>{display}</Box>; })}
    <Box component="input" ref={inputRef} autoFocus readOnly={correct} aria-label={label} value={value} maxLength={word.length} onChange={(event) => onChange(wordInputOnly(event.currentTarget.value))} onKeyDown={(event) => { if (correct) { if (event.key === "Enter") { event.preventDefault(); onSubmit(); } return; } if (event.key === ";") { event.preventDefault(); onForget(); } else if (event.key === "Enter") { event.preventDefault(); onSubmit(); } }} sx={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: correct ? "default" : "text" }} />
  </Box></Stack>;
}
