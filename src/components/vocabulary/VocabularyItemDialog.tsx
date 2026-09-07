"use client";

import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CollectionDialog from "@components/vocabulary/CollectionDialog";
import { getLlmModels, getLlmProfiles, LlmClient } from "@lib/llm";
import { vocabularyDrillApi, type DrillMeaning, type DrillPartOfSpeech, type VocabularyCollection, type VocabularyCollectionItem, type VocabularyPhonetic } from "@lib/client-api";

const partsOfSpeech: DrillPartOfSpeech[] = ["vt", "vi", "v", "adj", "adv", "n", "prep", "conj", "pron", "int", "num", "art", "other"];
const emptyMeaning = (): DrillMeaning => ({ partOfSpeech: "n", text: "" });
function splitGeneratedMeanings(value: unknown): DrillMeaning[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const partOfSpeech = partsOfSpeech.includes((item as DrillMeaning).partOfSpeech) ? (item as DrillMeaning).partOfSpeech : "other";
    return String((item as DrillMeaning).text || "").split(/[；;/]/).map(text => text.trim()).filter(Boolean).map(text => ({ partOfSpeech, text }));
  });
}

interface Props {
  open: boolean;
  locale: "en" | "zh";
  collections: VocabularyCollection[];
  initialCollectionId?: string;
  onClose: () => void;
  onSaved: (collectionId: string, item: VocabularyCollectionItem) => void;
  onCollectionCreated: (collection: VocabularyCollection) => void;
}

interface DictionaryResult { phonetic: string; phonetics: VocabularyPhonetic[]; definition: string; example: string }
interface GeneratedWord { pluralForms?: string; pastTense?: string; pastParticiple?: string; example: string }
interface WordCandidate { word: string; note: string }

export default function VocabularyItemDialog({ open, locale, collections, initialCollectionId, onClose, onSaved, onCollectionCreated }: Props) {
  const zh = locale === "zh";
  const wasOpenRef = useRef(false);
  const [collectionId, setCollectionId] = useState(""); const [word, setWord] = useState(""); const [meanings, setMeanings] = useState<DrillMeaning[]>([emptyMeaning()]);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [phonetics, setPhonetics] = useState<VocabularyPhonetic[]>([]); const [pluralForms, setPluralForms] = useState(""); const [pastTense, setPastTense] = useState(""); const [pastParticiple, setPastParticiple] = useState(""); const [example, setExample] = useState(""); const [definition, setDefinition] = useState("");
  const [wordCandidates, setWordCandidates] = useState<WordCandidate[]>([]);
  const [generating, setGenerating] = useState(false); const [translating, setTranslating] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    if (!open) { wasOpenRef.current = false; return; }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    const timer = window.setTimeout(() => { setCollectionId(initialCollectionId || collections[0]?.collectionId || ""); setWord(""); setMeanings([emptyMeaning()]); setPhonetics([]); setPluralForms(""); setPastTense(""); setPastParticiple(""); setExample(""); setDefinition(""); setWordCandidates([]); setError(""); }, 0);
    return () => window.clearTimeout(timer);
  }, [collections, initialCollectionId, open]);

  function updateMeaning(index: number, patch: Partial<DrillMeaning>) { setMeanings(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updatePhonetic(index: number, patch: Partial<VocabularyPhonetic>) { setPhonetics(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }

  async function autoGenerate() {
    const normalizedWord = word.trim(); if (!normalizedWord) { setError(zh ? "请先填写单词原形。" : "Enter the base word first."); return; }
    const hasVerbMeaning = meanings.some(item => ["vt", "vi", "v"].includes(item.partOfSpeech)); const hasNounMeaning = meanings.some(item => item.partOfSpeech === "n");
    setGenerating(true); setError("");
    const dictionaryRequest = fetch(`/api/vocabulary-drill/dictionary?word=${encodeURIComponent(normalizedWord)}`).then(async response => response.ok ? await response.json() as DictionaryResult : null).catch(() => null);
    const models = getLlmModels().filter(item => item.id && item.providerId && item.modelId.trim()); const selected = models[0]; const provider = getLlmProfiles().find(item => item.id === selected?.providerId);
    const llmRequest = (async () => {
      if (!selected || !provider) return null; let generated: GeneratedWord | null = null;
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 2 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: JSON.stringify({ word: normalizedWord, meanings: meanings.filter(item => item.text.trim()) }) }],
        systemPrompt: `补全英语词条的附加信息。${hasNounMeaning ? "当前包含名词义项，必须生成常用复数 pluralForms。" : "当前没有名词义项，不得生成复数。"}${hasVerbMeaning ? "当前包含动词义项，必须分别生成过去式 pastTense 和过去分词 pastParticiple。" : "当前没有动词义项，不得生成过去式或过去分词。"}多个合法形式用 / 分隔。例句仅作词典 API 无例句时的备用。不要生成或修改中英文主体内容。必须调用 complete_vocabulary。`,
        maxTokens: 1000, temperature: .1, isComplete: () => generated !== null, incompletePrompt: "立即调用 complete_vocabulary。", maxIncompleteRetries: 1,
        tools: [{ name: "complete_vocabulary", description: "只提交适用于当前词性的结构化附加信息", parameters: { type: "object", properties: { ...(hasNounMeaning ? { pluralForms: { type: "string", description: "名词复数；多个形式用 / 分隔" } } : {}), ...(hasVerbMeaning ? { pastTense: { type: "string", description: "动词过去式；多个形式用 / 分隔" }, pastParticiple: { type: "string", description: "动词过去分词；多个形式用 / 分隔" } } : {}), example: { type: "string" } }, required: [...(hasNounMeaning ? ["pluralForms"] : []), ...(hasVerbMeaning ? ["pastTense", "pastParticiple"] : []), "example"], additionalProperties: false }, execute: args => { generated = args as unknown as GeneratedWord; return { accepted: true }; } }]
      })) { if (event.type === "done") break; }
      return generated as GeneratedWord | null;
    })().catch(() => null);
    const [dictionary, generated] = await Promise.all([dictionaryRequest, llmRequest]);
    if (dictionary) { setPhonetics(dictionary.phonetics.length ? dictionary.phonetics : dictionary.phonetic ? [{ accent: "other", text: dictionary.phonetic }] : []); setDefinition(dictionary.definition); setExample(dictionary.example || generated?.example || ""); }
    else if (generated?.example) setExample(generated.example);
    if (generated) { setPluralForms(hasNounMeaning ? generated.pluralForms || "" : ""); setPastTense(hasVerbMeaning ? generated.pastTense || "" : ""); setPastParticiple(hasVerbMeaning ? generated.pastParticiple || "" : ""); }
    if (!dictionary && !generated) setError(zh ? "词典与 LLM 均未能补全，请手动填写。" : "Dictionary and LLM completion both failed; enter the details manually.");
    setGenerating(false);
  }

  async function generateTranslation(direction: "toChinese" | "toEnglish") {
    const sourceMeanings = meanings.filter(item => item.text.trim());
    if (direction === "toChinese" ? !word.trim() : !sourceMeanings.length) { setError(direction === "toChinese" ? (zh ? "请先填写英文单词。" : "Enter the English word first.") : (zh ? "请先填写中文释义。" : "Enter a Chinese meaning first.")); return; }
    const models = getLlmModels().filter(item => item.id && item.providerId && item.modelId.trim()); const selected = models[0]; const provider = getLlmProfiles().find(item => item.id === selected?.providerId);
    if (!selected || !provider) { setError(zh ? "请先在设置中配置 LLM Provider 和 Model。" : "Configure an LLM provider and model first."); return; }
    setTranslating(true); setError(""); let completed = false;
    try {
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 2 });
      const tools = direction === "toChinese" ? [{ name: "submit_chinese_meanings", description: "提交英文单词对应的中文义项；每个独立词义必须是单独的数组项", parameters: { type: "object", properties: { meanings: { type: "array", minItems: 1, items: { type: "object", properties: { partOfSpeech: { type: "string", enum: partsOfSpeech }, text: { type: "string", description: "单个中文义项，不得用顿号、分号、斜杠连接其他义项" } }, required: ["partOfSpeech", "text"], additionalProperties: false } } }, required: ["meanings"], additionalProperties: false }, execute: (args: Record<string, unknown>) => { setMeanings(splitGeneratedMeanings(args.meanings)); completed = true; return { accepted: true }; } }] : [{ name: "suggest_english_words", description: "提交多个符合中文义项的候选英文单词", parameters: { type: "object", properties: { candidates: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", properties: { word: { type: "string" }, note: { type: "string", description: "简短说明该词与用户释义的匹配差异" } }, required: ["word", "note"], additionalProperties: false } } }, required: ["candidates"], additionalProperties: false }, execute: (args: Record<string, unknown>) => { setWordCandidates(args.candidates as WordCandidate[]); completed = true; return { accepted: true }; } }];
      for await (const event of client.stream({ messages: [{ role: "user", content: JSON.stringify({ word: word.trim(), meanings: sourceMeanings }) }], systemPrompt: direction === "toChinese" ? "根据英文单词生成准确、简洁、常用的中文义项并标注词性。一个数组项只能包含一个独立语义；即使词性相同，也必须把不同语义拆成多项。例如 apple 的‘苹果’和‘苹果树’是两个 n 义项，禁止合写成‘苹果；苹果树’。必须调用 submit_chinese_meanings。" : "根据用户提供的全部中文义项，一次提出 2 到 6 个最符合条件的英语词典原形。候选可以有细微语义差异，说明差异，让用户自己选择。必须调用 suggest_english_words。", maxTokens: 1000, temperature: .2, isComplete: () => completed, incompletePrompt: direction === "toChinese" ? "立即调用 submit_chinese_meanings，每个独立词义单列一项。" : "立即调用 suggest_english_words。", maxIncompleteRetries: 1, tools })) { if (event.type === "done") break; }
      if (!completed) throw new Error("Incomplete translation");
    } catch { setError(zh ? "LLM 未能完成本次互译。" : "The LLM could not complete this translation."); } finally { setTranslating(false); }
  }

  async function save() {
    const validMeanings = meanings.map(item => ({ ...item, text: item.text.trim() })).filter(item => item.text); if (!collectionId || !word.trim() || !validMeanings.length) { setError(zh ? "请选择收藏夹，并填写单词和至少一个释义。" : "Choose a collection and enter a word with at least one meaning."); return; }
    setSaving(true); setError("");
    try {
      const response = await vocabularyDrillApi.addItem({ collectionId, dataset: "custom", word: word.trim(), phonetic: phonetics[0]?.text || "", phonetics, meanings: validMeanings, pluralForms: pluralForms.trim(), pastForms: [pastTense.trim(), pastParticiple.trim()].filter(Boolean).join("/"), example: example.trim(), definition: definition.trim() });
      if (!response.item) throw new Error("Missing saved item"); onSaved(collectionId, response.item); onClose();
    } catch { setError(zh ? "保存词条失败，可能已经存在。" : "Unable to save the word; it may already exist."); } finally { setSaving(false); }
  }

  const hasWord = Boolean(word.trim()); const hasMeaning = meanings.some(item => item.text.trim()); const hasVerbMeaning = meanings.some(item => ["vt", "vi", "v"].includes(item.partOfSpeech)); const hasNounMeaning = meanings.some(item => item.partOfSpeech === "n");
  return <><Dialog open={open && !collectionDialogOpen && !wordCandidates.length} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{zh ? "新增收藏词汇" : "Add vocabulary"}</DialogTitle>
    <DialogContent dividers><Stack spacing={2.25}>
      {error && <Alert severity="error">{error}</Alert>}
      <Autocomplete options={[...collections, { collectionId: "__new__", name: zh ? "+ 新建收藏夹" : "+ New collection", items: [] }]} value={collections.find(item => item.collectionId === collectionId) || null} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.collectionId === b.collectionId} onChange={(_event, value) => { if (value?.collectionId === "__new__") setCollectionDialogOpen(true); else setCollectionId(value?.collectionId || ""); }} renderInput={params => <TextField {...params} label={zh ? "收藏夹" : "Collection"} required slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: true, sx: { userSelect: "none", cursor: "pointer" } } }} />} />
      <TextField autoFocus fullWidth label={zh ? "单词原形" : "Base word"} value={word} onChange={event => setWord(event.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <Box><Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1, mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{zh ? "中文释义" : "Chinese meanings"}</Typography><Stack direction="row" spacing={.5} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>{hasWord !== hasMeaning && <Button size="small" disabled={translating} startIcon={translating ? <CircularProgress size={15} /> : <AutoAwesomeRoundedIcon />} onClick={() => void generateTranslation(hasWord ? "toChinese" : "toEnglish")}>{hasWord ? (zh ? "自动补充中文义项" : "Generate Chinese meanings") : (zh ? "自动匹配英文单词" : "Match English words")}</Button>}<Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setMeanings(current => [...current, emptyMeaning()])}>{zh ? "添加义项" : "Add meaning"}</Button></Stack></Stack>
        <Stack spacing={1}>{meanings.map((meaning, index) => <Stack key={index} direction="row" spacing={1}><TextField select label={zh ? "词性" : "Part of speech"} value={meaning.partOfSpeech} onChange={event => updateMeaning(index, { partOfSpeech: event.target.value as DrillPartOfSpeech })} sx={{ width: 130 }}>{partsOfSpeech.map(part => <MenuItem key={part} value={part}>{part}</MenuItem>)}</TextField><TextField fullWidth label={zh ? `释义 ${index + 1}` : `Meaning ${index + 1}`} value={meaning.text} onChange={event => updateMeaning(index, { text: event.target.value })} /><IconButton aria-label={zh ? "删除义项" : "Remove meaning"} disabled={meanings.length === 1} onClick={() => setMeanings(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutlineRoundedIcon /></IconButton></Stack>)}</Stack>
      </Box>
      <Button variant="outlined" startIcon={generating ? <CircularProgress size={18} /> : <AutoAwesomeRoundedIcon />} disabled={generating || translating || !word.trim()} onClick={() => void autoGenerate()}>{generating ? (zh ? "正在并行补全…" : "Completing…") : (zh ? "自动生成附加信息" : "Auto-generate additional details")}</Button>
      <Accordion><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography sx={{ fontWeight: 700 }}>{zh ? "更多词条信息（可选）" : "More entry details (optional)"}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
        <Box><Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{zh ? "音标" : "Phonetics"}</Typography><Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setPhonetics(current => [...current, { accent: "other", text: "" }])}>{zh ? "添加音标" : "Add phonetic"}</Button></Stack><Stack spacing={1}>{phonetics.length ? phonetics.map((phonetic, index) => <Stack key={index} direction="row" spacing={1}><TextField select label={zh ? "类型" : "Type"} value={phonetic.accent} onChange={event => updatePhonetic(index, { accent: event.target.value as VocabularyPhonetic["accent"] })} sx={{ width: 130 }}><MenuItem value="other">{zh ? "默认" : "Default"}</MenuItem><MenuItem value="uk">{zh ? "英式" : "UK"}</MenuItem><MenuItem value="us">{zh ? "美式" : "US"}</MenuItem></TextField><TextField fullWidth label={zh ? `音标 ${index + 1}` : `Phonetic ${index + 1}`} value={phonetic.text} onChange={event => updatePhonetic(index, { text: event.target.value })} /><IconButton aria-label={zh ? "删除音标" : "Remove phonetic"} onClick={() => setPhonetics(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutlineRoundedIcon /></IconButton></Stack>) : <Typography variant="body2" color="text.secondary">{zh ? "暂无音标，可手动添加或自动生成。" : "No phonetic yet; add one or generate it automatically."}</Typography>}</Stack></Box>
        {hasNounMeaning ? <TextField label={zh ? "复数形式（多个用 / 分隔）" : "Plural forms (separate with /)"} value={pluralForms} onChange={event => setPluralForms(event.target.value)} /> : <Typography variant="body2" color="text.secondary">{zh ? "无名词义项，无需复数形式。" : "No noun meaning; plural forms do not apply."}</Typography>}
        {hasVerbMeaning ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField fullWidth label={zh ? "过去式（多个用 / 分隔）" : "Past tense (separate with /)"} value={pastTense} onChange={event => setPastTense(event.target.value)} /><TextField fullWidth label={zh ? "过去分词（多个用 / 分隔）" : "Past participle (separate with /)"} value={pastParticiple} onChange={event => setPastParticiple(event.target.value)} /></Stack> : <Typography variant="body2" color="text.secondary">{zh ? "无动词义项，无需过去式和过去分词。" : "No verb meaning; past tense and past participle do not apply."}</Typography>}
        <TextField multiline minRows={2} label={zh ? "例句" : "Example sentence"} value={example} onChange={event => setExample(event.target.value)} />
        <TextField multiline minRows={2} label={zh ? "英文解释" : "English definition"} value={definition} onChange={event => setDefinition(event.target.value)} />
      </Stack></AccordionDetails></Accordion>
    </Stack></DialogContent>
    <DialogActions><Button disabled={saving} onClick={onClose}>{zh ? "取消" : "Cancel"}</Button><Button variant="contained" disabled={saving || generating || translating} onClick={() => void save()}>{saving ? <CircularProgress size={20} /> : (zh ? "保存到收藏" : "Save to collection")}</Button></DialogActions>
  </Dialog><CollectionDialog open={collectionDialogOpen} locale={locale} onClose={() => setCollectionDialogOpen(false)} onCreated={collection => { setCollectionId(collection.collectionId); onCollectionCreated(collection); }} /><Dialog open={Boolean(wordCandidates.length)} onClose={() => setWordCandidates([])} fullWidth maxWidth="sm"><DialogTitle>{zh ? "选择匹配的英文单词" : "Choose an English word"}</DialogTitle><DialogContent dividers><Stack spacing={1}>{wordCandidates.map((candidate, index) => <Button key={`${candidate.word}:${index}`} variant="outlined" onClick={() => { setWord(candidate.word); setWordCandidates([]); }} sx={{ p: 1.5, display: "block", textAlign: "left", textTransform: "none" }}><Typography sx={{ fontWeight: 750 }}>{candidate.word}</Typography><Typography variant="body2" color="text.secondary">{candidate.note}</Typography></Button>)}</Stack></DialogContent><DialogActions><Button onClick={() => setWordCandidates([])}>{zh ? "取消" : "Cancel"}</Button></DialogActions></Dialog></>;
}
