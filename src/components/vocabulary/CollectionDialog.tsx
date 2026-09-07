"use client";

import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { vocabularyDrillApi, type VocabularyCollection } from "@lib/client-api";

export default function CollectionDialog({ open, locale, onClose, onCreated }: { open: boolean; locale: "en" | "zh"; onClose: () => void; onCreated: (collection: VocabularyCollection) => void }) {
  const zh = locale === "zh"; const [name, setName] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!open) return; const timer = window.setTimeout(() => { setName(""); setError(""); }, 0); return () => window.clearTimeout(timer); }, [open]);
  async function create() { if (!name.trim()) return; setSaving(true); setError(""); try { const response = await vocabularyDrillApi.createCollection(name.trim()); onCreated(response.collection); onClose(); } catch { setError(zh ? "无法创建收藏夹，名称可能已经存在。" : "Unable to create the collection; its name may already exist."); } finally { setSaving(false); } }
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs"><DialogTitle>{zh ? "新建收藏夹" : "New collection"}</DialogTitle><DialogContent>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<TextField autoFocus fullWidth required label={zh ? "收藏夹名称" : "Collection name"} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button disabled={saving} onClick={onClose}>{zh ? "取消" : "Cancel"}</Button><Button variant="contained" disabled={saving || !name.trim()} onClick={() => void create()}>{saving ? <CircularProgress size={20} /> : (zh ? "创建" : "Create")}</Button></DialogActions></Dialog>;
}
