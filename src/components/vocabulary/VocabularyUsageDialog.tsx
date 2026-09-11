"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Autocomplete, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";
import { ApiError, vocabularyPracticeApi, type VocabularyCollectionSummary, type VocabularyUsage } from "@lib/client-api";
import CollectionDialog from "./CollectionDialog";

export default function VocabularyUsageDialog({ open, locale, collections, initialCollectionId, onClose, onCollectionCreated, onSaved }: {
  open: boolean;
  locale: "en" | "zh";
  collections: VocabularyCollectionSummary[];
  initialCollectionId?: string;
  onClose: () => void;
  onCollectionCreated: (collection: VocabularyCollectionSummary) => void;
  onSaved: (usage: VocabularyUsage) => void;
}) {
  const zh = locale === "zh";
  const [collectionId, setCollectionId] = useState("");
  const [word, setWord] = useState("");
  const [usage, setUsage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const wasOpen = useRef(false);
  const selectedCollection = collections.find(item => item.collectionId === collectionId) || null;

  useEffect(() => {
    if (!open) { wasOpen.current = false; return; }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const timer = window.setTimeout(() => {
      setCollectionId(collections.some(item => item.collectionId === initialCollectionId) ? initialCollectionId! : (collections[0]?.collectionId || ""));
      setWord(""); setUsage(""); setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [collections, initialCollectionId, open]);

  async function save() {
    if (!collectionId || !word.trim() || !usage.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await vocabularyPracticeApi.createUsage({ collectionId, word: word.trim(), prompt: usage.trim() });
      onSaved(response.usage); onClose();
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === "usage_exists"
        ? (zh ? "这个收藏夹中已经有相同的单词用法。" : "This collection already contains that word usage.")
        : (zh ? "无法保存单词用法。" : "Unable to save the word usage."));
    } finally { setSaving(false); }
  }

  return <>
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{zh ? "添加造句练习词义" : "Add sentence-practice usage"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Autocomplete options={[...collections, { collectionId: "__new__", name: zh ? "+ 新建…" : "+ New…" }]} value={selectedCollection} getOptionLabel={item => item.name} isOptionEqualToValue={(a, b) => a.collectionId === b.collectionId} onChange={(_event, value) => { if (value?.collectionId === "__new__") setCollectionDialogOpen(true); else setCollectionId(value?.collectionId || ""); }} renderInput={params => <TextField {...params} required label={zh ? "收藏夹" : "Collection"} slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, readOnly: true, sx: { cursor: "pointer" } } }} />} />
        <TextField autoFocus fullWidth required label={zh ? "单词" : "Word"} value={word} onChange={event => setWord(event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <TextField fullWidth required multiline minRows={2} label={zh ? "释义 / 用法" : "Meaning / usage"} value={usage} onChange={event => setUsage(event.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={saving} onClick={onClose}>{zh ? "取消" : "Cancel"}</Button><Button variant="contained" disabled={saving || !collectionId || !word.trim() || !usage.trim()} onClick={() => void save()}>{saving ? <CircularProgress size={20} /> : (zh ? "添加" : "Add")}</Button></DialogActions>
    </Dialog>
    <CollectionDialog open={collectionDialogOpen} locale={locale} onClose={() => setCollectionDialogOpen(false)} onCreated={collection => { const summary = { collectionId: collection.collectionId, name: collection.name }; onCollectionCreated(summary); setCollectionId(summary.collectionId); }} />
  </>;
}
