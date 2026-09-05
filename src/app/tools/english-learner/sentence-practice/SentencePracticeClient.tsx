"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import Footer from "@components/ui/layout/Footer";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useSiteUrl } from "@lib/site-url";
import { useAuth } from "@lib/client-api/use-auth";
import { ApiError, vocabularyPracticeApi, type VocabularyUsage } from "@lib/client-api";
import { getLlmModels, getLlmProfiles, LlmClient, type LlmModelProfile, type LlmProfile } from "@lib/llm";
import { useI18n } from "@lib/i18n/app";

interface Exercise { usageId: string; word: string; prompt: string; instruction: string; exampleSentence: string }
interface Grade { isCorrect: boolean; feedback: string; correctedSentence: string | null }

const copyByLocale = {
  en: {
    title: "Vocabulary Sentence Practice", subtitle: "Learn each meaning through AI-guided sentence writing.", login: "Sign in to use sentence practice.", signIn: "Sign in", verify: "Verify your email before using sentence practice.", llm: "Configure an LLM Provider and Model in Settings first.", settings: "Open Settings", empty: "Add at least one word usage in User Data to start practicing.", manage: "Manage vocabulary in User Data", generate: "Generate exercise", generating: "Selecting and generating…", answer: "Write your sentence", submit: "Check sentence", checking: "Checking…", example: "Example", correct: "Correct", wrong: "Needs work", corrected: "Suggested sentence", loadFailed: "Unable to load vocabulary.", aiFailed: "The AI did not complete the required tool workflow.", gradeFailed: "The AI could not grade this attempt.", saveGradeFailed: "Grading succeeded, but the attempt could not be saved.", model: "Model",
  },
  zh: {
    title: "单词造句练习", subtitle: "针对每一种词汇用法进行 AI 造句训练。", login: "登录后才能使用单词造句练习。", signIn: "去登录", verify: "请先验证邮箱再使用造句练习。", llm: "请先在设置中配置 LLM Provider 和 Model。", settings: "打开设置", empty: "请先在 User Data 中添加至少一个单词用法。", manage: "前往 User Data 管理词汇", generate: "生成题目", generating: "正在选择并出题…", answer: "写下你的英文句子", submit: "提交判题", checking: "正在判题…", example: "例句", correct: "正确", wrong: "需要修改", corrected: "建议句子", loadFailed: "无法加载词汇。", aiFailed: "AI 未完成要求的工具流程。", gradeFailed: "AI 无法完成本次判题。", saveGradeFailed: "判题已完成，但本次记录保存失败。", model: "模型",
  },
};

export default function SentencePracticeClient() {
  const { locale } = useI18n(); const copy = copyByLocale[locale]; const { status, isAuthenticated, user } = useAuth(); useDocumentTitle(copy.title);
  const settingsUrl = useSiteUrl("main", "/settings");
  const [usages, setUsages] = useState<VocabularyUsage[]>([]); const [models, setModels] = useState<LlmModelProfile[]>([]); const [providers, setProviders] = useState<LlmProfile[]>([]); const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [exercise, setExercise] = useState<Exercise | null>(null); const [answer, setAnswer] = useState(""); const [grade, setGrade] = useState<Grade | null>(null);
  const selected = models.find((item) => item.id === modelId); const provider = providers.find((item) => item.id === selected?.providerId);

  useEffect(() => { const timer = window.setTimeout(() => { const available = getLlmModels().filter((item) => item.id && item.providerId && item.modelId.trim()); setModels(available); setProviders(getLlmProfiles()); setModelId(available[0]?.id || ""); }, 0); return () => window.clearTimeout(timer); }, []);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setUsages((await vocabularyPracticeApi.list()).usages); } catch { setError(copy.loadFailed); } finally { setLoading(false); } }, [copy.loadFailed]);
  useEffect(() => { if (status === "authenticated" && user?.status === 1) { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); } }, [load, status, user?.status, user?.userId]);

  async function generateExercise() {
    if (!selected || !provider || !usages.length) return; setBusy(true); setError(""); setExercise(null); setGrade(null); setAnswer("");
    let candidateIds: string[] = []; let reviewedUsageId = ""; let reviewedAttempts: Array<{ question: string; exampleSentence: string }> = []; let generated: Exercise | null = null;
    const expected = Math.min(5, usages.length);
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 5 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: `Choose the best vocabulary practice now from this JSON data:\n${JSON.stringify(usages)}` }],
        systemPrompt: `You create English sentence-writing exercises. Follow this exact tool order:\n1. Call select_candidates with exactly ${expected} distinct usage IDs, prioritizing never/long-ago practiced items, low recent accuracy, and varied words.\n2. Choose one candidate, then MUST call review_recent_attempts before creating a question. Carefully inspect the five most recent exercises across every meaning of that word, including questions, examples, answers, and feedback.\n3. Call create_exercise for that same reviewed usage. Its instruction MUST be written in Simplified Chinese and ask the learner to write an English sentence. Use a meaningfully different situation from every recent attempt; never repeat or lightly paraphrase a previous question or example. The internal example_sentence must demonstrate the requested meaning but must describe a different situation from the instruction, because it will not be shown to the learner.`,
        maxTokens: 2048, temperature: .4,
        isComplete: () => generated !== null, incompletePrompt: "Please complete the required tool calls.", maxIncompleteRetries: 2,
        tools: [
          { name: "select_candidates", description: `Select exactly ${expected} best items for the learner to review.`, parameters: { type: "object", properties: { usage_ids: { type: "array", items: { type: "string" }, minItems: expected, maxItems: expected } }, required: ["usage_ids"], additionalProperties: false }, execute: (args) => { const ids = Array.isArray(args.usage_ids) ? args.usage_ids.map(String) : []; if (ids.length !== expected || new Set(ids).size !== expected || ids.some((id) => !usages.some((item) => item.usageId === id))) throw new Error("Invalid candidate selection"); candidateIds = ids; return { candidates: usages.filter((item) => ids.includes(item.usageId)) }; } },
          { name: "review_recent_attempts", description: "Required before creating an exercise. Read the five most recent attempts across every usage of the selected word so the next question does not repeat them.", parameters: { type: "object", properties: { usage_id: { type: "string" } }, required: ["usage_id"], additionalProperties: false }, execute: (args) => { const usageId = String(args.usage_id || ""); const usage = usages.find((item) => item.usageId === usageId); if (!usage || !candidateIds.includes(usageId)) throw new Error("Recent attempts can only be reviewed for a selected candidate"); reviewedUsageId = usageId; const recent = usages.filter((item) => item.word.toLocaleLowerCase() === usage.word.toLocaleLowerCase()).flatMap((item) => item.attempts.map((attempt) => ({ ...attempt, meaning: item.prompt }))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5); reviewedAttempts = recent; return { word: usage.word, targetMeaning: usage.prompt, recentAttemptsForWord: recent }; } },
          { name: "create_exercise", description: "Create one non-repeating exercise in Simplified Chinese after reviewing recent attempts.", parameters: { type: "object", properties: { usage_id: { type: "string" }, instruction: { type: "string", description: "Simplified Chinese writing requirement" }, example_sentence: { type: "string", description: "Internal English reference; hidden from learner" } }, required: ["usage_id", "instruction", "example_sentence"], additionalProperties: false }, execute: (args) => { const usageId = String(args.usage_id || ""), instruction = String(args.instruction || "").trim(), exampleSentence = String(args.example_sentence || "").trim(); const usage = usages.find((item) => item.usageId === usageId); if (!usage || !candidateIds.includes(usageId) || reviewedUsageId !== usageId) throw new Error("Exercise creation requires reviewing the selected word's recent attempts first"); if (!/[\u3400-\u9fff]/.test(instruction)) throw new Error("Exercise instruction must be written in Simplified Chinese"); const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""); if (reviewedAttempts.some((attempt) => normalize(attempt.question) === normalize(instruction) || normalize(attempt.exampleSentence) === normalize(exampleSentence))) throw new Error("Exercise repeats a recent question or example"); generated = { usageId, word: usage.word, prompt: usage.prompt, instruction, exampleSentence }; setExercise(generated); return { accepted: true }; } },
        ],
      })) { if (event.type === "done") break; }
      if (!generated) throw new Error("Missing exercise");
    } catch { setError(copy.aiFailed); }
    finally { setBusy(false); }
  }

  async function gradeAnswer() {
    if (!exercise || !answer.trim() || !selected || !provider) return; setBusy(true); setError(""); setGrade(null); let result: Grade | null = null; let finalResult: Grade;
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 3 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: JSON.stringify({ word: exercise.word, intendedUsage: exercise.prompt, instruction: exercise.instruction, example: exercise.exampleSentence, learnerSentence: answer.trim() }) }],
        systemPrompt: "Judge whether the learner's English sentence is grammatically acceptable and uses the specified word with the requested meaning. Minor stylistic or punctuation issues do not make it wrong. Call grade_answer exactly once. Give concise feedback in Simplified Chinese and provide a corrected sentence only when needed.",
        maxTokens: 1024, temperature: .1, isComplete: () => result !== null, incompletePrompt: "Please call grade_answer now.", maxIncompleteRetries: 2,
        tools: [{ name: "grade_answer", description: "Record the sentence judgment.", parameters: { type: "object", properties: { is_correct: { type: "boolean" }, feedback: { type: "string" }, corrected_sentence: { type: ["string", "null"] } }, required: ["is_correct", "feedback", "corrected_sentence"], additionalProperties: false }, execute: (args) => { result = { isCorrect: Boolean(args.is_correct), feedback: String(args.feedback || ""), correctedSentence: args.corrected_sentence ? String(args.corrected_sentence) : null }; setGrade(result); return { accepted: true }; } }],
      })) { if (event.type === "done") break; }
      const completedGrade = result as Grade | null;
      if (!completedGrade) throw new Error("Missing grade");
      finalResult = completedGrade;
    } catch { setError(copy.gradeFailed); setBusy(false); return; }
    try {
      await vocabularyPracticeApi.recordAttempt({ usageId: exercise.usageId, question: exercise.instruction, exampleSentence: exercise.exampleSentence, answer: answer.trim(), isCorrect: finalResult.isCorrect, feedback: finalResult.feedback, correctedSentence: finalResult.correctedSentence });
      await load();
    } catch (cause) { setError(`${copy.saveGradeFailed}${cause instanceof ApiError ? ` HTTP ${cause.status}${cause.code ? ` (${cause.code})` : ""}: ${cause.message}` : cause instanceof Error ? ` ${cause.message}` : ""}`); }
    finally { setBusy(false); }
  }

  if (status === "uninitialized") return <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (!isAuthenticated) return <Gate title={copy.title} message={copy.login} action={copy.signIn} href="/login" />;
  if (user?.status !== 1) return <Gate title={copy.title} message={copy.verify} action={copy.signIn} href="/verify-email" />;
  if (!models.length || !provider) return <Gate title={copy.title} message={copy.llm} action={copy.settings} href={settingsUrl} />;

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3 }, py: 5 }}><Box sx={{ maxWidth: 760, mx: "auto" }}><Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 3 }}><SchoolRoundedIcon color="primary" sx={{ fontSize: 38 }} /><Box><Typography variant="h4" sx={{ fontWeight: 700 }}>{copy.title}</Typography><Typography color="text.secondary">{copy.subtitle}</Typography></Box></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Stack spacing={2}>{loading ? <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress /></Box> : usages.length === 0 ? <Alert severity="info" action={<Button component={Link} href="/user-data">{copy.manage}</Button>}>{copy.empty}</Alert> : <><Autocomplete size="small" options={models} value={selected} disableClearable getOptionLabel={(item) => item.name || item.modelId} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_e, value) => setModelId(value.id)} renderInput={(params) => <TextField {...params} label={copy.model} />} /><Button variant="contained" size="large" onClick={() => void generateExercise()} disabled={busy}>{busy && !exercise ? copy.generating : copy.generate}</Button></>}
        {exercise && <><Divider /><Typography variant="h4" color="primary" sx={{ fontWeight: 800 }}>{exercise.word}</Typography><Alert severity="info">{exercise.instruction}</Alert><TextField multiline minRows={4} label={copy.answer} value={answer} onChange={(e) => setAnswer(e.target.value)} /><Button variant="contained" onClick={() => void gradeAnswer()} disabled={busy || !answer.trim()}>{busy ? copy.checking : copy.submit}</Button></>}
        {grade && <Alert severity={grade.isCorrect ? "success" : "warning"}><Typography sx={{ fontWeight: 700 }}>{grade.isCorrect ? copy.correct : copy.wrong}</Typography>{grade.feedback}{grade.correctedSentence && <Typography sx={{ mt: 1 }}><strong>{copy.corrected}:</strong> {grade.correctedSentence}</Typography>}</Alert>}
    </Stack></CardContent></Card>
  </Box></Box><Footer /></div>;
}

function Gate({ title, message, action, href }: { title: string; message: string; action: string; href: string }) {
  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2 }}><Card variant="outlined" sx={{ maxWidth: 520, width: "100%" }}><CardContent><Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}><SchoolRoundedIcon color="primary" sx={{ fontSize: 48 }} /><Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography><Alert severity="info" sx={{ width: "100%" }}>{message}</Alert><Button component={Link} href={href} variant="contained" startIcon={<LoginRoundedIcon />}>{action}</Button></Stack></CardContent></Card></Box><Footer /></div>;
}
