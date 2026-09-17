"use client";

import { useEffect, useRef, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CollectionDialog from "@components/vocabulary/CollectionDialog";
import { toast } from "@components/ui/feedback/toast";
import { vocabularyDrillApi, type DrillMeaning, type DrillPartOfSpeech, type VocabularyCollection, type VocabularyCollectionItem, type VocabularyPhonetic } from "@lib/client-api";
import { getLlmModels, getLlmProfiles, LlmClient } from "@lib/llm";

const partsOfSpeech: DrillPartOfSpeech[] = ["vt", "vi", "v", "adj", "adv", "n", "prep", "conj", "pron", "int", "num", "art", "other"];
const emptyMeaning = (): DrillMeaning => ({ partOfSpeech: "n", text: "" });
const dictionaryPartsOfSpeech: Record<string, DrillPartOfSpeech> = { noun: "n", verb: "v", adjective: "adj", adverb: "adv", preposition: "prep", conjunction: "conj", pronoun: "pron", exclamation: "int", interjection: "int", number: "num", numeral: "num", article: "art" };

interface Props {
  open: boolean;
  locale: "en" | "zh";
  collections: VocabularyCollection[];
  initialCollectionId?: string;
  onClose: () => void;
  onSaved: (collectionId: string, item: VocabularyCollectionItem) => void;
  onCollectionCreated: (collection: VocabularyCollection) => void;
}

interface DictionaryResult {
  entry: {
    pronunciation: { br: string | null; us: string | null };
    senses: Array<{ pos?: string | null; definition_zh?: string | null; definition_en?: string | null; examples?: Array<{ en?: string | null }> }>;
  };
}

interface GeneratedDetails {
  meanings?: DrillMeaning[];
  phonetics?: VocabularyPhonetic[];
  pluralForms?: string;
  pastTense?: string;
  pastParticiple?: string;
  example?: string;
  definition?: string;
}

export default function VocabularyItemDialog({ open, locale, collections, initialCollectionId, onClose, onSaved, onCollectionCreated }: Props) {
  const zh = locale === "zh";
  const wasOpenRef = useRef(false);
  const lookupRequestRef = useRef(0);
  const lookedUpWordRef = useRef("");
  const [collectionId, setCollectionId] = useState(""); const [word, setWord] = useState(""); const [meanings, setMeanings] = useState<DrillMeaning[]>([emptyMeaning()]);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [phonetics, setPhonetics] = useState<VocabularyPhonetic[]>([]); const [pluralForms, setPluralForms] = useState(""); const [pastTense, setPastTense] = useState(""); const [pastParticiple, setPastParticiple] = useState(""); const [example, setExample] = useState(""); const [definition, setDefinition] = useState("");
  const [lookingUp, setLookingUp] = useState(false); const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { wasOpenRef.current = false; lookupRequestRef.current++; lookedUpWordRef.current = ""; return; }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    const timer = window.setTimeout(() => { setCollectionId(initialCollectionId || collections[0]?.collectionId || ""); setWord(""); setMeanings([emptyMeaning()]); setPhonetics([]); setPluralForms(""); setPastTense(""); setPastParticiple(""); setExample(""); setDefinition(""); setLookingUp(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [collections, initialCollectionId, open]);

  function updateMeaning(index: number, patch: Partial<DrillMeaning>) { setMeanings(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function updatePhonetic(index: number, patch: Partial<VocabularyPhonetic>) { setPhonetics(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  function changeWord(nextWord: string) {
    lookupRequestRef.current++;
    setLookingUp(false);
    if (lookedUpWordRef.current && lookedUpWordRef.current !== nextWord.trim()) {
      lookedUpWordRef.current = "";
      setMeanings([emptyMeaning()]); setPhonetics([]); setPluralForms(""); setPastTense(""); setPastParticiple(""); setExample(""); setDefinition("");
    }
    setWord(nextWord);
  }

  async function lookUpWord() {
    const normalizedWord = word.trim();
    if (!normalizedWord) return;
    const requestId = ++lookupRequestRef.current;
    setLookingUp(true);
    try {
      const response = await fetch(`/api/dictionary/oxford10c?word=${encodeURIComponent(normalizedWord)}`);
      if (requestId !== lookupRequestRef.current) return;
      if (!response.ok) {
        toast[response.status === 404 ? "info" : "error"](response.status === 404 ? (zh ? "词典中没有找到该单词，请手动填写。" : "Word not found in the dictionary. Enter it manually.") : (zh ? "词典查询失败，请稍后重试。" : "Dictionary lookup failed. Please try again."));
        return;
      }
      const { entry } = await response.json() as DictionaryResult;
      if (requestId !== lookupRequestRef.current) return;
      lookedUpWordRef.current = normalizedWord;
      const seenParts = new Set<DrillPartOfSpeech>();
      const dictionaryMeanings = entry.senses.flatMap(sense => {
        const text = sense.definition_zh?.trim();
        const partOfSpeech = dictionaryPartsOfSpeech[sense.pos?.toLowerCase() || ""] || "other";
        if (!text || seenParts.has(partOfSpeech)) return [];
        seenParts.add(partOfSpeech);
        return [{ partOfSpeech, text }];
      }).slice(0, 3);
      if (dictionaryMeanings.length) setMeanings(dictionaryMeanings);
      const foundPhonetics: VocabularyPhonetic[] = [
        ...(entry.pronunciation?.br ? [{ accent: "uk" as const, text: entry.pronunciation.br }] : []),
        ...(entry.pronunciation?.us ? [{ accent: "us" as const, text: entry.pronunciation.us }] : []),
      ];
      if (foundPhonetics.length) setPhonetics(current => current.length ? current : foundPhonetics);
      const firstDefinition = entry.senses.find(sense => sense.definition_en?.trim())?.definition_en || "";
      const firstExample = entry.senses.flatMap(sense => sense.examples || []).find(item => item.en?.trim())?.en || "";
      if (firstDefinition) setDefinition(current => current || firstDefinition);
      if (firstExample) setExample(current => current || firstExample);
      const hasNoun = entry.senses.some(sense => dictionaryPartsOfSpeech[sense.pos?.toLowerCase() || ""] === "n");
      const hasVerb = entry.senses.some(sense => dictionaryPartsOfSpeech[sense.pos?.toLowerCase() || ""] === "v");
      const missing = {
        meanings: !dictionaryMeanings.length && !meanings.some(item => item.text.trim()),
        phonetics: !foundPhonetics.length && !phonetics.some(item => item.text.trim()),
        pluralForms: hasNoun && !pluralForms.trim(),
        pastTense: hasVerb && !pastTense.trim(),
        pastParticiple: hasVerb && !pastParticiple.trim(),
        example: !firstExample && !example.trim(),
        definition: !firstDefinition && !definition.trim(),
      };
      const properties: Record<string, unknown> = {};
      if (missing.meanings) properties.meanings = { type: "array", minItems: 1, maxItems: 3, items: { type: "object", properties: { partOfSpeech: { type: "string", enum: partsOfSpeech }, text: { type: "string" } }, required: ["partOfSpeech", "text"], additionalProperties: false } };
      if (missing.phonetics) properties.phonetics = { type: "array", minItems: 1, maxItems: 2, items: { type: "object", properties: { accent: { type: "string", enum: ["uk", "us", "other"] }, text: { type: "string", description: "IPA transcription with slashes" } }, required: ["accent", "text"], additionalProperties: false } };
      for (const field of ["pluralForms", "pastTense", "pastParticiple", "example", "definition"] as const) if (missing[field]) properties[field] = { type: "string" };
      const required = Object.keys(properties);
      if (!required.length) return;
      const selected = getLlmModels().find(item => item.id && item.providerId && item.modelId.trim());
      const provider = getLlmProfiles().find(item => item.id === selected?.providerId);
      if (!selected || !provider) {
        toast.info(zh ? "词典信息不完整；可手动填写，或配置 LLM 自动补全。" : "Some dictionary details are missing. Enter them manually or configure an LLM to complete them.");
        return;
      }
      let generated: GeneratedDetails | null = null;
      const client = new LlmClient({ profile: provider, model: selected.modelId, maxToolRounds: 2 });
      for await (const event of client.stream({
        messages: [{ role: "user", content: JSON.stringify({ word: normalizedWord, dictionaryMeanings, definition: firstDefinition, example: firstExample, missingFields: required }) }],
        systemPrompt: "Complete only the requested missing fields for this English vocabulary entry. Use common, accurate forms. Give separate past tense and past participle forms. Keep meanings to the headword itself, not phrases or idioms. Do not change dictionary supplied content. Call complete_vocabulary with every requested field.",
        maxTokens: 800, temperature: .1, isComplete: () => generated !== null, incompletePrompt: "Call complete_vocabulary with every requested field now.", maxIncompleteRetries: 1,
        tools: [{ name: "complete_vocabulary", description: "Provide only the missing vocabulary details", parameters: { type: "object", properties, required, additionalProperties: false }, execute: args => { generated = args as GeneratedDetails; return { accepted: true }; } }],
      })) { if (event.type === "done") break; }
      if (requestId !== lookupRequestRef.current) return;
      if (!generated) throw new Error("Incomplete vocabulary details");
      const details = generated as GeneratedDetails;
      if (missing.meanings && Array.isArray(details.meanings)) {
        const completedMeanings = details.meanings.filter(item => item && partsOfSpeech.includes(item.partOfSpeech) && typeof item.text === "string" && item.text.trim()).slice(0, 3).map(item => ({ partOfSpeech: item.partOfSpeech, text: item.text.trim() }));
        if (completedMeanings.length) setMeanings(current => current.some(item => item.text.trim()) ? current : completedMeanings);
      }
      if (missing.phonetics && Array.isArray(details.phonetics)) {
        const completedPhonetics = details.phonetics.filter(item => item && ["uk", "us", "other"].includes(item.accent) && typeof item.text === "string" && item.text.trim()).slice(0, 2).map(item => ({ accent: item.accent, text: item.text.trim() }));
        if (completedPhonetics.length) setPhonetics(current => current.some(item => item.text.trim()) ? current : completedPhonetics);
      }
      if (missing.pluralForms && typeof details.pluralForms === "string") setPluralForms(current => current || details.pluralForms!.trim());
      if (missing.pastTense && typeof details.pastTense === "string") setPastTense(current => current || details.pastTense!.trim());
      if (missing.pastParticiple && typeof details.pastParticiple === "string") setPastParticiple(current => current || details.pastParticiple!.trim());
      if (missing.example && typeof details.example === "string") setExample(current => current || details.example!.trim());
      if (missing.definition && typeof details.definition === "string") setDefinition(current => current || details.definition!.trim());
    } catch {
      if (requestId === lookupRequestRef.current) toast.error(zh ? "词典查询或补全失败；可手动填写缺失信息。" : "Dictionary lookup or completion failed. Enter any missing details manually.");
    } finally { if (requestId === lookupRequestRef.current) setLookingUp(false); }
  }

  async function save() {
    const validMeanings = meanings.map(item => ({ ...item, text: item.text.trim() })).filter(item => item.text); if (!collectionId || !word.trim() || !validMeanings.length) { toast.warning(zh ? "请选择收藏夹，并填写单词和至少一个释义。" : "Choose a collection and enter a word with at least one meaning."); return; }
    setSaving(true);
    try {
      const response = await vocabularyDrillApi.addItem({ collectionId, dataset: "custom", word: word.trim(), phonetic: phonetics[0]?.text || "", phonetics, meanings: validMeanings, pluralForms: pluralForms.trim(), pastForms: [pastTense.trim(), pastParticiple.trim()].filter(Boolean).join("/"), example: example.trim(), definition: definition.trim() });
      if (!response.item) throw new Error("Missing saved item"); onSaved(collectionId, response.item); onClose();
    } catch { toast.error(zh ? "保存词条失败，可能已经存在。" : "Unable to save the word; it may already exist."); } finally { setSaving(false); }
  }

  const hasVerbMeaning = meanings.some(item => ["vt", "vi", "v"].includes(item.partOfSpeech)); const hasNounMeaning = meanings.some(item => item.partOfSpeech === "n");
  return <><Dialog open={open && !collectionDialogOpen} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>{zh ? "新增收藏词汇" : "Add vocabulary"}</DialogTitle>
    <DialogContent dividers><Stack spacing={2.25}>
      <Autocomplete options={[...collections, { collectionId: "__new__", name: zh ? "+ 新建收藏夹" : "+ New collection", items: [] }]} value={collections.find(item => item.collectionId === collectionId) || null} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.collectionId === b.collectionId} onChange={(_event, value) => { if (value?.collectionId === "__new__") setCollectionDialogOpen(true); else setCollectionId(value?.collectionId || ""); }} renderInput={params => <TextField {...params} label={zh ? "收藏夹" : "Collection"} required slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: true, sx: { userSelect: "none", cursor: "pointer" } } }} />} />
      <TextField autoFocus fullWidth label={zh ? "单词原形" : "Base word"} value={word} onChange={event => changeWord(event.target.value)} required slotProps={{ htmlInput: { maxLength: 100 } }} />
      <Box><Stack direction={{ xs: "column", sm: "row" }} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1, mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{zh ? "中文释义" : "Chinese meanings"}</Typography><Stack direction="row" spacing={.5} sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}><Button size="small" disabled={lookingUp || !word.trim()} startIcon={lookingUp ? <CircularProgress size={15} /> : undefined} onClick={() => void lookUpWord()}>{lookingUp ? (zh ? "正在补全…" : "Completing…") : (zh ? "查询词典" : "Look up word")}</Button><Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setMeanings(current => [...current, emptyMeaning()])}>{zh ? "添加义项" : "Add meaning"}</Button></Stack></Stack>
        <Stack spacing={1}>{meanings.map((meaning, index) => <Stack key={index} direction="row" spacing={1}><TextField select label={zh ? "词性" : "Part of speech"} value={meaning.partOfSpeech} onChange={event => updateMeaning(index, { partOfSpeech: event.target.value as DrillPartOfSpeech })} sx={{ width: 130 }}>{partsOfSpeech.map(part => <MenuItem key={part} value={part}>{part}</MenuItem>)}</TextField><TextField fullWidth label={zh ? `释义 ${index + 1}` : `Meaning ${index + 1}`} value={meaning.text} onChange={event => updateMeaning(index, { text: event.target.value })} /><IconButton aria-label={zh ? "删除义项" : "Remove meaning"} disabled={meanings.length === 1} onClick={() => setMeanings(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutlineRoundedIcon /></IconButton></Stack>)}</Stack>
      </Box>
      <Accordion><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography sx={{ fontWeight: 700 }}>{zh ? "更多词条信息（可选）" : "More entry details (optional)"}</Typography></AccordionSummary><AccordionDetails><Stack spacing={2}>
        <Box><Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}><Typography sx={{ fontWeight: 700 }}>{zh ? "音标" : "Phonetics"}</Typography><Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setPhonetics(current => [...current, { accent: "other", text: "" }])}>{zh ? "添加音标" : "Add phonetic"}</Button></Stack><Stack spacing={1}>{phonetics.length ? phonetics.map((phonetic, index) => <Stack key={index} direction="row" spacing={1}><TextField select label={zh ? "类型" : "Type"} value={phonetic.accent} onChange={event => updatePhonetic(index, { accent: event.target.value as VocabularyPhonetic["accent"] })} sx={{ width: 130 }}><MenuItem value="other">{zh ? "默认" : "Default"}</MenuItem><MenuItem value="uk">{zh ? "英式" : "UK"}</MenuItem><MenuItem value="us">{zh ? "美式" : "US"}</MenuItem></TextField><TextField fullWidth label={zh ? `音标 ${index + 1}` : `Phonetic ${index + 1}`} value={phonetic.text} onChange={event => updatePhonetic(index, { text: event.target.value })} /><IconButton aria-label={zh ? "删除音标" : "Remove phonetic"} onClick={() => setPhonetics(current => current.filter((_item, itemIndex) => itemIndex !== index))}><DeleteOutlineRoundedIcon /></IconButton></Stack>) : <Typography variant="body2" color="text.secondary">{zh ? "暂无音标，可手动添加或查询词典。" : "No phonetic yet; add one or look up the word."}</Typography>}</Stack></Box>
        {hasNounMeaning ? <TextField label={zh ? "复数形式（多个用 / 分隔）" : "Plural forms (separate with /)"} value={pluralForms} onChange={event => setPluralForms(event.target.value)} /> : <Typography variant="body2" color="text.secondary">{zh ? "无名词义项，无需复数形式。" : "No noun meaning; plural forms do not apply."}</Typography>}
        {hasVerbMeaning ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField fullWidth label={zh ? "过去式（多个用 / 分隔）" : "Past tense (separate with /)"} value={pastTense} onChange={event => setPastTense(event.target.value)} /><TextField fullWidth label={zh ? "过去分词（多个用 / 分隔）" : "Past participle (separate with /)"} value={pastParticiple} onChange={event => setPastParticiple(event.target.value)} /></Stack> : <Typography variant="body2" color="text.secondary">{zh ? "无动词义项，无需过去式和过去分词。" : "No verb meaning; past tense and past participle do not apply."}</Typography>}
        <TextField multiline minRows={2} label={zh ? "例句" : "Example sentence"} value={example} onChange={event => setExample(event.target.value)} />
        <TextField multiline minRows={2} label={zh ? "英文解释" : "English definition"} value={definition} onChange={event => setDefinition(event.target.value)} />
      </Stack></AccordionDetails></Accordion>
    </Stack></DialogContent>
    <DialogActions><Button disabled={saving} onClick={onClose}>{zh ? "取消" : "Cancel"}</Button><Button variant="contained" disabled={saving || lookingUp} onClick={() => void save()}>{saving ? <CircularProgress size={20} /> : (zh ? "保存到收藏" : "Save to collection")}</Button></DialogActions>
  </Dialog><CollectionDialog open={collectionDialogOpen} locale={locale} onClose={() => setCollectionDialogOpen(false)} onCreated={collection => { setCollectionId(collection.collectionId); onCollectionCreated(collection); }} /></>;
}
