"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress, Divider, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import Footer from "@components/ui/layout/Footer";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useAuth } from "@lib/client-api/use-auth";
import { ApiError, vocabularyDrillApi, vocabularyPracticeApi, type VocabularyCollection, type VocabularyUsage } from "@lib/client-api";
import { useI18n } from "@lib/i18n/app";

const words = {
  en: { title: "User Data", description: "Manage data stored for your account.", vocabulary: "Vocabulary learning", vocabularyHint: "Words, distinct meanings, progress, and recent sentence attempts", word: "Word", usage: "Meaning / usage", add: "Add usage", empty: "No vocabulary usages yet.", correct: "Correct", wrong: "Wrong", recent: "Recent 8", never: "Not practiced", history: "Last 5 attempts", example: "Example", feedback: "Feedback", corrected: "Correction", delete: "Delete usage", duplicate: "This word usage already exists.", loadFailed: "Unable to load user data.", saveFailed: "Unable to save user data.", practice: "Start sentence practice", login: "Sign in to manage User Data.", verify: "Verify your email before managing User Data.", signIn: "Sign in" },
  zh: { title: "用户数据", description: "管理保存在账户中的个人数据。", vocabulary: "词汇学习", vocabularyHint: "单词、独立词义、学习进度和最近造句记录", word: "单词", usage: "释义 / 用法", add: "添加用法", empty: "还没有词汇用法。", correct: "正确", wrong: "错误", recent: "最近 8 次", never: "尚未练习", history: "最近 5 次记录", example: "例句", feedback: "反馈", corrected: "修改建议", delete: "删除用法", duplicate: "这个单词用法已经存在。", loadFailed: "无法加载用户数据。", saveFailed: "无法保存用户数据。", practice: "开始造句练习", login: "登录后才能管理用户数据。", verify: "请先验证邮箱再管理用户数据。", signIn: "去登录" },
};

export default function UserDataClient() {
  const { locale } = useI18n(); const copy = words[locale]; const { status, isAuthenticated, user } = useAuth(); useDocumentTitle(copy.title);
  const [usages, setUsages] = useState<VocabularyUsage[]>([]); const [collections, setCollections] = useState<VocabularyCollection[]>([]); const [word, setWord] = useState(""); const [usage, setUsage] = useState(""); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [usageData, drillData] = await Promise.all([vocabularyPracticeApi.list(), vocabularyDrillApi.userData()]); setUsages(usageData.usages); setCollections(drillData.collections); } catch { setError(copy.loadFailed); } finally { setLoading(false); } }, [copy.loadFailed]);
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
  async function removeCollectionItem(collectionId: string, sourceWordId: number) { setError(""); try { await vocabularyDrillApi.deleteItem(collectionId, sourceWordId); setCollections(current => current.map(collection => collection.collectionId === collectionId ? { ...collection, items: collection.items.filter(item => Number(item.sourceWordId) !== sourceWordId) } : collection)); } catch { setError(copy.saveFailed); } }

  if (status === "uninitialized") return <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (!isAuthenticated || user?.status !== 1) return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2 }}><Alert severity="info" action={<Button component={Link} href={user?.status === 0 ? "/verify-email" : "/login"}>{copy.signIn}</Button>}>{isAuthenticated ? copy.verify : copy.login}</Alert></Box><Footer /></div>;

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: { xs: 2, sm: 4 }, py: 5 }}><Box sx={{ width: "100%", maxWidth: 980, mx: "auto" }}><Typography component="h1" variant="h4" sx={{ mb: 1, fontWeight: 700 }}>{copy.title}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{copy.description}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "240px minmax(0, 1fr)" }, gap: 2.5, alignItems: "start" }}>
      <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><CardActionArea sx={{ p: 2, display: "flex", justifyContent: "flex-start", gap: 1.5, bgcolor: "action.selected" }}><Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><StorageRoundedIcon /></Box><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{copy.vocabulary}</Typography><Typography variant="caption" color="text.secondary">{copy.vocabularyHint}</Typography></Box><ChevronRightRoundedIcon color="action" /></CardActionArea></Card>
      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}><Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}><Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.vocabulary}</Typography><Typography variant="body2" color="text.secondary">{copy.vocabularyHint}</Typography></Box><Button component={Link} href="/tools/english-learner/sentence-practice" variant="outlined" startIcon={<MenuBookRoundedIcon />}>{copy.practice}</Button></Stack>
        <Box component="form" onSubmit={add} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 2fr auto" }, gap: 1 }}><TextField size="small" label={copy.word} value={word} onChange={(e) => setWord(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} /><TextField size="small" label={copy.usage} value={usage} onChange={(e) => setUsage(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} /><Button type="submit" variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <AddRoundedIcon />} disabled={saving || !word.trim() || !usage.trim()}>{copy.add}</Button></Box><Divider />
        {collections.map(collection => <CollectionBlock key={collection.collectionId} collection={collection} locale={locale} practiceLabel={copy.practice} onDelete={removeCollectionItem} />)}
        {loading ? <Box sx={{ display: "grid", placeItems: "center", py: 5 }}><CircularProgress /></Box> : usages.length === 0 ? <Alert severity="info">{copy.empty}</Alert> : <Stack spacing={1.5}>{usages.map((item) => <Card key={item.usageId} variant="outlined" sx={{ borderRadius: 2.5 }}><CardContent><Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{item.word}</Typography><Typography>{item.prompt}</Typography><Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}><Chip size="small" color="success" variant="outlined" label={`${copy.correct}: ${item.correct}`} /><Chip size="small" color="error" variant="outlined" label={`${copy.wrong}: ${item.wrong}`} /><Chip size="small" label={`${copy.recent}: ${item.last8CorrectRate}`} /><Chip size="small" label={item.lastLearnTime ? new Date(item.lastLearnTime).toLocaleString() : copy.never} /></Stack></Box><Tooltip title={copy.delete}><IconButton color="error" onClick={() => void remove(item.usageId)}><DeleteOutlineRoundedIcon /></IconButton></Tooltip></Stack>
          {item.attempts.length > 0 && <Box sx={{ mt: 2 }}><Divider sx={{ mb: 1.5 }} /><Typography variant="subtitle2" sx={{ mb: 1 }}>{copy.history}</Typography><Stack spacing={1}>{item.attempts.map((attempt) => <Box key={attempt.attemptId} sx={{ borderLeft: 3, borderColor: attempt.isCorrect ? "success.main" : "error.main", pl: 1.5, py: .5 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{attempt.isCorrect ? "✓" : "✗"} {attempt.answer}</Typography><Typography variant="caption" color="text.secondary">{new Date(attempt.createdAt).toLocaleString()} · {copy.example}: {attempt.exampleSentence}</Typography><Typography variant="body2"><strong>{copy.feedback}:</strong> {attempt.feedback}</Typography>{attempt.correctedSentence && <Typography variant="body2"><strong>{copy.corrected}:</strong> {attempt.correctedSentence}</Typography>}</Box>)}</Stack></Box>}
        </CardContent></Card>)}</Stack>}
      </Stack></CardContent></Card>
    </Box>
  </Box></Box><Footer /></div>;
}

function CollectionBlock({ collection, locale, practiceLabel, onDelete }: { collection: VocabularyCollection; locale: "en" | "zh"; practiceLabel: string; onDelete: (collectionId: string, sourceWordId: number) => Promise<void> }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0); const pageSize = 8;
  const normalized = query.trim().toLocaleLowerCase(); const filtered = normalized ? collection.items.filter(item => item.word.toLocaleLowerCase().includes(normalized) || item.meanings.some(meaning => meaning.text.toLocaleLowerCase().includes(normalized))) : collection.items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)); const safePage = Math.min(page, pageCount - 1); const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: "action.hover" }}><CardContent><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}><Typography variant="h6" sx={{ fontWeight: 700 }}>★ {collection.name}</Typography><Button component={Link} href="/tools/english-learner/vocabulary-practice" size="small">{practiceLabel}</Button></Stack><TextField fullWidth size="small" placeholder={locale === "zh" ? "查找单词或释义" : "Find a word or meaning"} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} slotProps={{ input: { startAdornment: <SearchRoundedIcon color="action" sx={{ mr: 1 }} /> } }} sx={{ mb: 1.5 }} />{visible.length ? <Stack spacing={1}>{visible.map((item, index) => <Box key={`${item.dataset}:${item.sourceWordId}`} sx={{ display: "flex", gap: 1.5, alignItems: "center", py: .75, borderBottom: 1, borderColor: "divider" }}><Typography color="text.secondary" sx={{ width: 28 }}>{safePage * pageSize + index + 1}.</Typography><Typography sx={{ minWidth: 110, fontWeight: 700 }}>{item.word}</Typography><Typography variant="body2" sx={{ flex: 1 }}>{item.meanings.map(m => `${m.partOfSpeech}. ${m.text}`).join(" / ")}</Typography><IconButton size="small" color="error" title={locale === "zh" ? "从收藏夹删除" : "Remove from collection"} onClick={() => void onDelete(collection.collectionId, Number(item.sourceWordId))}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Box>)}</Stack> : <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>{locale === "zh" ? "没有找到匹配词语" : "No matching words"}</Typography>}<Stack direction="row" spacing={1} sx={{ justifyContent: "center", alignItems: "center", mt: 1.5 }}><IconButton size="small" disabled={safePage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeftRoundedIcon /></IconButton><Typography variant="caption">{safePage + 1} / {pageCount}</Typography><IconButton size="small" disabled={safePage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRightRoundedIcon /></IconButton></Stack></CardContent></Card>;
}
