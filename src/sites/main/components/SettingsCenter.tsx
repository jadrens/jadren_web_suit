"use client";

import { useEffect, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Divider, Radio, Stack, TextField, Typography } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PublicIcon from "@mui/icons-material/Public";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import { useTheme } from "@shared/theme/ThemeProvider";
import { COORDINATES_KEY, SOLAR_KEY, SolarCache, ThemeCoordinates, ThemeMode } from "@shared/theme/settings";
import { useI18n } from "@shared/libs/i18n/main";
import LlmApiProfiles from "./LlmApiProfiles";

const valid = (lat: number, lon: number) => Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;

export default function SettingsCenter() {
  const { mode, setMode, refreshTheme } = useTheme();
  const { t } = useI18n();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [source, setSource] = useState<ThemeCoordinates["source"]>();
  const [solar, setSolar] = useState<SolarCache | null>(null);
  const [busy, setBusy] = useState<"geo" | "ip" | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [section, setSection] = useState<"theme" | "llm">("theme");

  useEffect(() => {
    try {
      const coordinates = JSON.parse(localStorage.getItem(COORDINATES_KEY) || "null") as ThemeCoordinates | null;
      if (coordinates) { setLatitude(String(coordinates.latitude)); setLongitude(String(coordinates.longitude)); setSource(coordinates.source); }
      setSolar(JSON.parse(localStorage.getItem(SOLAR_KEY) || "null"));
    } catch { /* old invalid local data is ignored */ }
  }, []);

  const save = (coordinates: ThemeCoordinates) => {
    localStorage.setItem(COORDINATES_KEY, JSON.stringify(coordinates));
    localStorage.removeItem(SOLAR_KEY);
    setLatitude(String(coordinates.latitude)); setLongitude(String(coordinates.longitude)); setSource(coordinates.source);
    setMode("automatic");
    setTimeout(() => { refreshTheme(); try { setSolar(JSON.parse(localStorage.getItem(SOLAR_KEY) || "null")); } catch { setSolar(null); } }, 0);
    setNotice({ error: false, text: t.settings.saved });
  };
  const saveManual = () => {
    const lat = Number(latitude), lon = Number(longitude);
    if (!valid(lat, lon)) return setNotice({ error: true, text: t.settings.invalid });
    save({ latitude: lat, longitude: lon, source: "manual" });
  };
  const geolocate = () => {
    if (!navigator.geolocation) return setNotice({ error: true, text: t.settings.locationFailed });
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(({ coords }) => { setBusy(null); save({ latitude: coords.latitude, longitude: coords.longitude, source: "geolocation" }); }, () => { setBusy(null); setNotice({ error: true, text: t.settings.locationFailed }); }, { timeout: 10000 });
  };
  const locateIp = async () => {
    setBusy("ip");
    try {
      const response = await fetch("https://ipwho.is/");
      const data = await response.json() as { success?: boolean; latitude?: number; longitude?: number };
      const lat = Number(data.latitude), lon = Number(data.longitude);
      if (!response.ok || data.success === false || !valid(lat, lon)) throw new Error();
      save({ latitude: lat, longitude: lon, source: "ip" });
    } catch { setNotice({ error: true, text: t.settings.ipFailed }); } finally { setBusy(null); }
  };
  const time = (timestamp: number) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(timestamp);

  const modes: Array<{ value: ThemeMode; label: string }> = [
    { value: "automatic", label: t.settings.automatic },
    { value: "system", label: t.settings.system },
    { value: "manual", label: t.settings.manual },
  ];

  const themeOptions = <>
    <Stack spacing={1.25}>
      {modes.map((item) => <Card key={item.value} variant="outlined" sx={{ borderRadius: 2.5, borderColor: mode === item.value ? "primary.main" : "divider", bgcolor: mode === item.value ? "action.selected" : "transparent", transition: "border-color .2s, background-color .2s" }}>
        <CardActionArea onClick={() => setMode(item.value)} sx={{ px: 2, py: 1.5, display: "flex", justifyContent: "space-between" }}>
          <Typography fontWeight={mode === item.value ? 700 : 500}>{item.label}</Typography>
          <Radio checked={mode === item.value} value={item.value} tabIndex={-1} disableRipple />
        </CardActionArea>
      </Card>)}
    </Stack>
    {mode === "automatic" && <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 3 }} />
      <Typography variant="h6" fontWeight={700}>{t.settings.location}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t.settings.locationHelp}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField type="number" fullWidth label={t.settings.latitude} value={latitude} onChange={(e) => setLatitude(e.target.value)} /><TextField type="number" fullWidth label={t.settings.longitude} value={longitude} onChange={(e) => setLongitude(e.target.value)} /></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}><Button variant="contained" onClick={saveManual}>{t.settings.save}</Button><Button variant="outlined" disabled={!!busy} startIcon={busy === "geo" ? <CircularProgress size={16} /> : <MyLocationIcon />} onClick={geolocate}>{t.settings.useLocation}</Button><Button variant="outlined" disabled={!!busy} startIcon={busy === "ip" ? <CircularProgress size={16} /> : <PublicIcon />} onClick={locateIp}>{t.settings.useIp}</Button></Stack>
      {source && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{t.settings.source}: {t.settings.sources[source]}</Typography>}
      {solar && <Alert severity="info" sx={{ mt: 2 }}>{t.settings.solar.replace("{sunrise}", time(solar.sunrise)).replace("{sunset}", time(solar.sunset))}</Alert>}
    </Box>}
    {notice && <Alert severity={notice.error ? "error" : "success"} onClose={() => setNotice(null)} sx={{ mt: 2 }}>{notice.text}</Alert>}
  </>;

  return <Box sx={{ width: "100%", maxWidth: 980 }}>
    <Typography component="h1" variant="h4" fontWeight={700} sx={{ mb: 1 }}>{t.settings.title}</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>{t.settings.description}</Typography>

    <Accordion disableGutters sx={{ display: { xs: "block", md: "none" }, border: 1, borderColor: "divider", borderRadius: "16px !important", overflow: "hidden", boxShadow: "none", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2, minHeight: 72, bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><DarkModeRoundedIcon /></Box><Box><Typography fontWeight={700}>{t.theme.toggle}</Typography><Typography variant="caption" color="text.secondary">{modes.find((item) => item.value === mode)?.label}</Typography></Box></Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pb: 2.5, pt: 1 }}>{themeOptions}</AccordionDetails>
    </Accordion>
    <Accordion disableGutters sx={{ display: { xs: "block", md: "none" }, mt: 1.5, border: 1, borderColor: "divider", borderRadius: "16px !important", overflow: "hidden", boxShadow: "none", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 2, minHeight: 72, bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><SmartToyRoundedIcon /></Box><Box><Typography fontWeight={700}>{t.settings.llm.title}</Typography><Typography variant="caption" color="text.secondary">{t.settings.llm.subtitle}</Typography></Box></Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2, pb: 2.5, pt: 1 }}><LlmApiProfiles /></AccordionDetails>
    </Accordion>

    <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "240px minmax(0, 1fr)", gap: 2.5, alignItems: "start" }}>
      <Card variant="outlined" sx={{ borderRadius: 3, position: "sticky", top: 24, overflow: "hidden" }}>
        <CardActionArea onClick={() => setSection("theme")} sx={{ p: 2, display: "flex", justifyContent: "flex-start", gap: 1.5, bgcolor: section === "theme" ? "action.selected" : "transparent" }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><DarkModeRoundedIcon /></Box>
          <Box sx={{ flex: 1 }}><Typography fontWeight={700}>{t.theme.toggle}</Typography><Typography variant="caption" color="text.secondary">{modes.find((item) => item.value === mode)?.label}</Typography></Box>
          <ChevronRightRoundedIcon color="action" />
        </CardActionArea>
        <Divider />
        <CardActionArea onClick={() => setSection("llm")} sx={{ p: 2, display: "flex", justifyContent: "flex-start", gap: 1.5, bgcolor: section === "llm" ? "action.selected" : "transparent" }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", color: "primary.main", bgcolor: "action.hover" }}><SmartToyRoundedIcon /></Box>
          <Box sx={{ flex: 1 }}><Typography fontWeight={700}>{t.settings.llm.title}</Typography><Typography variant="caption" color="text.secondary">{t.settings.llm.subtitle}</Typography></Box>
          <ChevronRightRoundedIcon color="action" />
        </CardActionArea>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}><CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>{section === "theme" ? t.theme.toggle : t.settings.llm.title}</Typography>
        {section === "theme" ? themeOptions : <LlmApiProfiles />}
      </CardContent></Card>
    </Box>
  </Box>;
}
