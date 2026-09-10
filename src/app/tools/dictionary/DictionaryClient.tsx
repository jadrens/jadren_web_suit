"use client";

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

function ApiCode({ children }: { children: string }) {
  return <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: 1.5, bgcolor: "action.hover", overflowX: "auto", fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: ".82rem", lineHeight: 1.6, whiteSpace: "pre" }}><code>{children}</code></Box>;
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
  const apiCopy = locale === "zh" ? {
    params: "请求参数", required: "必填", optional: "可选", exactResponse: "精确查询响应", suggestionResponse: "前缀建议响应",
    fields: "主要字段", errors: "错误响应", caching: "缓存策略",
    wordParam: "word：需要查询的单词或短语；1–120 个可打印字符，不区分大小写，多余空格会自动合并。",
    queryParam: "q：单词或短语前缀；1–120 个可打印字符。",
    limitParam: "limit：返回数量，整数 1–50，默认 20。",
    exactFields: "query 是原始输入；lookupKey 是规范化查询键；resolvedKey 是别名解析后的词条键；isAlias 表示是否经过别名跳转；entry 是完整词条。",
    entryFields: "entry 包含 word、display_word、英美音标 pronunciation、词形 forms、顶层义项 senses、短语/习语 phrases 和解析警告 warnings。",
    searchFields: "results 中的 word 用于展示，lookupKey 用于后续精确查询；isAlias 为 true 时，target 是它指向的正式词条。",
    errorFields: "错误统一返回 { code, error }。400 表示参数无效，404 表示词条不存在，503 表示词典数据库不可用。",
    cacheText: "精确查询：浏览器 5 分钟、共享缓存 1 天。前缀建议：浏览器 1 分钟、共享缓存 1 小时。接口公开，无需登录。",
  } : {
    params: "Request parameters", required: "required", optional: "optional", exactResponse: "Exact lookup response", suggestionResponse: "Suggestion response",
    fields: "Key fields", errors: "Error responses", caching: "Caching",
    wordParam: "word: word or phrase to look up; 1–120 printable characters. Matching is case-insensitive and repeated spaces are collapsed.",
    queryParam: "q: word or phrase prefix; 1–120 printable characters.",
    limitParam: "limit: number of results, an integer from 1–50; defaults to 20.",
    exactFields: "query is the original input; lookupKey is its normalized key; resolvedKey is the entry key after alias resolution; isAlias indicates a redirect; entry is the complete dictionary entry.",
    entryFields: "entry contains word, display_word, UK/US pronunciation, forms, top-level senses, phrases/idioms, and parser warnings.",
    searchFields: "Use result.word for display and result.lookupKey for an exact lookup. When isAlias is true, target is the canonical entry.",
    errorFields: "Errors always return { code, error }. Status 400 means invalid parameters, 404 means no entry, and 503 means the dictionary database is unavailable.",
    cacheText: "Exact lookups: 5 minutes in browsers and 1 day in shared caches. Suggestions: 1 minute in browsers and 1 hour in shared caches. No authentication is required.",
  };
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

        {!embedded && <Card variant="outlined" sx={{ borderRadius: 3, mt: 4 }}><CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.apiGuide}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{copy.apiDescription}</Typography>
          <Stack spacing={2.5}>
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{copy.exactEndpoint}</Typography><ApiCode>GET /api/dictionary/oxford10c?word=apple</ApiCode><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, mb: .5 }}>{apiCopy.params}</Typography><Typography variant="body2"><strong>word ({apiCopy.required})</strong> — {apiCopy.wordParam.replace(/^word:\s*/, "")}</Typography></Box>
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{apiCopy.exactResponse} · 200</Typography><ApiCode>{`{
  "query": "apples",
  "lookupKey": "apples",
  "resolvedKey": "apple",
  "isAlias": true,
  "entry": {
    "word": "apple",
    "display_word": "apple",
    "pronunciation": { "br": "/ˈæpl/", "us": "/ˈæpl/" },
    "labels": { "cefr": "A1" },
    "forms": [],
    "sense_groups": [...],
    "senses": [...],
    "phrases": [...],
    "warnings": []
  }
}`}</ApiCode></Box>
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{apiCopy.fields}</Typography><Stack spacing={.75}><Typography variant="body2">{apiCopy.exactFields}</Typography><Typography variant="body2">{apiCopy.entryFields}</Typography></Stack></Box>
            <Divider />
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{copy.searchEndpoint}</Typography><ApiCode>GET /api/dictionary/oxford10c/search?q=exper&amp;limit=10</ApiCode><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, mb: .5 }}>{apiCopy.params}</Typography><Stack spacing={.5}><Typography variant="body2"><strong>q ({apiCopy.required})</strong> — {apiCopy.queryParam.replace(/^q:\s*/, "")}</Typography><Typography variant="body2"><strong>limit ({apiCopy.optional})</strong> — {apiCopy.limitParam.replace(/^limit:\s*/, "")}</Typography></Stack></Box>
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{apiCopy.suggestionResponse} · 200</Typography><ApiCode>{`{
  "query": "exper",
  "count": 2,
  "results": [
    { "word": "ex·peri·ence", "lookupKey": "experience", "isAlias": false, "target": null },
    { "word": "experienced", "lookupKey": "experienced", "isAlias": true, "target": "experience" }
  ]
}`}</ApiCode><Typography variant="body2" sx={{ mt: 1 }}>{apiCopy.searchFields}</Typography></Box>
            <Divider />
            <Box><Typography variant="subtitle2" sx={{ mb: .75 }}>{apiCopy.errors}</Typography><ApiCode>{`{ "code": "word_not_found", "error": "Dictionary entry not found" }`}</ApiCode><Typography variant="body2" sx={{ mt: 1 }}>{apiCopy.errorFields}</Typography></Box>
            <Box><Typography variant="subtitle2" sx={{ mb: .5 }}>{apiCopy.caching}</Typography><Typography variant="body2">{apiCopy.cacheText}</Typography></Box>
          </Stack>
        </CardContent></Card>}
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
