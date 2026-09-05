"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, Snackbar, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import QuizRoundedIcon from "@mui/icons-material/QuizRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import Footer from "@components/ui/layout/Footer";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useI18n } from "@lib/i18n/app";
import { useSiteUrl } from "@lib/site-url";
import { getLlmModels, getLlmProfiles, LlmClient, type LlmModelProfile, type LlmProfile } from "@lib/llm";
import { useAuth } from "@lib/client-api/use-auth";
import { vocabularyDrillApi, type DrillMeaning, type VocabularyCollection } from "@lib/client-api";

type Mode = "phonetic" | "meaning" | "word";
interface Exercise { id: number; english: string; phonetic: string; chinese: string; hintIndexes: number[]; duplicateCount: number; meanings?: DrillMeaning[] }
interface Grade { isCorrect: boolean; feedback: string }
interface LocalProgress { order: number[]; index: number }

const PROGRESS_PREFIX = "vocabulary-practice-progress-v2:";
const DEFAULT_BUCKET_SIZE = 20;
const DEFAULT_REFILL_THRESHOLD = 6;
const WORD_INITIAL_BUCKET_SIZE = 5;
const WORD_BUCKET_SIZE = 10;
const WORD_REFILL_THRESHOLD = 3;
const WORD_WORKERS = 3;
const builtInDatasets = [{ id: "ncee", name: "NCEE · 全国高考词汇（3,796）" }];

const labels = {
  en: { title: "Vocabulary Practice", subtitle: "Practice vocabulary from selectable learning databases.", dataset: "Vocabulary database", phonetic: "Sound → word", meaning: "Meaning → word", word: "Word → meaning", autoSpeak: "Read each new word automatically", listen: "Listen again", answerWord: "Type the English word", answerRest: "Type the remaining letters", answerMeaning: "Meaning", check: "Check", checking: "Checking…", next: "Next question", reveal: "Show answer", reset: "Regenerate", progress: "Progress", correct: "Correct", wrong: "Incorrect", answer: "Answer", ambiguous: "This definition matches multiple entries", loadFailed: "Unable to load questions.", gradeFailed: "The AI did not complete the meaning check.", llmNeeded: "Configure an LLM provider and model in Settings to grade meanings.", settings: "Open Settings", model: "Model", source: "NCEE data: gaokao-vocab · MIT License · © 2025 Jimmy Xu", favorite: "Add to collection", chooseCollection: "Choose a collection", newCollection: "+ New…", collectionName: "Collection name", saved: "Saved to collection", cloudSaved: "Progress uploaded", sync: "Sync", syncTitle: "Manual progress sync", uploadProgress: "Upload local progress", downloadProgress: "Download cloud progress", syncHint: "Only the current database and practice mode are affected. Download replaces local progress.", noCloudProgress: "No cloud progress exists for this database and mode.", syncFailed: "Unable to sync progress." },
  zh: { title: "词汇练习", subtitle: "从可切换的学习词库中练习英语词汇。", dataset: "词汇数据库", phonetic: "根据音标写单词", meaning: "根据意思写单词", word: "根据单词写意思", autoSpeak: "新题自动朗读", listen: "再次朗读", answerWord: "输入英文单词", answerRest: "填写剩余字母", answerMeaning: "填写这个义项", check: "检查答案", checking: "正在批改…", next: "下一题", reveal: "查看答案", reset: "重新生成", progress: "当前进度", correct: "正确", wrong: "回答错误", answer: "参考答案", ambiguous: "该释义对应多个词条", loadFailed: "无法批量载入题目。", gradeFailed: "AI 未完成本次词义批改。", llmNeeded: "请先在设置中配置 LLM Provider 和 Model，才能批改中文释义。", settings: "打开设置", model: "模型", source: "NCEE 数据：gaokao-vocab · MIT License · © 2025 Jimmy Xu", favorite: "收藏到词汇表", chooseCollection: "选择收藏夹", newCollection: "+ 新建…", collectionName: "收藏夹名称", saved: "已收藏（云端保存）", cloudSaved: "本地进度已上传", sync: "同步", syncTitle: "手动同步进度", uploadProgress: "上传本地进度", downloadProgress: "下载云端进度", syncHint: "仅同步当前词库和练习模式；下载会覆盖本地进度。", noCloudProgress: "云端没有当前词库和模式的进度。", syncFailed: "进度同步失败。" },
};

function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " "); }
function lettersOnly(value: string) { return value.toLocaleLowerCase().replace(/[^a-z]/g, ""); }
function shuffled<T>(items: T[]) { const result = [...items]; for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; } return result; }
function isSameCatalog(order: number[], ids: number[]) { if (order.length !== ids.length) return false; const available = new Set(ids); return order.every(id => available.has(id)); }
function isCatalogOrder(order: number[], ids: number[]) { return order.length === ids.length && order.every((id, index) => id === ids[index]); }
function randomHintIndexes(word: string, firstMustBeInitial = false) { const count = lettersOnly(word).length; if (count <= 1) return []; const hintCount = count <= 6 ? 1 : 2; const indexes = Array.from({ length: count }, (_, index) => index).filter(index => !firstMustBeInitial || index !== 0); for (let index = indexes.length - 1; index > 0; index--) { const swap = Math.floor(Math.random() * (index + 1)); [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]]; } return [...(firstMustBeInitial ? [0] : []), ...indexes.slice(0, hintCount - (firstMustBeInitial ? 1 : 0))].sort((a, b) => a - b); }
function normalizeMeanings(value: unknown): DrillMeaning[] { let parsed = value; if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch { return []; } } if (!Array.isArray(parsed)) return []; return parsed.flatMap(item => { if (!item || typeof item !== "object") return []; const text = String((item as { text?: unknown }).text || "").trim(); const rawPart = String((item as { partOfSpeech?: unknown }).partOfSpeech || "other"); const allowed: DrillMeaning["partOfSpeech"][] = ["v", "adj", "adv", "n", "prep", "conj", "pron", "other"]; const partOfSpeech = allowed.includes(rawPart as DrillMeaning["partOfSpeech"]) ? rawPart as DrillMeaning["partOfSpeech"] : "other"; return text ? [{ text, partOfSpeech }] : []; }); }

function concurrentOrderedMap<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>, onProgress: (ready: R[]) => void) {
  const results: Array<R | undefined> = Array(items.length); let nextIndex = 0; let readyCount = 0; let resolveFirst!: (value: R) => void;
  const first = new Promise<R>(resolve => { resolveFirst = resolve; });
  const run = async () => { while (true) { const index = nextIndex++; if (index >= items.length) return; results[index] = await worker(items[index]); const previousReadyCount = readyCount; while (readyCount < results.length && results[readyCount] !== undefined) readyCount++; if (readyCount !== previousReadyCount) { const ready = results.slice(0, readyCount) as R[]; if (previousReadyCount === 0) resolveFirst(ready[0]); onProgress(ready); } } };
  const done = items.length ? Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)).then(() => results as R[]) : Promise.resolve([] as R[]);
  return { first, done };
}

export default function NceeVocabularyClient() {
  const { locale } = useI18n(); const copy = labels[locale]; const settingsUrl = useSiteUrl("main", "/settings"); const { status, user } = useAuth(); useDocumentTitle(copy.title);
  const [dataset, setDataset] = useState("ncee"); const [mode, setMode] = useState<Mode>("phonetic"); const [exercise, setExercise] = useState<Exercise | null>(null); const [answer, setAnswer] = useState("");
  const [meaningAnswers, setMeaningAnswers] = useState<string[]>([]); const [collections, setCollections] = useState<VocabularyCollection[]>([]); const [favoriteOpen, setFavoriteOpen] = useState(false); const [collectionId, setCollectionId] = useState(""); const [newCollectionName, setNewCollectionName] = useState(""); const [toast, setToast] = useState("");
  const [syncOpen, setSyncOpen] = useState(false); const [syncBusy, setSyncBusy] = useState(false); const [syncError, setSyncError] = useState("");
  const [searchWord, setSearchWord] = useState("");
  const [searchOpen, setSearchOpen] = useState(false); const [searchBusy, setSearchBusy] = useState(false); const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [autoSpeak, setAutoSpeak] = useState(true);
  const [firstLetterHint, setFirstLetterHint] = useState(false);
  const [phoneticRevealed, setPhoneticRevealed] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false); const [forgotten, setForgotten] = useState(false);
  const [position, setPosition] = useState(0); const [total, setTotal] = useState(0); const [bucketRemaining, setBucketRemaining] = useState(0); const [tokenUsage, setTokenUsage] = useState(0);
  const bucketRef = useRef<Exercise[]>([]); const pendingBucketRef = useRef<Promise<Exercise[]> | null>(null); const refillInFlightRef = useRef(false); const progressRef = useRef<LocalProgress | null>(null); const loadingRef = useRef(false); const loadSequenceRef = useRef(0); const collectionsRef = useRef<VocabularyCollection[]>([]);
  const [models, setModels] = useState<LlmModelProfile[]>([]); const [providers, setProviders] = useState<LlmProfile[]>([]); const [modelId, setModelId] = useState("");
  const selected = models.find((item) => item.id === modelId); const provider = providers.find((item) => item.id === selected?.providerId);
  const datasets = [...builtInDatasets, ...collections.map(item => ({ id: `collection:${item.collectionId}`, name: `★ ${item.name} (${item.items.length})` }))];
  const bucketCapacity = mode === "word" ? WORD_BUCKET_SIZE : DEFAULT_BUCKET_SIZE; const refillThreshold = mode === "word" ? WORD_REFILL_THRESHOLD : DEFAULT_REFILL_THRESHOLD;

  useEffect(() => { const timer = window.setTimeout(() => { const available = getLlmModels().filter((item) => item.id && item.providerId && item.modelId.trim()); setModels(available); setProviders(getLlmProfiles()); setModelId(available[0]?.id || ""); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { collectionsRef.current = collections; }, [collections]);
  useEffect(() => { if (status === "authenticated" && user?.status === 1) void vocabularyDrillApi.userData().then(data => { const normalized = data.collections.map(collection => ({ ...collection, items: collection.items.map(item => ({ ...item, sourceWordId: Number(item.sourceWordId), meanings: normalizeMeanings(item.meanings) })) })); setCollections(normalized); setCollectionId(normalized[0]?.collectionId || ""); }).catch(() => undefined); }, [status, user?.status, user?.userId]);
  const speak = useCallback((word: string) => { if (!("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(word); utterance.lang = "en-US"; utterance.rate = .85; window.speechSynthesis.speak(utterance); }, []);
  const fetchWords = useCallback(async (targetDataset: string, targetMode: Mode, ids: number[]) => { if (!ids.length) return []; if (targetDataset.startsWith("collection:")) { const collection = collectionsRef.current.find(item => targetDataset === `collection:${item.collectionId}`); if (!collection) throw new Error("collection_not_found"); const byId = new Map(collection.items.map(item => [Number(item.sourceWordId), item])); return ids.flatMap(rawId => { const id = Number(rawId); const item = byId.get(id); if (!item) return []; return [{ id, english: item.word, phonetic: item.phonetic, chinese: item.meanings.map(m => m.text).join("；"), hintIndexes: randomHintIndexes(item.word, firstLetterHint), duplicateCount: 1, meanings: item.meanings }]; }); } const response = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&ids=${ids.join(",")}`, { cache: "no-store" }); if (!response.ok) throw new Error(); const words = (await response.json()).words as Exercise[]; return firstLetterHint ? words.map(word => ({ ...word, hintIndexes: randomHintIndexes(word.english, true) })) : words; }, [firstLetterHint]);
  const enrichWord = useCallback(async (word: Exercise) => {
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
  const loadMode = useCallback(async (targetDataset: string, targetMode: Mode, reset = false) => { const sequence = ++loadSequenceRef.current; loadingRef.current = true; pendingBucketRef.current = null; refillInFlightRef.current = false; setLoading(true); setExercise(null); setPosition(0); setTotal(0); setBucketRemaining(0); setError(""); setGrade(null); setPhoneticRevealed(false); setForgotten(false); setWrongFlash(false); setAnswer(""); setMeaningAnswers([]); try {
    const key = `${PROGRESS_PREFIX}${targetDataset}:${targetMode}`; let progress: LocalProgress | null = null;
    if (!reset) { try { const stored = JSON.parse(localStorage.getItem(key) || "null"); if (Array.isArray(stored?.order) && stored.order.length && Number.isInteger(stored.index)) progress = stored; } catch { /* ignore corrupt local progress */ } }
    let ids: number[]; if (targetDataset.startsWith("collection:")) { const collection = collectionsRef.current.find(item => targetDataset === `collection:${item.collectionId}`); if (!collection) throw new Error("collection_not_found"); ids = collection.items.map(item => Number(item.sourceWordId)); } else { const catalogResponse = await fetch(`/api/vocabulary-drill?dataset=${targetDataset}&mode=${targetMode}&catalog=1`, { cache: "no-store" }); if (!catalogResponse.ok) throw new Error(); ids = (await catalogResponse.json()).ids.map(Number); }
    if (!ids.length) throw new Error("empty_dataset");
    const savedProgress = !reset && progress && isSameCatalog(progress.order, ids) ? progress : null;
    const savedIndex = savedProgress ? Math.min(Math.max(savedProgress.index, 0), ids.length - 1) : 0;
    progress = savedProgress
      ? { order: isCatalogOrder(savedProgress.order, ids) ? [...ids.slice(0, savedIndex), ...shuffled(ids.slice(savedIndex))] : savedProgress.order, index: savedIndex }
      : { order: shuffled(ids), index: 0 };
    localStorage.setItem(key, JSON.stringify(progress));
    progressRef.current = progress; setPosition(progress.index + 1); setTotal(progress.order.length); const initialSize = targetMode === "word" ? WORD_INITIAL_BUCKET_SIZE : DEFAULT_BUCKET_SIZE; const fetched = await fetchWords(targetDataset, targetMode, progress.order.slice(progress.index, progress.index + initialSize)); if (!fetched.length) throw new Error("words_not_found"); if (sequence !== loadSequenceRef.current) return;
    if (targetMode === "word") { let shown = false; const queue = concurrentOrderedMap(fetched, WORD_WORKERS, enrichWord, ready => { if (sequence !== loadSequenceRef.current) return; bucketRef.current = ready; setBucketRemaining(ready.length); if (!shown) { shown = true; setExercise(ready[0]); setMeaningAnswers(Array(ready[0]?.meanings?.length || 1).fill("")); setLoading(false); loadingRef.current = false; } }); pendingBucketRef.current = queue.done; await queue.first; void queue.done.then(words => { if (sequence === loadSequenceRef.current) { bucketRef.current = words; pendingBucketRef.current = null; setBucketRemaining(words.length); } }); }
    else { bucketRef.current = fetched; setExercise(fetched[0] || null); setMeaningAnswers(Array(fetched[0]?.meanings?.length || 1).fill("")); setBucketRemaining(fetched.length); }
  } catch { if (sequence === loadSequenceRef.current) { bucketRef.current = []; progressRef.current = null; setExercise(null); setError(copy.loadFailed); } } finally { if (sequence === loadSequenceRef.current) { loadingRef.current = false; setLoading(false); } } }, [copy.loadFailed, enrichWord, fetchWords]);
  const nextQuestion = useCallback(async () => { const progress = progressRef.current; if (!progress || loadingRef.current) return; if (pendingBucketRef.current) { setExercise(null); setLoading(true); bucketRef.current = await pendingBucketRef.current; pendingBucketRef.current = null; setLoading(false); } setGrade(null); setPhoneticRevealed(false); setForgotten(false); setWrongFlash(false); setAnswer(""); progress.index++;
    if (progress.index >= progress.order.length) { await loadMode(dataset, mode, true); return; }
    localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress)); const remaining = bucketRef.current.slice(1); bucketRef.current = remaining; setBucketRemaining(remaining.length); setExercise(remaining[0] || null); setMeaningAnswers(Array(remaining[0]?.meanings?.length || 1).fill("")); setPosition(progress.index + 1);
    const refillThreshold = mode === "word" ? WORD_REFILL_THRESHOLD : DEFAULT_REFILL_THRESHOLD; const refillTarget = mode === "word" ? WORD_BUCKET_SIZE : DEFAULT_BUCKET_SIZE;
    if (remaining.length < refillThreshold && !refillInFlightRef.current) { refillInFlightRef.current = true; const sequence = loadSequenceRef.current; if (!remaining.length) { loadingRef.current = true; setLoading(true); } try { const start = progress.index + remaining.length; const ids = progress.order.slice(start, progress.index + refillTarget); const fetched = await fetchWords(dataset, mode, ids); if (mode === "word") { let appended = 0; const queue = concurrentOrderedMap(fetched, WORD_WORKERS, enrichWord, ready => { if (sequence !== loadSequenceRef.current) return; const additions = ready.slice(appended); appended = ready.length; bucketRef.current = [...bucketRef.current, ...additions]; setBucketRemaining(bucketRef.current.length); if (!remaining.length && bucketRef.current.length) { setExercise(bucketRef.current[0]); setMeaningAnswers(Array(bucketRef.current[0]?.meanings?.length || 1).fill("")); setLoading(false); loadingRef.current = false; } }); void queue.done.catch(() => { if (sequence === loadSequenceRef.current) setError(copy.loadFailed); }).finally(() => { if (sequence === loadSequenceRef.current) refillInFlightRef.current = false; }); }
      else if (sequence === loadSequenceRef.current) { bucketRef.current = [...bucketRef.current, ...fetched]; setBucketRemaining(bucketRef.current.length); refillInFlightRef.current = false; if (!remaining.length) { setExercise(fetched[0] || null); setLoading(false); loadingRef.current = false; } }
    } catch { if (sequence === loadSequenceRef.current) { refillInFlightRef.current = false; setError(copy.loadFailed); setLoading(false); loadingRef.current = false; } } }
  }, [copy.loadFailed, dataset, enrichWord, fetchWords, loadMode, mode]);
  useEffect(() => { const timer = window.setTimeout(() => void loadMode(dataset, mode), 0); return () => window.clearTimeout(timer); }, [dataset, loadMode, mode]);
  useEffect(() => { if (mode === "phonetic" && exercise && autoSpeak) speak(exercise.english); }, [autoSpeak, exercise, mode, speak]);

  const previousQuestion = useCallback(async () => { const progress = progressRef.current; if (!progress || progress.index <= 0 || loadingRef.current) return; progress.index--; localStorage.setItem(`${PROGRESS_PREFIX}${dataset}:${mode}`, JSON.stringify(progress)); await loadMode(dataset, mode); }, [dataset, loadMode, mode]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.repeat) return;
      const key = event.key.toLocaleLowerCase();
      if (key !== "f" && key !== "j") return;
      event.preventDefault();
      if (key === "f" && position > 1 && !loading) void previousQuestion();
      if (key === "j" && position < total && !loading) void nextQuestion();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [loading, nextQuestion, position, previousQuestion, total]);

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
    const submittedMeanings = meaningAnswers.map(value => value.trim()).filter(Boolean);
    if (!exercise || (mode === "word" ? !submittedMeanings.length : !answer.trim())) return;
    if (mode !== "word") { const isCorrect = mode === "meaning" ? lettersOnly(answer) === lettersOnly(exercise.english) : normalize(answer) === normalize(exercise.english); if (isCorrect) await nextQuestion(); else { setWrongFlash(false); window.requestAnimationFrame(() => { setWrongFlash(true); window.setTimeout(() => setWrongFlash(false), 650); }); } return; }
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
      if (completed.isCorrect) { setLoading(false); await nextQuestion(); } else { setGrade(null); setWrongFlash(false); window.requestAnimationFrame(() => { setWrongFlash(true); window.setTimeout(() => setWrongFlash(false), 650); }); }
    } catch { setError(copy.gradeFailed); } finally { setLoading(false); }
  }

  async function saveFavorite() {
    if (!exercise) return; let target = collectionId === "__new__" ? "" : collectionId;
    try { if (!target && newCollectionName.trim()) { const created = await vocabularyDrillApi.createCollection(newCollectionName.trim()); setCollections(items => [...items, created.collection]); target = created.collection.collectionId; setCollectionId(target); }
      if (!target) return; setFavoriteOpen(false); void vocabularyDrillApi.addItem({ collectionId: target, dataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, meanings: exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" }] }).then(() => setToast(copy.saved)).catch(() => undefined);
    } catch { /* dialog remains usable after a failed collection creation */ }
  }

  async function forgetAnswer() {
    if (!exercise || loading) return; setForgotten(true); setGrade(null); if (mode === "word") setMeaningAnswers((exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]).map(meaning => meaning.text)); else setAnswer(exercise.english);
    if (status !== "authenticated" || user?.status !== 1) return;
    try { let target = collections.find(item => item.name.toLocaleLowerCase() === "default"); if (!target) { const created = await vocabularyDrillApi.createCollection("default"); target = created.collection; setCollections(current => [...current, created.collection]); }
      const meanings = exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]; await vocabularyDrillApi.addItem({ collectionId: target.collectionId, dataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, meanings }); setCollections(current => current.map(collection => collection.collectionId !== target.collectionId || collection.items.some(item => Number(item.sourceWordId) === exercise.id) ? collection : { ...collection, items: [...collection.items, { dataset, sourceWordId: exercise.id, word: exercise.english, phonetic: exercise.phonetic, meanings }] })); setToast(locale === "zh" ? "答案已显示，并已收藏到 default" : "Answer shown and saved to default");
    } catch { setToast(locale === "zh" ? "答案已显示，但收藏失败" : "Answer shown, but it could not be saved"); }
  }

  async function deleteFromCollection() {
    if (!exercise || !dataset.startsWith("collection:") || deleting) return; const collection = collections.find(item => dataset === `collection:${item.collectionId}`); if (!collection) return; setDeleting(true);
    try { await vocabularyDrillApi.deleteItem(collection.collectionId, exercise.id); const isLast = collection.items.length <= 1; setCollections(current => current.map(item => item.collectionId === collection.collectionId ? { ...item, items: item.items.filter(word => Number(word.sourceWordId) !== exercise.id) } : item)); setToast(locale === "zh" ? "已从收藏夹删除" : "Removed from collection"); if (isLast) setDataset("ncee"); }
    catch { setToast(locale === "zh" ? "删除失败" : "Unable to remove word"); } finally { setDeleting(false); }
  }

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
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3 }}><QuizRoundedIcon color="primary" sx={{ fontSize: 40 }} /><Box><Typography variant="h4" sx={{ fontWeight: 750 }}>{copy.title}</Typography><Typography color="text.secondary">{copy.subtitle}</Typography></Box></Stack>
    <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={2.25}><Autocomplete size="small" options={datasets} value={datasets.find((item) => item.id === dataset) || builtInDatasets[0]} disableClearable getOptionLabel={(item) => item.name} onChange={(_event, value) => setDataset(value.id)} renderInput={(params) => <TextField {...params} label={copy.dataset} />} /></Stack></CardContent><Tabs value={mode} onChange={(_event, value: Mode) => setMode(value)} variant="fullWidth"><Tab value="phonetic" label={copy.phonetic} /><Tab value="meaning" label={copy.meaning} /><Tab value="word" label={copy.word} /></Tabs><CardContent><Stack spacing={2.25}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">{copy.progress}：{position} / {total || "…"}</Typography><LinearProgress variant={total ? "determinate" : "indeterminate"} value={total ? position / total * 100 : undefined} sx={{ mt: .5 }} /><Stack direction="row" spacing={1.5} sx={{ mt: .5 }}><Typography variant="caption" color="text.secondary">{locale === "zh" ? "桶剩余" : "Bucket"}: {bucketRemaining} / {bucketCapacity} · {locale === "zh" ? "补充阈值" : "Refill threshold"}: {refillThreshold}</Typography>{mode === "word" && <Typography variant="caption" color="text.secondary">Tokens: {tokenUsage}</Typography>}</Stack></Box><Button size="small" startIcon={<SyncRoundedIcon />} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => { setSyncError(""); setSyncOpen(true); }}>{copy.sync}</Button><Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => void loadMode(dataset, mode, true)}>{copy.reset}</Button></Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Tooltip title={locale === "zh" ? "自动后退（Ctrl + F）" : "Previous (Ctrl + F)"} arrow><span><IconButton aria-label={locale === "zh" ? "自动后退" : "Previous"} disabled={loading || position <= 1} onClick={() => void previousQuestion()}><ChevronLeftRoundedIcon /></IconButton></span></Tooltip><TextField fullWidth size="small" label={locale === "zh" ? "查找英文单词" : "Find an English word"} value={searchWord} onChange={event => setSearchWord(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void findWord(); } }} slotProps={{ input: { endAdornment: <IconButton edge="end" onClick={() => void findWord()}><SearchRoundedIcon /></IconButton> } }} /><Tooltip title={locale === "zh" ? "自动前进（Ctrl + J）" : "Next (Ctrl + J)"} arrow><span><IconButton aria-label={locale === "zh" ? "自动前进" : copy.next} disabled={loading || position >= total} onClick={() => void nextQuestion()}><NavigateNextRoundedIcon /></IconButton></span></Tooltip></Stack>
      {mode === "phonetic" && <FormControlLabel control={<Switch checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />} label={copy.autoSpeak} />}
      {mode === "meaning" && <FormControlLabel control={<Switch checked={firstLetterHint} onChange={(event) => setFirstLetterHint(event.target.checked)} />} label={locale === "zh" ? "首个提示固定为首字母" : "Always hint the first letter first"} />}
      {mode === "word" && models.length > 0 && <Autocomplete size="small" options={models} value={selected} disableClearable getOptionLabel={(item) => item.name || item.modelId} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_e, value) => setModelId(value.id)} renderInput={(params) => <TextField {...params} label={copy.model} />} />}
      {mode === "word" && (!selected || !provider) && <Alert severity="info" action={<Button component={Link} href={settingsUrl}>{copy.settings}</Button>}>{copy.llmNeeded}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {loading && !exercise ? <Box sx={{ display: "grid", placeItems: "center", py: 7 }}><CircularProgress /></Box> : exercise && <>
        <Box sx={{ minHeight: 120, display: "grid", placeItems: "center", textAlign: "center", py: 2, position: "relative" }}><Stack direction="row" sx={{ position: "absolute", right: 0, top: 0 }}>{dataset.startsWith("collection:") && <IconButton color="error" title={locale === "zh" ? "从收藏夹删除" : "Remove from collection"} disabled={deleting} onClick={() => void deleteFromCollection()}>{deleting ? <CircularProgress size={20} /> : <DeleteOutlineRoundedIcon />}</IconButton>}<IconButton title={copy.favorite} disabled={status !== "authenticated" || user?.status !== 1} onClick={() => setFavoriteOpen(true)}><BookmarkAddRoundedIcon /></IconButton></Stack>
          {mode === "phonetic" && <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography variant="h3" sx={{ fontFamily: "serif" }}>{exercise.phonetic}</Typography><IconButton aria-label={copy.listen} title={copy.listen} onClick={() => speak(exercise.english)}><CampaignRoundedIcon /></IconButton></Stack>}
          {mode === "meaning" && <Stack spacing={1} sx={{ alignItems: "center" }}><Typography variant="h5" sx={{ fontWeight: 650 }}>{exercise.chinese}</Typography>{exercise.duplicateCount > 1 && <Chip variant="outlined" label={`${copy.ambiguous} (${exercise.duplicateCount})`} />}{phoneticRevealed && <Typography variant="h6" color="primary" sx={{ fontFamily: "serif" }}>{exercise.phonetic}</Typography>}<Button size="small" variant="outlined" startIcon={<CampaignRoundedIcon />} onClick={() => { setPhoneticRevealed(true); speak(exercise.english); }}>{locale === "zh" ? "显示音标并朗读" : "Show pronunciation and speak"}</Button></Stack>}
          {mode === "word" && <Stack spacing={1} sx={{ alignItems: "center" }}><Typography variant="h3" color={wrongFlash ? "error" : "primary"} sx={{ fontWeight: 750, animation: wrongFlash ? "wrongPulse .22s ease-in-out 3" : "none", "@keyframes wrongPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: .2 } } }}>{exercise.english}</Typography><Stack direction="row" spacing={.5}>{(exercise.meanings || []).map((meaning, index) => <Chip key={index} size="small" label={meaning.partOfSpeech} />)}</Stack></Stack>}
        </Box>
        {mode === "meaning" ? <SpellingSlots word={exercise.english} hintIndexes={exercise.hintIndexes} value={answer} label={copy.answerWord} wrongFlash={wrongFlash} autoFilled={forgotten} onChange={setAnswer} onSubmit={() => void checkAnswer()} onForget={() => void forgetAnswer()} /> : mode === "word" ? <Stack spacing={1}>{(exercise.meanings || [{ text: exercise.chinese, partOfSpeech: "other" as const }]).map((meaning, index) => <TextField key={index} autoFocus={index === 0} multiline minRows={2} label={`${meaning.partOfSpeech} · ${copy.answerMeaning} ${index + 1}`} value={meaningAnswers[index] || ""} onChange={event => setMeaningAnswers(values => { const next = [...values]; next[index] = event.target.value; return next; })} onKeyDown={event => { if (event.key === ";") { event.preventDefault(); void forgetAnswer(); } }} sx={forgotten ? { bgcolor: "rgba(255, 193, 7, .18)" } : undefined} />)}</Stack> : <TextField autoFocus label={copy.answerWord} value={answer} error={wrongFlash} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === ";") { event.preventDefault(); void forgetAnswer(); } else if (event.key === "Enter") { event.preventDefault(); void checkAnswer(); } }} sx={forgotten ? { bgcolor: "rgba(255, 193, 7, .18)" } : undefined} />}
        <Button variant="text" disabled={loading || forgotten} onClick={() => void forgetAnswer()}>{locale === "zh" ? "忘记了" : "Forgot"}<Box component="kbd" sx={{ minWidth: 22, height: 22, ml: .75, px: .6, display: "inline-grid", placeItems: "center", border: "1px solid #808080", borderRadius: 1, bgcolor: "background.paper", color: "inherit", boxShadow: "0 2px 0 rgba(0,0,0,.35)", fontFamily: "monospace", fontSize: 13, lineHeight: 1 }}>;</Box></Button>
        {forgotten ? <Button size="large" variant="contained" endIcon={<NavigateNextRoundedIcon />} onClick={() => void nextQuestion()}>{copy.next}</Button> : !grade ? <Button size="large" variant="contained" disabled={loading || (mode === "word" ? !meaningAnswers.some(value => value.trim()) || !selected || !provider : !answer.trim())} onClick={() => void checkAnswer()}>{loading ? copy.checking : copy.check}</Button> : <><Alert severity="warning">{grade.feedback}</Alert><Button size="large" variant="contained" endIcon={<NavigateNextRoundedIcon />} onClick={() => void nextQuestion()}>{copy.next}</Button></>}
      </>}
      <Typography component="a" href="https://github.com/Jimmy-xuzimo/gaokao-vocab" target="_blank" rel="noreferrer" variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>{copy.source}</Typography>
    </Stack></CardContent></Card>
  </Box></Box><Footer /><Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{locale === "zh" ? `查找单词：${searchWord.trim()}` : `Search: ${searchWord.trim()}`}</DialogTitle><DialogContent dividers>{searchBusy ? <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress /></Box> : searchResults.length ? <Stack spacing={1.5}>{searchResults.map(item => <Box key={item.id} sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{item.english}</Typography>{item.phonetic && <Typography color="primary" sx={{ fontFamily: "serif" }}>{item.phonetic}</Typography>}<Typography color="text.secondary">{item.chinese}</Typography></Box>)}</Stack> : <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>{locale === "zh" ? "没有找到匹配的单词" : "No matching words found"}</Typography>}</DialogContent><DialogActions><Button onClick={() => setSearchOpen(false)}>{locale === "zh" ? "关闭" : "Close"}</Button></DialogActions></Dialog><Dialog open={syncOpen} onClose={() => { if (!syncBusy) setSyncOpen(false); }} fullWidth maxWidth="xs"><DialogTitle>{copy.syncTitle}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Alert severity="info">{copy.syncHint}</Alert>{syncError && <Alert severity="error">{syncError}</Alert>}<Typography>{datasets.find(item => item.id === dataset)?.name} · {copy[mode]}</Typography></Stack></DialogContent><DialogActions><Button disabled={syncBusy} startIcon={<CloudDownloadRoundedIcon />} onClick={() => void downloadProgress()}>{copy.downloadProgress}</Button><Button disabled={syncBusy || !exercise} variant="contained" startIcon={syncBusy ? <CircularProgress size={16} /> : <CloudUploadRoundedIcon />} onClick={() => void uploadProgress()}>{copy.uploadProgress}</Button></DialogActions></Dialog><Dialog open={favoriteOpen} onClose={() => setFavoriteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{copy.favorite}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Autocomplete options={[...collections, { collectionId: "__new__", name: copy.newCollection, items: [] }]} value={collectionId === "__new__" ? { collectionId: "__new__", name: copy.newCollection, items: [] } : collections.find(item => item.collectionId === collectionId) || null} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.collectionId === b.collectionId} onChange={(_e, value) => { setCollectionId(value?.collectionId || ""); if (value?.collectionId !== "__new__") setNewCollectionName(""); }} renderInput={params => <TextField {...params} label={copy.chooseCollection} />} />{collectionId === "__new__" && <TextField autoFocus label={copy.collectionName} value={newCollectionName} onChange={event => setNewCollectionName(event.target.value)} />}</Stack></DialogContent><DialogActions><Button onClick={() => setFavoriteOpen(false)}>Cancel</Button><Button variant="contained" disabled={!collectionId || (collectionId === "__new__" && !newCollectionName.trim())} onClick={() => void saveFavorite()}>{copy.favorite}</Button></DialogActions></Dialog><Snackbar open={Boolean(toast)} autoHideDuration={2200} onClose={() => setToast("")} message={toast} /></div>;
}

function SpellingSlots({ word, hintIndexes, value, label, wrongFlash, autoFilled, onChange, onSubmit, onForget }: { word: string; hintIndexes: number[]; value: string; label: string; wrongFlash: boolean; autoFilled: boolean; onChange: (value: string) => void; onSubmit: () => void; onForget: () => void }) {
  const typedLetters = lettersOnly(value); const totalLetters = lettersOnly(word).length; const hinted = new Set(hintIndexes); let letterIndex = 0;
  return <Stack spacing={1}><Typography variant="caption" color="text.secondary">{label}</Typography><Box sx={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: ".08em", py: 1.5, cursor: "text", fontSize: 22 }}>
    {[...word].map((character, index) => { const isLetter = /[a-z]/i.test(character); if (!isLetter) return <Box component="span" aria-hidden key={index} sx={{ width: character === " " ? ".66em" : ".45em", overflow: "visible", whiteSpace: "pre", textAlign: "center", alignSelf: "end", color: character === " " ? "rgba(255,255,255,.45)" : "text.secondary", fontFamily: "monospace", fontSize: character === " " ? ".8em" : "1em", lineHeight: "36px" }}>{character === " " ? "␣" : character}</Box>; const currentLetter = letterIndex++; const isHinted = hinted.has(currentLetter); const entered = typedLetters[currentLetter] || ""; const wrongHint = isHinted && Boolean(entered) && entered !== character.toLocaleLowerCase(); const isCursor = currentLetter === typedLetters.length && typedLetters.length < totalLetters; const display = entered || (isHinted ? character : ""); return <Box key={index} sx={{ position: "relative", width: ".66em", height: 36, display: "grid", placeItems: "center", bgcolor: autoFilled ? "rgba(255, 193, 7, .28)" : "transparent", borderBottom: 2, borderColor: wrongFlash || wrongHint ? "error.main" : isHinted ? "primary.main" : "divider", color: wrongFlash || wrongHint ? "error.main" : isHinted ? "primary.main" : "text.primary", opacity: isHinted && !entered && !wrongFlash ? .45 : 1, animation: wrongFlash ? "wrongPulse .22s ease-in-out 3" : "none", "&::after": isCursor ? { content: "\"\"", position: "absolute", left: 0, right: 0, bottom: -2, height: 2, bgcolor: "primary.main", animation: "cursorBlink 1s steps(1,end) infinite" } : undefined, "@keyframes cursorBlink": { "0%,45%": { opacity: 1 }, "46%,100%": { opacity: 0 } }, "@keyframes wrongPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: .2 } }, fontFamily: "monospace", fontSize: "1em", fontWeight: 700 }}>{display}</Box>; })}
    <Box component="input" autoFocus aria-label={label} value={value} maxLength={totalLetters} onChange={(event) => onChange(lettersOnly(event.currentTarget.value))} onKeyDown={(event) => { if (event.key === ";") { event.preventDefault(); onForget(); } else if (event.key === "Enter") { event.preventDefault(); onSubmit(); } }} sx={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "text" }} />
  </Box></Stack>;
}
