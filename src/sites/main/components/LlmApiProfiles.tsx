"use client";

import { useEffect, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import { useI18n } from "@shared/libs/i18n/main";
import { resolveLlmEndpoint } from "@shared/libs/llm";
import { useUnsavedChanges } from "@shared/hooks/useUnsavedChanges";
import { useAuth } from "@shared/libs/client-api/use-auth";
import { llmSettingsApi } from "@shared/libs/client-api";
import { decryptLlmSettings, encryptLlmSettings } from "@shared/libs/llm/cloud-backup";

type ApiType = "claude" | "openai-responses" | "openai-completions";
interface LlmProfile { id: string; name: string; type: ApiType; token: string; baseUrl: string }
interface LlmModel { id: string; name: string; modelId: string; providerId: string }
interface ModelDirectory { signature: string; options: string[]; loading: boolean; error: string }
const STORAGE_KEY = "llm-api-profiles";
const MODELS_STORAGE_KEY = "llm-api-models";
const defaults: Record<ApiType, string> = {
  claude: "https://api.anthropic.com",
  "openai-responses": "https://api.openai.com/v1",
  "openai-completions": "https://api.openai.com/v1",
};
const endpointPresets: Array<{ label: string; url: string; type: ApiType }> = [
  { label: "OpenAI / ChatGPT", url: "https://api.openai.com/v1", type: "openai-responses" },
  { label: "Claude / Anthropic", url: "https://api.anthropic.com/v1", type: "claude" },
  { label: "DeepSeek", url: "https://api.deepseek.com/v1", type: "openai-completions" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1", type: "openai-completions" },
];

function suggestedProfileName(baseUrl: string, type: ApiType) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "Local LLM";
    if (hostname.includes("openai.com")) return "OpenAI";
    if (hostname.includes("anthropic.com")) return "Anthropic";
    if (hostname.includes("deepseek.com")) return "DeepSeek";
    if (hostname.includes("openrouter.ai")) return "OpenRouter";
    const labels = hostname.split(".").filter((label) => label && !["www", "api", "v1"].includes(label));
    const label = labels.length > 1 ? labels[labels.length - 2] : labels[0];
    if (label) return label.split(/[-_]/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
  } catch { /* Keep a useful type-based name while the URL is incomplete. */ }
  return type === "claude" ? "Anthropic" : type === "openai-responses" ? "OpenAI Responses" : "OpenAI Compatible";
}

const createProfileId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const emptyProfile = (): LlmProfile => ({ id: createProfileId(), name: "OpenAI", type: "openai-responses", token: "", baseUrl: defaults["openai-responses"] });
const emptyModel = (): LlmModel => ({ id: createProfileId(), name: "", modelId: "", providerId: "" });

export default function LlmApiProfiles() {
  const { t } = useI18n();
  const copy = t.settings.llm;
  const auth = useAuth();
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [directory, setDirectory] = useState<"providers" | "models">("providers");
  const [loaded, setLoaded] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [modelDirectories, setModelDirectories] = useState<Record<string, ModelDirectory>>({});
  const [cloudMode, setCloudMode] = useState<"upload" | "download" | null>(null);
  const [cloudPassphrase, setCloudPassphrase] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudNotice, setCloudNotice] = useState<{ error: boolean; text: string } | null>(null);

  const snapshot = JSON.stringify({ profiles, models });
  const isDirty = loaded && snapshot !== savedSnapshot;
  const hasInvalidModels = models.some((model) => !model.providerId || !model.modelId.trim());
  useUnsavedChanges(isDirty, copy.unsaved);

  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const nextProfiles = Array.isArray(value) ? value : [];
      if (Array.isArray(value)) setProfiles(value);
      const modelValue = JSON.parse(localStorage.getItem(MODELS_STORAGE_KEY) || "[]");
      const nextModels = Array.isArray(modelValue) ? modelValue : [];
      if (Array.isArray(modelValue)) setModels(modelValue);
      setSavedSnapshot(JSON.stringify({ profiles: nextProfiles, models: nextModels }));
    } catch { setSavedSnapshot(JSON.stringify({ profiles: [], models: [] })); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isDirty) setSaved(false);
    const cleanTitle = document.title.replace(/^\*\s*/, "");
    document.title = isDirty ? `* ${cleanTitle}` : cleanTitle;
    return () => { document.title = cleanTitle; };
  }, [isDirty]);

  const update = (id: string, patch: Partial<LlmProfile>) => setProfiles((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const changeType = (profile: LlmProfile, type: ApiType) => {
    const baseUrl = !profile.baseUrl || Object.values(defaults).includes(profile.baseUrl) ? defaults[type] : profile.baseUrl;
    const nameWasAutomatic = !profile.name || profile.name === suggestedProfileName(profile.baseUrl, profile.type);
    update(profile.id, { type, baseUrl, ...(nameWasAutomatic ? { name: suggestedProfileName(baseUrl, type) } : {}) });
  };
  const changeBaseUrl = (profile: LlmProfile, baseUrl: string) => {
    const nameWasAutomatic = !profile.name || profile.name === suggestedProfileName(profile.baseUrl, profile.type);
    const matchingPreset = endpointPresets.find((preset) => preset.url === baseUrl);
    const type = matchingPreset?.type || profile.type;
    update(profile.id, { baseUrl, type, ...(nameWasAutomatic ? { name: suggestedProfileName(baseUrl, type) } : {}) });
  };
  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
    setSavedSnapshot(JSON.stringify({ profiles, models }));
    setSaved(true);
  };
  const closeCloud = () => { if (!cloudBusy) { setCloudMode(null); setCloudPassphrase(""); } };
  const syncCloud = async () => {
    if (!cloudMode || cloudPassphrase.length < 12) return;
    setCloudBusy(true); setCloudNotice(null);
    try {
      if (cloudMode === "upload") {
        const encrypted = await encryptLlmSettings({ profiles, models }, cloudPassphrase);
        await llmSettingsApi.upload(encrypted);
        setCloudNotice({ error: false, text: copy.cloudUploaded });
      } else {
        const { backup } = await llmSettingsApi.download();
        let restored;
        try { restored = await decryptLlmSettings(backup, cloudPassphrase); }
        catch { throw new Error(copy.cloudWrongPassphrase); }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(restored.profiles));
        localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(restored.models));
        setProfiles(restored.profiles); setModels(restored.models);
        setSavedSnapshot(JSON.stringify(restored)); setSaved(true);
        setCloudNotice({ error: false, text: copy.cloudDownloaded });
      }
      setCloudMode(null); setCloudPassphrase("");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setCloudNotice({ error: true, text: copy.cloudFailed.replace("{error}", detail) });
    } finally { setCloudBusy(false); }
  };
  const updateModel = (id: string, patch: Partial<LlmModel>) => setModels((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const loadModels = async (provider: LlmProfile) => {
    const signature = `${provider.type}:${provider.baseUrl}:${provider.token}`;
    const cached = modelDirectories[provider.id];
    if (cached?.loading || (cached?.signature === signature && cached.options.length > 0)) return;
    setModelDirectories((current) => ({ ...current, [provider.id]: { signature, options: [], loading: true, error: "" } }));
    try {
      const endpoint = resolveLlmEndpoint(provider.type, provider.baseUrl).replace(/\/(?:chat\/completions|responses|messages)$/i, "/models");
      const headers: Record<string, string> = provider.type === "claude"
        ? { ...(provider.token ? { "x-api-key": provider.token } : {}), "anthropic-version": "2023-06-01" }
        : provider.token ? { Authorization: `Bearer ${provider.token}` } : {};
      const response = await fetch(endpoint, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const payload = await response.json() as { data?: Array<{ id?: unknown }>; models?: Array<{ id?: unknown } | string> };
      const entries = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
      const options = [...new Set(entries.map((item) => typeof item === "string" ? item : typeof item?.id === "string" ? item.id : "").filter(Boolean))].sort();
      if (options.length === 0) throw new Error(copy.noModelsReturned);
      setModelDirectories((current) => ({ ...current, [provider.id]: { signature, options, loading: false, error: "" } }));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setModelDirectories((current) => ({ ...current, [provider.id]: { signature, options: [], loading: false, error: copy.modelLoadFailed.replace("{error}", detail) } }));
    }
  };

  return <Stack spacing={2}>
    <Alert severity="info" icon={<LockRoundedIcon />}>{copy.privacy}</Alert>
    <Alert severity="warning">{copy.cloudWarning}</Alert>
    <Tabs value={directory} onChange={(_event, value) => setDirectory(value)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tab value="providers" label={copy.providerList} />
      <Tab value="models" label={copy.modelList} />
    </Tabs>
    {directory === "providers" && <>
    {profiles.length === 0 && <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}><Typography>{copy.empty}</Typography></Box>}
    {profiles.map((profile, index) => <Accordion key={profile.id} disableGutters sx={{ border: 1, borderColor: "divider", borderRadius: "12px !important", overflow: "hidden", boxShadow: "none", "&:before": { display: "none" } }}>
      <AccordionSummary component="div" expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.25, minHeight: 64, "& .MuiAccordionSummary-content": { minWidth: 0 } }}>
      <Box sx={{ width: "100%", display: "flex", alignItems: "center", minWidth: 0 }}>
        {editingId === profile.id ? <TextField
          variant="standard"
          value={profile.name}
          autoFocus
          placeholder={`${copy.profile} ${index + 1}`}
          onChange={(e) => update(profile.id, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={() => setEditingId(null)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") setEditingId(null); }}
          slotProps={{ htmlInput: { "aria-label": copy.name } }}
          sx={{ minWidth: 0, maxWidth: 320, flex: 1, "& .MuiInputBase-input": { fontWeight: 700 } }}
        /> : <Typography sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{profile.name || suggestedProfileName(profile.baseUrl, profile.type)}</Typography>}
        {editingId !== profile.id && <IconButton size="small" aria-label={copy.renameHint} title={copy.renameHint} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setEditingId(profile.id); }} sx={{ ml: "auto", width: 40, height: 40, flexShrink: 0 }}><EditRoundedIcon fontSize="small" /></IconButton>}
        <IconButton size="small" color="error" aria-label={copy.delete} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setProfiles((items) => items.filter((item) => item.id !== profile.id)); }} sx={{ ml: editingId === profile.id ? "auto" : .5, mr: 1, width: 40, height: 40, flexShrink: 0 }}><DeleteOutlineRoundedIcon /></IconButton>
      </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.25, pb: 2.25, pt: 1 }}>
      <Stack spacing={2}>
        <FormControl fullWidth><InputLabel>{copy.type}</InputLabel><Select label={copy.type} value={profile.type} onChange={(e) => changeType(profile, e.target.value as ApiType)}><MenuItem value="claude">Claude</MenuItem><MenuItem value="openai-responses">OpenAI Responses API</MenuItem><MenuItem value="openai-completions">OpenAI Chat Completions</MenuItem></Select></FormControl>
        <TextField fullWidth label={copy.token} type={visibleTokens[profile.id] ? "text" : "password"} value={profile.token} onChange={(e) => update(profile.id, { token: e.target.value })} autoComplete="off" slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton edge="end" onClick={() => setVisibleTokens((current) => ({ ...current, [profile.id]: !current[profile.id] }))}>{visibleTokens[profile.id] ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}</IconButton></InputAdornment> } }} />
        <Autocomplete
          freeSolo
          options={endpointPresets}
          getOptionLabel={(option) => typeof option === "string" ? option : option.url}
          isOptionEqualToValue={(option, value) => option.url === (typeof value === "string" ? value : value.url)}
          value={profile.baseUrl}
          inputValue={profile.baseUrl}
          onInputChange={(_event, value) => changeBaseUrl(profile, value)}
          onChange={(_event, value) => changeBaseUrl(profile, typeof value === "string" ? value : value?.url || "")}
          renderOption={(props, option) => <Box component="li" {...props} key={option.url} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start !important" }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{option.label}</Typography><Typography variant="caption" color="text.secondary">{option.url}</Typography></Box>}
          renderInput={(params) => <TextField {...params} fullWidth label={copy.url} placeholder={defaults[profile.type]} helperText={profile.baseUrl ? `${copy.actualEndpoint}: ${resolveLlmEndpoint(profile.type, profile.baseUrl)}` : copy.urlHelp} />}
        />
      </Stack>
      </AccordionDetails>
    </Accordion>)}
    <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => { setProfiles((items) => [...items, emptyProfile()]); setSaved(false); }}>{copy.add}</Button>
    </>}
    {directory === "models" && <>
      {models.length === 0 && <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}><Typography>{copy.emptyModels}</Typography></Box>}
      {models.map((model, index) => <Accordion key={model.id} disableGutters sx={{ border: 1, borderColor: "divider", borderRadius: "12px !important", overflow: "hidden", boxShadow: "none", "&:before": { display: "none" } }}>
        <AccordionSummary component="div" expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.25, minHeight: 64, "& .MuiAccordionSummary-content": { minWidth: 0 } }}>
        <Box sx={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0 }}>
          {editingId === model.id ? <TextField variant="standard" value={model.name} autoFocus placeholder={`${copy.model} ${index + 1}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => updateModel(model.id, { name: e.target.value })} onBlur={() => setEditingId(null)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") setEditingId(null); }} sx={{ minWidth: 0, maxWidth: 320, flex: 1, "& .MuiInputBase-input": { fontWeight: 700 } }} /> : <Typography sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{model.name || `${copy.model} ${index + 1}`}</Typography>}
          {editingId !== model.id && <IconButton size="small" aria-label={copy.renameHint} title={copy.renameHint} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setEditingId(model.id); }} sx={{ ml: "auto", width: 40, height: 40, flexShrink: 0 }}><EditRoundedIcon fontSize="small" /></IconButton>}
          <IconButton size="small" color="error" aria-label={copy.deleteModel} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setModels((items) => items.filter((item) => item.id !== model.id)); }} sx={{ ml: editingId === model.id ? "auto" : .5, mr: 1, width: 40, height: 40, flexShrink: 0 }}><DeleteOutlineRoundedIcon /></IconButton>
        </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.25, pb: 2.25, pt: 1 }}>
        <Stack spacing={2}>
          <FormControl fullWidth><InputLabel>{copy.provider}</InputLabel><Select label={copy.provider} value={model.providerId} onChange={(e) => updateModel(model.id, { providerId: e.target.value })}>{profiles.map((provider) => <MenuItem key={provider.id} value={provider.id}>{provider.name || suggestedProfileName(provider.baseUrl, provider.type)}</MenuItem>)}</Select></FormControl>
          {(() => {
            const provider = profiles.find((item) => item.id === model.providerId);
            const directory = provider ? modelDirectories[provider.id] : undefined;
            return <Autocomplete
              freeSolo
              options={directory?.options || []}
              value={model.modelId || null}
              inputValue={model.modelId}
              loading={directory?.loading || false}
              onOpen={() => { if (provider?.baseUrl) void loadModels(provider); }}
              onInputChange={(_event, value, reason) => { if (reason === "input" || reason === "clear") updateModel(model.id, { modelId: value }); }}
              onChange={(_event, value) => updateModel(model.id, { modelId: typeof value === "string" ? value : "" })}
              renderInput={(params) => <TextField {...params} fullWidth label={copy.modelId} placeholder="gpt-5 / claude-sonnet-4-6" helperText={directory?.loading ? copy.loadingModels : directory?.error || copy.modelAutoCompleteHelp} />}
            />;
          })()}
        </Stack>
        </AccordionDetails>
      </Accordion>)}
      <Button variant="outlined" startIcon={<AddRoundedIcon />} disabled={profiles.length === 0} onClick={() => { const model = emptyModel(); model.providerId = profiles[0]?.id || ""; setModels((items) => [...items, model]); setSaved(false); }}>{copy.addModel}</Button>
      {profiles.length === 0 && <Alert severity="warning">{copy.providerRequired}</Alert>}
    </>}
    {directory === "models" && hasInvalidModels && <Alert severity="warning">{copy.incompleteModel}</Alert>}
    <Button variant="contained" onClick={save}>{copy.save}</Button>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button variant="outlined" startIcon={<CloudUploadRoundedIcon />} disabled={!auth.isAuthenticated || cloudBusy} onClick={() => setCloudMode("upload")}>{copy.cloudUpload}</Button>
      <Button variant="outlined" startIcon={<CloudDownloadRoundedIcon />} disabled={!auth.isAuthenticated || cloudBusy} onClick={() => setCloudMode("download")}>{copy.cloudDownload}</Button>
    </Stack>
    {!auth.isAuthenticated && <Alert severity="info">{copy.cloudLoginRequired}</Alert>}
    {saved && <Alert severity="success" onClose={() => setSaved(false)}>{copy.saved}</Alert>}
    {cloudNotice && <Alert severity={cloudNotice.error ? "error" : "success"} onClose={() => setCloudNotice(null)}>{cloudNotice.text}</Alert>}
    <Dialog open={cloudMode !== null} onClose={closeCloud} fullWidth maxWidth="sm">
      <DialogTitle>{cloudMode === "upload" ? copy.cloudTitleUpload : copy.cloudTitleDownload}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Alert severity="warning">{copy.cloudWarning}</Alert>
        {cloudMode === "download" && <Alert severity="error">{copy.cloudReplaceWarning}</Alert>}
        <TextField autoFocus fullWidth type="password" label={copy.cloudPassphrase} helperText={copy.cloudPassphraseHelp} value={cloudPassphrase} onChange={(event) => setCloudPassphrase(event.target.value)} autoComplete="new-password" />
      </Stack></DialogContent>
      <DialogActions><Button onClick={closeCloud} disabled={cloudBusy}>{copy.cancel}</Button><Button variant="contained" color={cloudMode === "download" ? "warning" : "primary"} disabled={cloudBusy || cloudPassphrase.length < 12} onClick={() => void syncCloud()} startIcon={cloudBusy ? <CircularProgress size={16} /> : cloudMode === "upload" ? <CloudUploadRoundedIcon /> : <CloudDownloadRoundedIcon />}>{cloudMode === "upload" ? copy.cloudUploadConfirm : copy.cloudDownloadConfirm}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
