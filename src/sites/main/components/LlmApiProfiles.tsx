"use client";

import { useEffect, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Autocomplete, Box, Button, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { useI18n } from "@shared/libs/i18n/main";
import { resolveLlmEndpoint } from "@shared/libs/llm";
import { useUnsavedChanges } from "@shared/hooks/useUnsavedChanges";

type ApiType = "claude" | "openai-responses" | "openai-completions";
interface LlmProfile { id: string; name: string; type: ApiType; token: string; baseUrl: string }
interface LlmModel { id: string; name: string; modelId: string; providerId: string }
const STORAGE_KEY = "llm-api-profiles";
const MODELS_STORAGE_KEY = "llm-api-models";
const defaults: Record<ApiType, string> = {
  claude: "https://api.anthropic.com",
  "openai-responses": "https://api.openai.com/v1",
  "openai-completions": "https://api.openai.com/v1",
};
const endpointPresets = [
  { label: "OpenAI / ChatGPT", url: "https://api.openai.com/v1" },
  { label: "Claude / Anthropic", url: "https://api.anthropic.com/v1" },
  { label: "DeepSeek", url: "https://api.deepseek.com/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
];

const createProfileId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const emptyProfile = (): LlmProfile => ({ id: createProfileId(), name: "", type: "openai-responses", token: "", baseUrl: defaults["openai-responses"] });
const emptyModel = (): LlmModel => ({ id: createProfileId(), name: "", modelId: "", providerId: "" });

export default function LlmApiProfiles() {
  const { t } = useI18n();
  const copy = t.settings.llm;
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [directory, setDirectory] = useState<"providers" | "models">("providers");
  const [loaded, setLoaded] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const snapshot = JSON.stringify({ profiles, models });
  const isDirty = loaded && snapshot !== savedSnapshot;
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
  const changeType = (profile: LlmProfile, type: ApiType) => update(profile.id, { type, baseUrl: !profile.baseUrl || Object.values(defaults).includes(profile.baseUrl) ? defaults[type] : profile.baseUrl });
  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    localStorage.setItem(MODELS_STORAGE_KEY, JSON.stringify(models));
    setSavedSnapshot(JSON.stringify({ profiles, models }));
    setSaved(true);
  };
  const updateModel = (id: string, patch: Partial<LlmModel>) => setModels((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  return <Stack spacing={2}>
    <Alert severity="info" icon={<LockRoundedIcon />}>{copy.privacy}</Alert>
    <Tabs value={directory} onChange={(_event, value) => setDirectory(value)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tab value="providers" label={copy.providerList} />
      <Tab value="models" label={copy.modelList} />
    </Tabs>
    {directory === "providers" && <>
    {profiles.length === 0 && <Box sx={{ py: 3, textAlign: "center", color: "text.secondary" }}><Typography>{copy.empty}</Typography></Box>}
    {profiles.map((profile, index) => <Accordion key={profile.id} disableGutters sx={{ border: 1, borderColor: "divider", borderRadius: "12px !important", overflow: "hidden", boxShadow: "none", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.25, minHeight: 64, "& .MuiAccordionSummary-content": { minWidth: 0 } }}>
      <Box sx={{ width: "100%", display: "flex", alignItems: "center", minWidth: 0 }}>
        {editingId === profile.id ? <TextField
          variant="standard"
          value={profile.name}
          autoFocus
          placeholder={`${copy.profile} ${index + 1}`}
          onChange={(e) => update(profile.id, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => setEditingId(null)}
          onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null); if (e.key === "Escape") setEditingId(null); }}
          slotProps={{ htmlInput: { "aria-label": copy.name } }}
          sx={{ minWidth: 0, maxWidth: 320, flex: 1, "& .MuiInputBase-input": { fontWeight: 700 } }}
        /> : <Typography
          fontWeight={700}
          title={copy.renameHint}
          onDoubleClick={() => setEditingId(profile.id)}
          sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 4 }}
        >{profile.name || `${copy.profile} ${index + 1}`}</Typography>}
        <IconButton size="small" color="error" aria-label={copy.delete} onClick={(e) => { e.stopPropagation(); setProfiles((items) => items.filter((item) => item.id !== profile.id)); }} onFocus={(e) => e.stopPropagation()} sx={{ ml: "auto", mr: 1, flexShrink: 0 }}><DeleteOutlineRoundedIcon /></IconButton>
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
          onInputChange={(_event, value) => update(profile.id, { baseUrl: value })}
          onChange={(_event, value) => update(profile.id, { baseUrl: typeof value === "string" ? value : value?.url || "" })}
          renderOption={(props, option) => <Box component="li" {...props} key={option.url} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start !important" }}><Typography variant="body2" fontWeight={700}>{option.label}</Typography><Typography variant="caption" color="text.secondary">{option.url}</Typography></Box>}
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
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2.25, minHeight: 64, "& .MuiAccordionSummary-content": { minWidth: 0 } }}>
        <Box sx={{ display: "flex", alignItems: "center", width: "100%", minWidth: 0 }}>
          {editingId === model.id ? <TextField variant="standard" value={model.name} autoFocus placeholder={`${copy.model} ${index + 1}`} onClick={(e) => e.stopPropagation()} onChange={(e) => updateModel(model.id, { name: e.target.value })} onBlur={() => setEditingId(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingId(null); }} sx={{ minWidth: 0, maxWidth: 320, flex: 1, "& .MuiInputBase-input": { fontWeight: 700 } }} /> : <Typography fontWeight={700} title={copy.renameHint} onDoubleClick={() => setEditingId(model.id)} sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 4 }}>{model.name || `${copy.model} ${index + 1}`}</Typography>}
          <IconButton size="small" color="error" aria-label={copy.deleteModel} onClick={(e) => { e.stopPropagation(); setModels((items) => items.filter((item) => item.id !== model.id)); }} sx={{ ml: "auto", mr: 1 }}><DeleteOutlineRoundedIcon /></IconButton>
        </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.25, pb: 2.25, pt: 1 }}>
        <Stack spacing={2}>
          <FormControl fullWidth><InputLabel>{copy.provider}</InputLabel><Select label={copy.provider} value={model.providerId} onChange={(e) => updateModel(model.id, { providerId: e.target.value })}>{profiles.map((provider, providerIndex) => <MenuItem key={provider.id} value={provider.id}>{provider.name || `${copy.profile} ${providerIndex + 1}`}</MenuItem>)}</Select></FormControl>
          <TextField fullWidth label={copy.modelId} value={model.modelId} onChange={(e) => updateModel(model.id, { modelId: e.target.value })} placeholder="gpt-5 / claude-sonnet-4-6" />
        </Stack>
        </AccordionDetails>
      </Accordion>)}
      <Button variant="outlined" startIcon={<AddRoundedIcon />} disabled={profiles.length === 0} onClick={() => { const model = emptyModel(); model.providerId = profiles[0]?.id || ""; setModels((items) => [...items, model]); setSaved(false); }}>{copy.addModel}</Button>
      {profiles.length === 0 && <Alert severity="warning">{copy.providerRequired}</Alert>}
    </>}
    <Button variant="contained" onClick={save}>{copy.save}</Button>
    {saved && <Alert severity="success" onClose={() => setSaved(false)}>{copy.saved}</Alert>}
  </Stack>;
}
