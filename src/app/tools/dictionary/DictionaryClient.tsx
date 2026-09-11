"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, InputAdornment, Stack, TextField, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import Footer from "@components/ui/layout/Footer";
import { toast } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

interface Example { en?: string | null; zh?: string | null }
interface Reference { target?: string; display_target?: string }
interface Sense {
  key: string; number?: string | null; pos?: string | null;
  definition_en?: string | null; definition_zh?: string | null;
  examples?: Example[]; grammar?: string[]; patterns?: string[];
  registers?: string[]; refs?: Reference[];
  group?: { en?: string | null; zh?: string | null };
}
interface Phrase {
  key: string; type?: string; phrase: string; display_phrase?: string | null;
  senses?: Sense[];
}
interface Entry {
  word: string; display_word?: string | null;
  pronunciation?: { br?: string | null; us?: string | null };
  labels?: Record<string, unknown>; forms?: string[]; senses?: Sense[]; phrases?: Phrase[];
}
interface LookupResult { query: string; lookupKey: string; resolvedKey: string; isAlias: boolean; entry: Entry }
interface Suggestion { word: string; lookupKey: string; isAlias: boolean; target: string | null }

const POS: Record<string, { en: string; zh: string }> = {
  noun: { en: "noun", zh: "名词" }, verb: { en: "verb", zh: "动词" },
  adjective: { en: "adjective", zh: "形容词" }, adverb: { en: "adverb", zh: "副词" },
  preposition: { en: "preposition", zh: "介词" }, conjunction: { en: "conjunction", zh: "连词" },
  pronoun: { en: "pronoun", zh: "代词" }, exclamation: { en: "exclamation", zh: "感叹词" },
  determiner: { en: "determiner", zh: "限定词" }, abbreviation: { en: "abbreviation", zh: "缩写" },
};

function cleanDisplayWord(value: string) {
  return value.replace(/[ˈˌ·]/g, "");
}

function SenseView({ sense, labels }: { sense: Sense; labels: { examples: string; reference: string } }) {
  const meta = [...(sense.grammar || []), ...(sense.patterns || []), ...(sense.registers || [])];
  return <Box sx={{ display: "grid", gridTemplateColumns: "minmax(22px, auto) 1fr", gap: 1.25, py: 1.5 }}>
    <Typography color="text.secondary" sx={{ fontWeight: 700 }}>{sense.number || "•"}</Typography>
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      {sense.definition_en && <Typography sx={{ fontWeight: 600 }}>{sense.definition_en}</Typography>}
      {sense.definition_zh && <Typography color="text.secondary">{sense.definition_zh}</Typography>}
      {meta.length > 0 && <Stack direction="row" useFlexGap spacing={0.75} sx={{ flexWrap: "wrap" }}>{meta.map((item, index) => <Chip key={`${item}-${index}`} size="small" variant="outlined" label={item} />)}</Stack>}
      {(sense.examples || []).length > 0 && <Box sx={{ pl: 1.5, mt: 0.5, borderLeft: 2, borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{labels.examples}</Typography>
        {(sense.examples || []).map((example, index) => <Box key={index} sx={{ mt: 0.5 }}>
          {example.en && <Typography variant="body2" sx={{ fontStyle: "italic" }}>{example.en}</Typography>}
          {example.zh && <Typography variant="body2" color="text.secondary">{example.zh}</Typography>}
        </Box>)}
      </Box>}
      {(sense.refs || []).length > 0 && <Typography variant="body2" color="text.secondary">
        {labels.reference}: {(sense.refs || []).map(ref => cleanDisplayWord(ref.display_target || ref.target || "")).filter(Boolean).join(" · ")}
      </Typography>}
    </Stack>
  </Box>;
}

export function DictionaryLookup({ initialWord = "", embedded = false }: { initialWord?: string; embedded?: boolean }) {
  const { t, locale } = useI18n();
  const copy = t.tools.dictionary;
  const [input, setInput] = useState(initialWord);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const initialLookupRef = useRef(false);

  useEffect(() => {
    const query = input.trim();
    if (!query || query.length > 120) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/dictionary/oxford10c/search?q=${encodeURIComponent(query)}&limit=10`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { results?: Suggestion[] };
        setSuggestions(data.results || []);
      } catch { /* Suggestions are optional. */ }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [input]);

  const lookup = async (rawValue = input) => {
    const query = rawValue.trim();
    if (!query || query.length > 120) { toast.warning(copy.invalid); return; }
    const request = ++requestRef.current;
    setInput(query); setLoading(true);
    try {
      const response = await fetch(`/api/dictionary/oxford10c?word=${encodeURIComponent(query)}`);
      const data = await response.json() as LookupResult | { code?: string };
      if (request !== requestRef.current) return;
      if (!response.ok) {
        setResult(null);
        toast[response.status === 404 ? "info" : response.status === 400 ? "warning" : "error"](
          response.status === 404 ? copy.noResults : response.status === 400 ? copy.invalid : copy.unavailable,
        );
        return;
      }
      setResult(data as LookupResult);
    } catch {
      if (request === requestRef.current) toast.error(copy.unavailable);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialWord.trim() || initialLookupRef.current) return;
    initialLookupRef.current = true;
    const timer = window.setTimeout(() => void lookup(initialWord), 0);
    return () => window.clearTimeout(timer);
  // The initial word is intentionally looked up only once per mounted panel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWord]);

  const submit = (event: FormEvent) => { event.preventDefault(); void lookup(); };
  const groupedSenses = useMemo(() => {
    const groups = new Map<string, Sense[]>();
    for (const sense of result?.entry.senses || []) {
      const key = sense.pos || "other";
      groups.set(key, [...(groups.get(key) || []), sense]);
    }
    return [...groups.entries()];
  }, [result]);

  return <>
    <Box component={embedded ? "div" : "main"} className={embedded ? undefined : "page-below-navbar"} sx={{ flex: 1, px: embedded ? 0 : 3, py: embedded ? 0 : { xs: 5, md: 8 } }}>
      <Box sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
        <Box component="form" onSubmit={submit} sx={{ display: "flex", gap: 1, mb: 4 }}>
          <Autocomplete<Suggestion, false, false, true>
            freeSolo fullWidth options={suggestions} filterOptions={options => options}
            getOptionLabel={option => typeof option === "string" ? cleanDisplayWord(option) : cleanDisplayWord(option.word)}
            inputValue={input} onInputChange={(_event, value) => { setInput(value); if (!value.trim()) setSuggestions([]); }}
            onChange={(_event, value) => { if (value) void lookup(typeof value === "string" ? cleanDisplayWord(value) : value.lookupKey); }}
            renderOption={(props, option) => <li {...props} key={`${option.lookupKey}-${option.target || "entry"}`}>
              <Box sx={{ minWidth: 0 }}><Typography>{cleanDisplayWord(option.word)}</Typography>{option.isAlias && option.target && <Typography variant="caption" color="text.secondary">→ {cleanDisplayWord(option.target)}</Typography>}</Box>
            </li>}
            renderInput={params => <TextField
              {...params}
              autoFocus
              placeholder={copy.placeholder}
              slotProps={{
                ...params.slotProps,
                input: {
                  ...params.slotProps.input,
                  startAdornment: <InputAdornment position="start"><SearchRoundedIcon color="action" /></InputAdornment>,
                },
                htmlInput: { ...params.slotProps.htmlInput, maxLength: 120, "aria-label": copy.placeholder },
              }}
            />}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading || !input.trim()} sx={{ minWidth: { xs: 52, sm: 112 }, px: { xs: 1.5, sm: 3 } }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : <><SearchRoundedIcon sx={{ display: { sm: "none" } }} /><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>{copy.search}</Box></>}
          </Button>
        </Box>

        {!result && !loading && <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ py: 7, textAlign: "center" }}>
          <Typography color="text.secondary">{copy.startHint}</Typography>
        </CardContent></Card>}

        {result && <Stack spacing={3}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
              <Box>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{cleanDisplayWord(result.entry.display_word || result.entry.word)}</Typography>
                {result.isAlias && <Typography variant="body2" color="text.secondary">{copy.alias}: {result.query}</Typography>}
              </Box>
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
                {result.entry.pronunciation?.br && <Box><Typography variant="caption" color="text.secondary">{copy.british}</Typography><Typography>{result.entry.pronunciation.br}</Typography></Box>}
                {result.entry.pronunciation?.us && <Box><Typography variant="caption" color="text.secondary">{copy.american}</Typography><Typography>{result.entry.pronunciation.us}</Typography></Box>}
              </Stack>
            </Stack>
            {Object.entries(result.entry.labels || {}).length > 0 && <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
              {Object.entries(result.entry.labels || {}).filter(([, value]) => Boolean(value)).map(([key, value]) => <Chip key={key} size="small" label={value === true ? key.toUpperCase() : `${key.toUpperCase()} ${String(value)}`} />)}
            </Stack>}
            {(result.entry.forms || []).length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}><strong>{copy.wordForms}:</strong> {result.entry.forms?.join(" · ")}</Typography>}
          </CardContent></Card>

          {groupedSenses.map(([pos, senses]) => <Card key={pos} variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Typography variant="h6" color="primary" sx={{ fontStyle: "italic", fontWeight: 700 }}>{POS[pos]?.[locale] || pos}</Typography>
            <Divider sx={{ my: 1 }} />
            {senses.map(sense => <SenseView key={sense.key} sense={sense} labels={copy} />)}
          </CardContent></Card>)}

          {(result.entry.phrases || []).length > 0 && <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.phrases}</Typography><Divider sx={{ my: 1 }} />
            <Stack divider={<Divider flexItem />}>
              {(result.entry.phrases || []).map(phrase => <Box key={phrase.key} sx={{ py: 2 }}>
                <Typography sx={{ fontWeight: 700, color: "primary.main" }}>{cleanDisplayWord(phrase.display_phrase || phrase.phrase)}</Typography>
                {(phrase.senses || []).map(sense => <SenseView key={sense.key} sense={sense} labels={copy} />)}
              </Box>)}
            </Stack>
          </CardContent></Card>}
        </Stack>}

        {!embedded && <Box sx={{ mt: 3, textAlign: "right" }}><Button component={Link} href="/docs/dictionary" size="small">{locale === "zh" ? "查看词典 API 文档 →" : "Dictionary API documentation →"}</Button></Box>}
      </Box>
    </Box>
    {!embedded && <Footer />}
  </>;
}

export default function DictionaryClient() {
  const { t } = useI18n();
  useDocumentTitle(t.tools.dictionary.title);
  return <DictionaryLookup />;
}
