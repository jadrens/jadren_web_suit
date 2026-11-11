"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { useDialogOperation, useDialogAccountKey } from "./use-dialog-operation";
import { vocabularyDrillApi, type VocabularyCollection } from "@lib/client-api";

function CollectionDialogContent({ open, locale, onClose, onCreated }: { open: boolean; locale: "en" | "zh"; onClose: () => void; onCreated: (collection: VocabularyCollection) => void }) {
  const startOperation = useDialogOperation(open);
  const pending = useRef<symbol | null>(null);
  const zh = locale === "zh"; const [name, setName] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!open) return; const timer = window.setTimeout(() => { setName(""); setError(""); setSaving(false); pending.current = null; }, 0); return () => window.clearTimeout(timer); }, [open]);
  async function create() { if (pending.current || !name.trim()) return; const token = Symbol(); pending.current = token; const isCurrent = startOperation(); setSaving(true); setError(""); try { const response = await vocabularyDrillApi.createCollection(name.trim()); if (!isCurrent()) return; onCreated(response.collection); onClose(); } catch { if (isCurrent()) setError(zh ? "无法创建收藏夹，名称可能已经存在。" : "Unable to create the collection; its name may already exist."); } finally { if (pending.current === token) pending.current = null; if (isCurrent()) setSaving(false); } }
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs"><DialogTitle>{zh ? "新建收藏夹" : "New collection"}</DialogTitle><DialogContent>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<TextField autoFocus fullWidth required label={zh ? "收藏夹名称" : "Collection name"} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button disabled={saving} onClick={onClose}>{zh ? "取消" : "Cancel"}</Button><Button variant="contained" disabled={saving || !name.trim()} onClick={() => void create()}>{saving ? <CircularProgress size={20} /> : (zh ? "创建" : "Create")}</Button></DialogActions></Dialog>;
}

export default function CollectionDialog(props: Parameters<typeof CollectionDialogContent>[0]) {
  const key = useDialogAccountKey();
  return <CollectionDialogContent key={key} {...props} />;
}
