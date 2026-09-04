"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import Footer from "@tool/components/layout/Footer";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { useAuth } from "@shared/libs/client-api/use-auth";
import { ApiError, vocabularyPracticeApi, type VocabularyUsage } from "@shared/libs/client-api";
import { useI18n } from "@shared/libs/i18n/tool";

const words = {
  en: { title: "User Data", description: "Manage data stored for your account.", vocabulary: "Vocabulary learning", vocabularyHint: "Words, distinct meanings, progress, and recent sentence attempts", word: "Word", usage: "Meaning / usage", add: "Add usage", empty: "No vocabulary usages yet.", correct: "Correct", wrong: "Wrong", recent: "Recent 8", never: "Not practiced", history: "Last 5 attempts", example: "Example", feedback: "Feedback", corrected: "Correction", delete: "Delete usage", duplicate: "This word usage already exists.", loadFailed: "Unable to load user data.", saveFailed: "Unable to save user data.", practice: "Start sentence practice", login: "Sign in to manage User Data.", verify: "Verify your email before managing User Data.", signIn: "Sign in" },
  zh: { title: "用户数据", description: "管理保存在账户中的个人数据。", vocabulary: "词汇学习", vocabularyHint: "单词、独立词义、学习进度和最近造句记录", word: "单词", usage: "释义 / 用法", add: "添加用法", empty: "还没有词汇用法。", correct: "正确", wrong: "错误", recent: "最近 8 次", never: "尚未练习", history: "最近 5 次记录", example: "例句", feedback: "反馈", corrected: "修改建议", delete: "删除用法", duplicate: "这个单词用法已经存在。", loadFailed: "无法加载用户数据。", saveFailed: "无法保存用户数据。", practice: "开始造句练习", login: "登录后才能管理用户数据。", verify: "请先验证邮箱再管理用户数据。", signIn: "去登录" },
};

export default function UserDataClient() {
  const { locale } = useI18n(); const copy = words[locale]; const { status, isAuthenticated, user } = useAuth(); useDocumentTitle(copy.title);
  const [usages, setUsages] = useState<VocabularyUsage[]>([]); const [word, setWord] = useState(""); const [usage, setUsage] = useState(""); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { setUsages((await vocabularyPracticeApi.list()).usages); } catch { setError(copy.loadFailed); } finally { setLoading(false); } }, [copy.loadFailed]);
  useEffect(() => { if (status === "authenticated" && user?.status === 1) { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); } }, [load, status, user?.status, user?.userId]);

  async function add(event: FormEvent) {
    event.preventDefault(); if (!word.trim() || !usage.trim()) return; setSaving(true); setError("");
    try { const response = await vocabularyPracticeApi.createUsage({ word: word.trim(), prompt: usage.trim() }); setUsages((items) => [...items, response.usage].sort((a, b) => a.word.localeCompare(b.word) || a.prompt.localeCompare(b.prompt))); setWord(""); setUsage(""); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === "usage_exists" ? copy.duplicate : copy.saveFailed); }
    finally { setSaving(false); }
  }

  async function remove(usageId: string) {
    setError(""); try { await vocabularyPracticeApi.deleteUsage(usageId); setUsages((items) => items.filter((item) => item.usageId !== usageId)); } catch { setError(copy.saveFailed); }
  }

  if (status === "uninitialized") return <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (!isAuthenticated || user?.status !== 1) return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2 }}><Alert severity="info" action={<Button component={Link} href={user?.status === 0 ? "/verify-email" : "/login"}>{copy.signIn}</Button>}>{isAuthenticated ? copy.verify : copy.login}</Alert></Box><Footer /></div>;

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 4 }, py: 5 }}><Box sx={{ width: "100%", maxWidth: 980, mx: "auto" }}><Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 700 }}>{copy.title}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{copy.description}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)" }, gap: 2.5, alignItems: "start" }}>
      <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><CardActionArea sx={{ p: 2, display: "flex", justifyContent: "flex-start", gap: 1.5, bgcolor: "action.selected" }}><Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><StorageRoundedIcon /></Box><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{copy.vocabulary}</Typography><Typography variant="caption" color="text.secondary">{copy.vocabularyHint}</Typography></Box><ChevronRightRoundedIcon color="action" /></CardActionArea></Card>
      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}><Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}><Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.vocabulary}</Typography><Typography variant="body2" color="text.secondary">{copy.vocabularyHint}</Typography></Box><Button component={Link} href="/tools/english-learner/sentence-practice" variant="outlined" startIcon={<MenuBookRoundedIcon />}>{copy.practice}</Button></Stack>
        <Box component="form" onSubmit={add} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr auto" }, gap: 1 }}><TextField size="small" label={copy.word} value={word} onChange={(e) => setWord(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} /><TextField size="small" label={copy.usage} value={usage} onChange={(e) => setUsage(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} /><Button type="submit" variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <AddRoundedIcon />} disabled={saving || !word.trim() || !usage.trim()}>{copy.add}</Button></Box><Divider />
        {loading ? <Box sx={{ display: "grid", placeItems: "center", py: 5 }}><CircularProgress /></Box> : usages.length === 0 ? <Alert severity="info">{copy.empty}</Alert> : <Stack spacing={1.5}>{usages.map((item) => <Card key={item.usageId} variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent><Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{item.word}</Typography><Typography>{item.prompt}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}><Chip size="small" color="success" variant="outlined" label={`${copy.correct}: ${item.correct}`} /><Chip size="small" color="error" variant="outlined" label={`${copy.wrong}: ${item.wrong}`} /><Chip size="small" label={`${copy.recent}: ${item.last8CorrectRate}`} /><Chip size="small" label={item.lastLearnTime ? new Date(item.lastLearnTime).toLocaleString() : copy.never} /></Stack></Box><Tooltip title={copy.delete}><IconButton color="error" onClick={() => void remove(item.usageId)}><DeleteOutlineRoundedIcon /></IconButton></Tooltip></Stack>
          {item.attempts.length > 0 && <Box sx={{ mt: 2 }}><Divider sx={{ mb: 1.5 }} /><Typography variant="subtitle2" sx={{ mb: 1 }}>{copy.history}</Typography><Stack spacing={1}>{item.attempts.map((attempt) => <Box key={attempt.attemptId} sx={{ borderLeft: 3, borderColor: attempt.isCorrect ? "success.main" : "error.main", pl: 1.5, py: .5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{attempt.isCorrect ? "✓" : "✗"} {attempt.answer}</Typography><Typography variant="caption" color="text.secondary">{new Date(attempt.createdAt).toLocaleString()} · {copy.example}: {attempt.exampleSentence}</Typography><Typography variant="body2"><strong>{copy.feedback}:</strong> {attempt.feedback}</Typography>{attempt.correctedSentence && <Typography variant="body2"><strong>{copy.corrected}:</strong> {attempt.correctedSentence}</Typography>}</Box>)}</Stack></Box>}
        </CardContent></Card>)}</Stack>}
      </Stack></CardContent></Card>
    </Box>
  </Box></Box><Footer /></div>;
}
