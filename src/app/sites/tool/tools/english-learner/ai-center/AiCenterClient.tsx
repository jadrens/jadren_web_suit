"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, TextField, Typography } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import Footer from "@tool/components/layout/Footer";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { useSiteUrl } from "@shared/site-url";
import { useAuth } from "@shared/libs/client-api/use-auth";
import { ApiError, vocabularyPracticeApi, type VocabularyUsage } from "@shared/libs/client-api";
import { getLlmModels, getLlmProfiles, LlmClient, type LlmMessage, type LlmModelProfile, type LlmProfile } from "@shared/libs/llm";
import { useI18n } from "@shared/libs/i18n/tool";

interface VocabularyProposal { proposalId: string; word: string; prompt: string; example: string }
interface ChatMessage { id: string; role: "user" | "assistant"; content: string; additions?: Array<VocabularyProposal & { status: "pending" | "added" | "duplicate" }> }

const labels = {
  en: { title: "English Learning AI Center", subtitle: "Chat with AI to discover and add vocabulary for sentence practice.", welcome: "Tell me what vocabulary you want to learn—for example, “Suggest five useful words for frontend development.” I will show each word, meaning, and example, then wait for your confirmation before adding anything.", placeholder: "Ask for new words or confirm a proposal…", send: "Send", model: "Model", login: "Sign in to use AI Center.", verify: "Verify your email before using AI Center.", llm: "Configure an LLM Provider and Model in Settings first.", signIn: "Sign in", settings: "Open Settings", failed: "The AI request failed. Please try again.", pending: "Awaiting confirmation", added: "Added", duplicate: "Already exists", userData: "Open User Data", empty: "No response text" },
  zh: { title: "英语学习 AI 中心", subtitle: "通过对话让 AI 推荐并添加造句练习词汇。", welcome: "告诉我你想学习什么词汇，例如“推荐 5 个前端开发常用单词”。我会先展示每个单词、用法和例句，然后等待你单独回复确认，未经确认不会添加。", placeholder: "要求推荐新单词，或确认已有提案……", send: "发送", model: "模型", login: "登录后才能使用 AI 中心。", verify: "请先验证邮箱再使用 AI 中心。", llm: "请先在设置中配置 LLM Provider 和 Model。", signIn: "去登录", settings: "打开设置", failed: "AI 请求失败，请重试。", pending: "等待确认", added: "已添加", duplicate: "已经存在", userData: "打开 User Data", empty: "没有文本回复" },
};

export default function AiCenterClient() {
  const { locale } = useI18n(); const copy = labels[locale]; const { status, isAuthenticated, user } = useAuth(); const settingsUrl = useSiteUrl("main", "/settings"); useDocumentTitle(copy.title);
  const [models, setModels] = useState<LlmModelProfile[]>([]); const [providers, setProviders] = useState<LlmProfile[]>([]); const [modelId, setModelId] = useState(""); const [usages, setUsages] = useState<VocabularyUsage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "welcome", role: "assistant", content: copy.welcome }]); const [input, setInput] = useState(""); const [running, setRunning] = useState(false); const [error, setError] = useState(""); const chatScrollRef = useRef<HTMLDivElement | null>(null); const followOutputRef = useRef(true); const pendingProposalsRef = useRef<VocabularyProposal[]>([]);
  const selected = models.find((item) => item.id === modelId); const provider = providers.find((item) => item.id === selected?.providerId);

  useEffect(() => { const timer = window.setTimeout(() => { const available = getLlmModels().filter((item) => item.id && item.providerId && item.modelId.trim()); setModels(available); setProviders(getLlmProfiles()); setModelId(available[0]?.id || ""); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { if (status === "authenticated" && user?.status === 1) { const timer = window.setTimeout(() => void vocabularyPracticeApi.list().then((response) => setUsages(response.usages)).catch(() => undefined), 0); return () => window.clearTimeout(timer); } }, [status, user?.status, user?.userId]);
  useEffect(() => { if (!followOutputRef.current) return; const frame = window.requestAnimationFrame(() => { const element = chatScrollRef.current; if (element) element.scrollTop = element.scrollHeight; }); return () => window.cancelAnimationFrame(frame); }, [messages, running]);

  async function send(event: FormEvent) {
    event.preventDefault(); const request = input.trim(); if (!request || !selected || !provider || running) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: request }; const assistantId = crypto.randomUUID(); const prior = messages.filter((message) => message.id !== "welcome");
    followOutputRef.current = true; setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", additions: [] }]); setInput(""); setRunning(true); setError("");
    let responseText = ""; let toolCount = 0; const proposalsBeforeTurn = [...pendingProposalsRef.current];
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 12 });
      const llmMessages: LlmMessage[] = [...prior, userMessage].map((message) => ({ role: message.role, content: message.content }));
      for await (const streamEvent of client.stream({
        messages: llmMessages,
        systemPrompt: `You are the vocabulary curator in an English-learning AI Center. Help the learner inspect their learning data, understand progress, and choose useful English words and distinct meanings for sentence practice. You can read User Data, propose vocabulary, and confirm a previously proposed addition. Use read_user_vocabulary whenever the user asks about saved words, history, accuracy, progress, weak areas, duplicates, or recommendations based on their data.\n\nMANDATORY TWO-TURN CONSENT WORKFLOW:\n1. When the user asks for new vocabulary, visibly show each proposal in this exact format, then call propose_vocabulary_usage (which does NOT write data):\n将要添加：\n单词：<word>\n用法：<meaning in Simplified Chinese>\n示例：<natural English example sentence>\n2. End that turn by asking the user to confirm. NEVER call add_confirmed_vocabulary in the same turn in which a proposal is created.\n3. Only after the user sends a separate, explicit affirmative reply may you call add_confirmed_vocabulary using the existing proposal_id and an exact quote from that confirmation reply. Do not treat silence, a new request, a question, or ambiguous wording as consent.\n4. A word with multiple meanings requires one proposal per meaning. Do not merge meanings.\n5. Read User Data when needed and do not propose an existing word+meaning pair. Current summary: ${JSON.stringify(usages.map(({ usageId, word, prompt }) => ({ usageId, word, prompt })))}\n6. After confirmed write results, briefly summarize what was added or already existed.\n\nPending proposals from earlier turns: ${JSON.stringify(proposalsBeforeTurn)}`,
        maxTokens: 4096, temperature: .5,
        tools: [{ name: "read_user_vocabulary", description: "Read the signed-in user's vocabulary usages, learning statistics, and optionally their five most recent attempts. Use an empty query to read all data.", parameters: { type: "object", properties: { query: { type: "string", description: "Case-insensitive word or meaning search; use an empty string for all usages" }, include_attempts: { type: "boolean" } }, required: ["query", "include_attempts"], additionalProperties: false }, execute: (args) => {
          const query = String(args.query || "").trim().toLocaleLowerCase();
          const matches = usages.filter((item) => !query || item.word.toLocaleLowerCase().includes(query) || item.prompt.toLocaleLowerCase().includes(query));
          return { count: matches.length, usages: matches.map((item) => ({ usageId: item.usageId, word: item.word, meaning: item.prompt, lastLearnTime: item.lastLearnTime, correct: item.correct, wrong: item.wrong, last8CorrectRate: item.last8CorrectRate, ...(args.include_attempts ? { recentAttempts: item.attempts } : {}) })) };
        } }, { name: "propose_vocabulary_usage", description: "Create a pending proposal only; this never writes User Data. The exact word, meaning, and example must first appear in assistant text.", parameters: { type: "object", properties: { word: { type: "string" }, meaning: { type: "string" }, example: { type: "string" } }, required: ["word", "meaning", "example"], additionalProperties: false }, execute: (args) => {
          const word = String(args.word || "").trim(), meaning = String(args.meaning || "").trim(), example = String(args.example || "").trim();
          if (!word || !meaning || !example || !responseText.includes(word) || !responseText.includes(meaning) || !responseText.includes(example)) throw new Error("The AI must announce the exact word, meaning, and example before proposing it");
          const proposal = { proposalId: crypto.randomUUID(), word, prompt: meaning, example }; pendingProposalsRef.current = [...pendingProposalsRef.current, proposal]; toolCount++;
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, additions: [...(message.additions || []), { ...proposal, status: "pending" }] } : message));
          return { proposed: true, ...proposal, instruction: "Wait for a separate explicit user confirmation before adding." };
        } }, { name: "add_confirmed_vocabulary", description: "Add a proposal from an earlier turn after the current user message explicitly confirms it.", parameters: { type: "object", properties: { proposal_id: { type: "string" }, confirmation_quote: { type: "string", description: "Exact affirmative words copied from the current user message" } }, required: ["proposal_id", "confirmation_quote"], additionalProperties: false }, execute: async (args) => {
          const proposalId = String(args.proposal_id || ""), confirmationQuote = String(args.confirmation_quote || "").trim(); const proposal = proposalsBeforeTurn.find((item) => item.proposalId === proposalId);
          const explicitConsent = /(?:确认|同意|批准|可以添加|请添加|添加吧|都加|全部添加|\byes\b|\bconfirm(?:ed)?\b|\bapprove(?:d)?\b|\bok(?:ay)?\b|\bgo ahead\b)/i.test(request);
          const rejected = /(?:不(?:要|同意|确认|可以)|别加|不要添加|取消|\bno\b|\bdon't\b|\bdo not\b|\bnot approved?\b)/i.test(request);
          if (!proposal || !confirmationQuote || !request.includes(confirmationQuote) || !explicitConsent || rejected) throw new Error("A separate explicit user confirmation is required before adding vocabulary");
          let added = true;
          try { const saved = await vocabularyPracticeApi.createUsage({ word: proposal.word, prompt: proposal.prompt }); setUsages((current) => [...current, saved.usage]); }
          catch (cause) { if (cause instanceof ApiError && cause.code === "usage_exists") added = false; else throw cause; }
          pendingProposalsRef.current = pendingProposalsRef.current.filter((item) => item.proposalId !== proposalId); toolCount++;
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, additions: [...(message.additions || []), { ...proposal, status: added ? "added" : "duplicate" }] } : message));
          return { added, word: proposal.word, meaning: proposal.prompt };
        } }],
      })) {
        if (streamEvent.type === "text_delta") { responseText += streamEvent.text; setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + streamEvent.text } : message)); }
      }
      if (!responseText && toolCount === 0) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: copy.empty } : message));
    } catch (cause) { setError(cause instanceof Error ? `${copy.failed} ${cause.message}` : copy.failed); }
    finally { setRunning(false); }
  }

  if (status === "uninitialized") return <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (!isAuthenticated) return <Gate title={copy.title} message={copy.login} action={copy.signIn} href="/login" />;
  if (user?.status !== 1) return <Gate title={copy.title} message={copy.verify} action={copy.signIn} href="/verify-email" />;
  if (!models.length || !provider) return <Gate title={copy.title} message={copy.llm} action={copy.settings} href={settingsUrl} />;

  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: 2, py: 4 }}><Box sx={{ maxWidth: 900, mx: "auto" }}><Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}><AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 38 }} /><Box sx={{ flex: 1 }}><Typography variant="h4" sx={{ fontWeight: 700 }}>{copy.title}</Typography><Typography color="text.secondary">{copy.subtitle}</Typography></Box><Button component={Link} href="/user-data" variant="outlined">{copy.userData}</Button></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><CardContent sx={{ p: 0 }}><Box ref={chatScrollRef} onScroll={(event) => { const element = event.currentTarget; followOutputRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} sx={{ height: { xs: "58vh", md: 560 }, overflowY: "auto", p: { xs: 2, sm: 3 }, bgcolor: "background.default" }}><Stack spacing={2}>{messages.map((message) => <Box key={message.id} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}><Box sx={{ px: 2, py: 1.5, borderRadius: 2.5, bgcolor: message.role === "user" ? "primary.main" : "background.paper", color: message.role === "user" ? "primary.contrastText" : "text.primary", border: message.role === "assistant" ? 1 : 0, borderColor: "divider" }}>{message.role === "assistant" ? <MarkdownMessage content={message.content || (running ? "…" : "")} /> : <Typography sx={{ whiteSpace: "pre-wrap" }}>{message.content}</Typography>}</Box>{message.additions?.map((addition, index) => { const pending = addition.status === "pending"; const added = addition.status === "added"; return <Box key={`${addition.proposalId}-${index}`} sx={{ mt: 1, p: 1.5, border: 1, borderColor: pending ? "info.main" : added ? "success.main" : "warning.main", borderRadius: 2 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Typography sx={{ fontWeight: 700 }}>{addition.word}</Typography><Chip size="small" color={pending ? "info" : added ? "success" : "warning"} label={pending ? copy.pending : added ? copy.added : copy.duplicate} /></Stack><Typography variant="body2">{addition.prompt}</Typography><Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>{addition.example}</Typography></Box>; })}</Box>)}{running && <CircularProgress size={22} />}</Stack></Box><Divider /><Box component="form" onSubmit={send} sx={{ p: 2 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Autocomplete size="small" options={models} value={selected} disableClearable getOptionLabel={(item) => item.name || item.modelId} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_event, value) => setModelId(value.id)} renderInput={(params) => <TextField {...params} label={copy.model} />} sx={{ width: { xs: "100%", sm: 220 } }} /><TextField fullWidth size="small" multiline maxRows={4} label={copy.placeholder} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); event.currentTarget.closest("form")?.requestSubmit(); } }} /><Button type="submit" variant="contained" disabled={running || !input.trim()} endIcon={<SendRoundedIcon />}>{copy.send}</Button></Stack></Box></CardContent></Card>
  </Box></Box><Footer /></div>;
}

function MarkdownMessage({ content }: { content: string }) {
  return <Box sx={{ overflowWrap: "anywhere", "& > :first-of-type": { mt: 0 }, "& > :last-child": { mb: 0 }, "& p": { my: 1, whiteSpace: "pre-wrap" }, "& h1, & h2, & h3, & h4": { mt: 2, mb: 1, lineHeight: 1.3 }, "& ul, & ol": { my: 1, pl: 3 }, "& li": { mb: .5 }, "& a": { color: "primary.main" }, "& code": { px: .5, py: .2, borderRadius: .75, bgcolor: "action.hover", fontFamily: "monospace" }, "& pre": { overflowX: "auto", p: 1.5, borderRadius: 2, bgcolor: "action.hover" }, "& pre code": { p: 0, bgcolor: "transparent" }, "& blockquote": { mx: 0, pl: 1.5, borderLeft: 3, borderColor: "divider", color: "text.secondary" }, "& table": { width: "100%", borderCollapse: "collapse" }, "& th, & td": { border: 1, borderColor: "divider", p: .75, textAlign: "left" } }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></Box>;
}

function Gate({ title, message, action, href }: { title: string; message: string; action: string; href: string }) {
  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, display: "grid", placeItems: "center", px: 2 }}><Card variant="outlined" sx={{ maxWidth: 520, width: "100%" }}><CardContent><Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}><AutoAwesomeRoundedIcon color="primary" sx={{ fontSize: 48 }} /><Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography><Alert severity="info" sx={{ width: "100%" }}>{message}</Alert><Button component={Link} href={href} variant="contained" startIcon={<LoginRoundedIcon />}>{action}</Button></Stack></CardContent></Card></Box><Footer /></div>;
}
