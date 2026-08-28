"use client";

import { useState, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Drawer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  LinearProgress,
  Tooltip,
  IconButton,
  useTheme,
  Divider,
  Alert,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import VerifiedIcon from "@mui/icons-material/Verified";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import { alpha } from "@mui/material";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@tool/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueryResult {
  id?: number;
  query_type: string;
  client_ip: string;
  country_code: string;
  city: string;
  edns_subnet: string | null;
  edns_country_code: string | null;
  nsid: string | null;
  created_at: string;
}

interface IpGeolocation {
  query: string;
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  district: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  offset: number;
  isp: string;
  org: string;
  as: string;
  asname: string;
  reverse: string;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
}

interface RowState {
  domain: string;
  found: boolean;
  queries: QueryResult[];
  loading: boolean;
  geoLoading: boolean;
  geoData: IpGeolocation | null;
  geoError: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateDomains(count: number): string[] {
  const now = Date.now();
  const salt = Math.random().toString(36).slice(2, 8);
  const domains: string[] = [];
  for (let i = 0; i < count; i++) {
    domains.push(`${now.toString(36)}${salt}${i.toString(36)}.track.rayne.cn`);
  }
  return domains;
}

function countryFlag(code: string): string {
  if (!code || code === "unknown") return "🏳️";
  const upper = code.toUpperCase();
  const a = 0x1f1e6;
  const c0 = upper.charCodeAt(0);
  const c1 = upper.charCodeAt(1);
  if (c0 < 65 || c0 > 90 || c1 < 65 || c1 > 90) return "🏳️";
  return String.fromCodePoint(a + c0 - 65, a + c1 - 65);
}

const COUNTRY_NAMES: Record<string, string> = {
  AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua & Barbuda",
  AL: "Albania", AM: "Armenia", AO: "Angola", AR: "Argentina", AT: "Austria",
  AU: "Australia", AZ: "Azerbaijan", BA: "Bosnia & Herzegovina", BB: "Barbados",
  BD: "Bangladesh", BE: "Belgium", BF: "Burkina Faso", BG: "Bulgaria",
  BH: "Bahrain", BI: "Burundi", BJ: "Benin", BN: "Brunei", BO: "Bolivia",
  BR: "Brazil", BS: "Bahamas", BT: "Bhutan", BW: "Botswana", BY: "Belarus",
  BZ: "Belize", CA: "Canada", CD: "Congo DR", CF: "Central African Republic",
  CG: "Congo", CH: "Switzerland", CI: "Côte d'Ivoire", CL: "Chile",
  CM: "Cameroon", CN: "China", CO: "Colombia", CR: "Costa Rica", CU: "Cuba",
  CV: "Cape Verde", CY: "Cyprus", CZ: "Czech Republic", DE: "Germany",
  DJ: "Djibouti", DK: "Denmark", DM: "Dominica", DO: "Dominican Republic",
  DZ: "Algeria", EC: "Ecuador", EE: "Estonia", EG: "Egypt", ER: "Eritrea",
  ES: "Spain", ET: "Ethiopia", FI: "Finland", FJ: "Fiji", FR: "France",
  GA: "Gabon", GB: "United Kingdom", GD: "Grenada", GE: "Georgia",
  GH: "Ghana", GM: "Gambia", GN: "Guinea", GQ: "Equatorial Guinea",
  GR: "Greece", GT: "Guatemala", GW: "Guinea-Bissau", GY: "Guyana",
  HK: "Hong Kong", HN: "Honduras", HR: "Croatia", HT: "Haiti",
  HU: "Hungary", ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India",
  IQ: "Iraq", IR: "Iran", IS: "Iceland", IT: "Italy", JM: "Jamaica",
  JO: "Jordan", JP: "Japan", KE: "Kenya", KG: "Kyrgyzstan", KH: "Cambodia",
  KI: "Kiribati", KM: "Comoros", KN: "St. Kitts & Nevis", KR: "South Korea",
  KW: "Kuwait", KZ: "Kazakhstan", LA: "Laos", LB: "Lebanon", LC: "St. Lucia",
  LI: "Liechtenstein", LK: "Sri Lanka", LR: "Liberia", LS: "Lesotho",
  LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", LY: "Libya", MA: "Morocco",
  MC: "Monaco", MD: "Moldova", ME: "Montenegro", MG: "Madagascar",
  MK: "North Macedonia", ML: "Mali", MM: "Myanmar", MN: "Mongolia",
  MR: "Mauritania", MT: "Malta", MU: "Mauritius", MV: "Maldives",
  MW: "Malawi", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique",
  NA: "Namibia", NE: "Niger", NG: "Nigeria", NI: "Nicaragua", NL: "Netherlands",
  NO: "Norway", NP: "Nepal", NZ: "New Zealand", OM: "Oman", PA: "Panama",
  PE: "Peru", PG: "Papua New Guinea", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PT: "Portugal", PY: "Paraguay", QA: "Qatar", RO: "Romania",
  RS: "Serbia", RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia",
  SB: "Solomon Islands", SC: "Seychelles", SD: "Sudan", SE: "Sweden",
  SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SL: "Sierra Leone",
  SM: "San Marino", SN: "Senegal", SO: "Somalia", SR: "Suriname",
  SS: "South Sudan", ST: "Sao Tome & Principe", SV: "El Salvador",
  SY: "Syria", SZ: "Eswatini", TD: "Chad", TG: "Togo", TH: "Thailand",
  TJ: "Tajikistan", TL: "Timor-Leste", TM: "Turkmenistan", TN: "Tunisia",
  TO: "Tonga", TR: "Turkey", TT: "Trinidad & Tobago", TV: "Tuvalu",
  TW: "Taiwan", TZ: "Tanzania", UA: "Ukraine", UG: "Uganda",
  US: "United States", UY: "Uruguay", UZ: "Uzbekistan", VA: "Vatican City",
  VC: "St. Vincent & Grenadines", VE: "Venezuela", VN: "Vietnam",
  VU: "Vanuatu", WS: "Samoa", YE: "Yemen", ZA: "South Africa",
  ZM: "Zambia", ZW: "Zimbabwe",
};

function countryLabel(code: string): string {
  if (!code || code === "unknown") return "Unknown";
  const name = COUNTRY_NAMES[code.toUpperCase()];
  return name
    ? `${countryFlag(code)} ${name} (${code.toUpperCase()})`
    : `${countryFlag(code)} ${code.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "idle" | "probing" | "streaming";

export default function DnsLeakClient() {
  const { t } = useI18n();
  const theme = useTheme();

  const [phase, setPhase] = useState<Phase>("idle");
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [probeProgress, setProbeProgress] = useState(0);
  const [geoDrawerDomain, setGeoDrawerDomain] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const geoCacheRef = useRef<Record<string, Promise<IpGeolocation | null>>>({});

  // ── pick IP for geo: EDNS subnet IP first, then DNS client IP ──
  const pickIp = useCallback((q: QueryResult): string | null => {
    if (q.edns_subnet) return q.edns_subnet.split("/")[0];
    if (q.client_ip) return q.client_ip;
    return null;
  }, []);

  // ── fetch geo for one IP, update the row ──
  // Uses geoCacheRef to deduplicate concurrent requests for the same IP
  const fetchGeo = useCallback(
    async (domain: string, ip: string) => {
      setRows((prev) =>
        prev.map((r) =>
          r.domain === domain ? { ...r, geoLoading: true, geoError: null } : r,
        ),
      );

      // If this IP has no in-flight request yet, create one and cache the Promise
      if (!geoCacheRef.current[ip]) {
        geoCacheRef.current[ip] = (async (): Promise<IpGeolocation | null> => {
          try {
            // Use our own API proxy to avoid mixed-content errors
            // (ip-api.com only supports HTTP, so the browser can't call it directly on an HTTPS page)
            const res = await fetch(
              `/api/ip-geo?ip=${encodeURIComponent(ip)}`,
              { signal: AbortSignal.timeout(10000) },
            );
            if (res.ok) {
              return await res.json();
            }
          } catch {
            // ignore, geo is best-effort
          }
          return null;
        })();
      }

      // All domains sharing the same IP await the same Promise
      const data = await geoCacheRef.current[ip];

      setRows((prev) =>
        prev.map((r) =>
          r.domain === domain
            ? { ...r, geoLoading: false, geoData: data, geoError: data ? null : "Unavailable" }
            : r,
        ),
      );
    },
    [],
  );

  // ── fetch one domain's DNS-leak result ──
  const fetchDomainResult = useCallback(
    async (domain: string) => {
      try {
        const res = await fetch("/api/dns-leak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domains: [domain] }),
        });
        const data = await res.json();
        const item = data.results?.[0];
        if (item && item.found && item.queries.length > 0) {
          setRows((prev) =>
            prev.map((r) =>
              r.domain === domain
                ? { ...r, found: true, queries: item.queries, loading: false }
                : r,
            ),
          );
          const ip = pickIp(item.queries[0]);
          if (ip) fetchGeo(domain, ip);
        } else {
          setRows((prev) =>
            prev.map((r) =>
              r.domain === domain
                ? { ...r, found: item?.found ?? false, loading: false }
                : r,
            ),
          );
        }
      } catch {
        setRows((prev) =>
          prev.map((r) =>
            r.domain === domain ? { ...r, loading: false } : r,
          ),
        );
      }
    },
    [fetchGeo, pickIp],
  );

  // ── start test ──
  const startTest = useCallback(async () => {
    abortRef.current?.abort();
    geoCacheRef.current = {}; // 清空 IP 地理信息缓存，避免干扰下一次测试
    setError(null);
    setProbeProgress(0);
    setPhase("probing");

    const newDomains = generateDomains(10);

    // initialise rows
    const initialRows: RowState[] = newDomains.map((d) => ({
      domain: d,
      found: false,
      queries: [],
      loading: true,
      geoLoading: false,
      geoData: null,
      geoError: null,
    }));
    setRows(initialRows);

    // ── step 1: fire all Image probes ──
    let completed = 0;
    const probes = newDomains.map(
      (domain) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.src = `https://${domain}/probe.png?t=${Date.now()}&r=${Math.random()}`;
          const done = () => {
            completed++;
            setProbeProgress(Math.round((completed / newDomains.length) * 100));
            resolve();
          };
          img.onload = done;
          img.onerror = done;
          setTimeout(done, 8000);
        }),
    );
    await Promise.all(probes);

    // ── step 2: wait 1s then fire 10 individual API calls ──
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setPhase("streaming");
    newDomains.forEach((domain) => fetchDomainResult(domain));
  }, [fetchDomainResult]);

  // ── derived ──
  // Always show EDNS columns — display "—" when values are null
  const hasEdns = true;

  const allCountries = rows
    .flatMap((r) => r.queries.map((q) => q.country_code))
    .filter((c, i, arr) => c && c !== "unknown" && arr.indexOf(c) === i);

  const ednsCountries = rows
    .flatMap((r) => r.queries.map((q) => q.edns_country_code))
    .filter((c): c is string => !!c && c !== "unknown")
    .filter((c, i, arr) => arr.indexOf(c) === i);

  const hasLeak = allCountries.length > 1;
  const allDone = rows.length > 0 && rows.every((r) => !r.loading);

  // ── inline geo chip renderer (click to open drawer) ──
  const renderGeoCell = (row: RowState) => {
    if (row.geoLoading) {
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <CircularProgress size={12} />
          <Typography variant="caption" color="text.secondary">
            Geo...
          </Typography>
        </Box>
      );
    }
    if (row.geoError || !row.geoData) {
      return (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      );
    }
    const g = row.geoData;
    return (
      <Chip
        icon={<Typography sx={{ fontSize: 14 }}>{countryFlag(g.countryCode)}</Typography>}
        label={`${g.city || g.country} · ${g.isp || g.org || "—"}`}
        size="small"
        variant="outlined"
        onClick={() => setGeoDrawerDomain(row.domain)}
        sx={{
          borderRadius: 2,
          maxWidth: 220,
          cursor: "pointer",
          "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
        }}
      />
    );
  };

  // ── geo detail drawer ──
  const geoDrawerRow = rows.find((r) => r.domain === geoDrawerDomain);
  const geoDrawerData = geoDrawerRow?.geoData;
  const geoDrawerOpen = geoDrawerDomain !== null && !!geoDrawerData;

  // ── Render ──
  return (
    <div className="page-below-navbar flex flex-col">
      <Box
        component="main"
        sx={{
          flex: 1,
          px: { xs: 2, sm: 4 },
          py: 4,
          maxWidth: 1200,
          width: "100%",
          mx: "auto",
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}
          >
            🛡️ {t.tools.dnsLeak.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t.tools.dnsLeak.description}
          </Typography>
        </Box>

        {/* Test card */}
        <Card
          elevation={0}
          sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 3 }}
        >
          <CardContent sx={{ py: 3, px: 4, "&:last-child": { pb: 3 } }}>
            {phase === "idle" && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography
                  variant="body1"
                  sx={{ mb: 3, color: "text.secondary" }}
                >
                  {t.tools.dnsLeak.idleHint}
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrowIcon />}
                  onClick={startTest}
                  sx={{ textTransform: "none", borderRadius: 2, px: 4 }}
                >
                  {t.tools.dnsLeak.startTest}
                </Button>
              </Box>
            )}

            {phase === "probing" && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
                  {t.tools.dnsLeak.sendingProbes}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {t.tools.dnsLeak.sendingProbesDesc}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={probeProgress}
                  sx={{
                    borderRadius: 4,
                    height: 6,
                    maxWidth: 300,
                    mx: "auto",
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, display: "block" }}
                >
                  {probeProgress}%
                </Typography>
              </Box>
            )}

            {(phase === "streaming" || (phase === "probing" && rows.length > 0)) && (
              <Box>
                {error && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {rows.length > 0 && (
                  <>
                    {/* Verdict banner — only when all done */}
                    {allDone && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 2.5,
                          borderRadius: 2,
                          mb: 3,
                          bgcolor: hasLeak
                            ? alpha(theme.palette.warning.main, 0.08)
                            : alpha(theme.palette.success.main, 0.08),
                          border: 1,
                          borderColor: hasLeak
                            ? alpha(theme.palette.warning.main, 0.3)
                            : alpha(theme.palette.success.main, 0.3),
                        }}
                      >
                        {hasLeak ? (
                          <WarningAmberIcon
                            color="warning"
                            sx={{ fontSize: 36 }}
                          />
                        ) : (
                          <VerifiedIcon
                            color="success"
                            sx={{ fontSize: 36 }}
                          />
                        )}
                        <Box>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              color: hasLeak ? "warning.main" : "success.main",
                            }}
                          >
                            {hasLeak
                              ? t.tools.dnsLeak.leakDetected
                              : t.tools.dnsLeak.noLeak}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {hasLeak
                              ? t.tools.dnsLeak.leakDetectedDesc(allCountries.length)
                              : allCountries.length === 1
                                ? t.tools.dnsLeak.noLeakSingle(allCountries[0])
                                : t.tools.dnsLeak.noDataYet}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Resolver countries */}
                    {allCountries.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          {t.tools.dnsLeak.resolverCountries(allCountries.length)}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          {allCountries.map((code) => (
                            <Tooltip key={code} title={countryLabel(code)}>
                              <Chip
                                icon={<Typography sx={{ fontSize: 14 }}>{countryFlag(code)}</Typography>}
                                label={`${code} — ${COUNTRY_NAMES[code] || code}`}
                                variant="outlined"
                                size="small"
                                sx={{ borderRadius: 2 }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>
                    )}

                    {ednsCountries.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          {t.tools.dnsLeak.ednsCountries(ednsCountries.length)}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                          {ednsCountries.map((code) => (
                            <Tooltip key={code} title={countryLabel(code)}>
                              <Chip
                                icon={<Typography sx={{ fontSize: 14 }}>{countryFlag(code)}</Typography>}
                                label={`${code} — ${COUNTRY_NAMES[code] || code}`}
                                color="primary"
                                variant="outlined"
                                size="small"
                                sx={{ borderRadius: 2 }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={startTest}
                        sx={{ textTransform: "none", borderRadius: 2 }}
                      >
                        {t.tools.dnsLeak.runAgain}
                      </Button>
                    </Box>

                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      {t.tools.dnsLeak.queryDetails}
                    </Typography>

                    <Box
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 2,
                        overflow: "auto",
                      }}
                    >
                      <Table size="small">
                        <TableHead>
                          <TableRow
                            sx={{ bgcolor: alpha(theme.palette.action.hover, 0.04) }}
                          >
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                              #
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                              {t.tools.dnsLeak.testDomain}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                              Resolver
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                              DNS IP
                            </TableCell>
                            {hasEdns && (
                              <>
                                <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                                  EDNS 🇨🇳
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                                  EDNS Subnet
                                </TableCell>
                              </>
                            )}
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                              NSID
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace", whiteSpace: "nowrap" }}>
                              IP Info
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row, idx) => {
                            const q = row.queries[0];
                            return (
                              <TableRow
                                key={row.domain}
                                sx={{
                                  "&:last-child td": { border: 0 },
                                  ...(idx % 2 === 0
                                    ? { bgcolor: alpha(theme.palette.action.hover, 0.02) }
                                    : {}),
                                }}
                              >
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem", color: "text.secondary" }}>
                                  {idx + 1}
                                </TableCell>
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem", wordBreak: "break-all", maxWidth: 180 }}>
                                  <Tooltip title={row.domain}>
                                    <Typography variant="caption" sx={{ fontFamily: "inherit", wordBreak: "break-all" }}>
                                      {row.domain}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                                  {row.loading ? (
                                    <CircularProgress size={16} />
                                  ) : q ? (
                                    <Tooltip title={`${countryLabel(q.country_code)}${q.city ? ` — ${q.city}` : ""}`}>
                                      <Chip
                                        icon={<Typography sx={{ fontSize: 14 }}>{countryFlag(q.country_code)}</Typography>}
                                        label={q.country_code || "—"}
                                        size="small"
                                        variant="filled"
                                        sx={{ borderRadius: 2 }}
                                      />
                                    </Tooltip>
                                  ) : row.found ? (
                                    <Chip label={t.tools.dnsLeak.noData} size="small" color="warning" variant="outlined" sx={{ borderRadius: 2 }} />
                                  ) : (
                                    <Chip label={t.tools.dnsLeak.notFound} size="small" color="error" variant="outlined" sx={{ borderRadius: 2 }} />
                                  )}
                                </TableCell>
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem" }}>
                                  {row.loading ? (
                                    <CircularProgress size={14} />
                                  ) : q?.client_ip ? (
                                    <Typography variant="caption" sx={{ fontFamily: "inherit" }}>
                                      {q.client_ip}
                                    </Typography>
                                  ) : (
                                    <Typography variant="caption" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                                {hasEdns && (
                                  <>
                                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                                      {row.loading ? (
                                        <CircularProgress size={14} />
                                      ) : q?.edns_country_code ? (
                                        <Tooltip title={countryLabel(q.edns_country_code)}>
                                          <Chip
                                            icon={<Typography sx={{ fontSize: 14 }}>{countryFlag(q.edns_country_code)}</Typography>}
                                            label={q.edns_country_code}
                                            size="small"
                                            variant="outlined"
                                            color="primary"
                                            sx={{ borderRadius: 2 }}
                                          />
                                        </Tooltip>
                                      ) : (
                                        <Typography variant="caption" color="text.disabled">—</Typography>
                                      )}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem", maxWidth: 140 }}>
                                      {row.loading ? (
                                        <CircularProgress size={14} />
                                      ) : q?.edns_subnet ? (
                                        <Typography variant="caption" sx={{ fontFamily: "inherit", wordBreak: "break-all" }}>
                                          {q.edns_subnet}
                                        </Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.disabled">—</Typography>
                                      )}
                                    </TableCell>
                                  </>
                                )}
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {row.loading ? <CircularProgress size={14} /> : q?.nsid || "—"}
                                </TableCell>
                                <TableCell sx={{ minWidth: 160 }}>
                                  {renderGeoCell(row)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
      <Footer />

      {/* IP Geo Detail Drawer */}
      <Drawer
        anchor="bottom"
        open={geoDrawerOpen}
        onClose={() => setGeoDrawerDomain(null)}
        slotProps={{
          backdrop: { sx: { bgcolor: "rgba(0,0,0,0.3)" } },
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxWidth: 500,
              mx: "auto",
              px: 3,
              pb: 3,
              pt: 1,
            },
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 4,
              borderRadius: 2,
              bgcolor: "divider",
            }}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            IP Info
          </Typography>
          <IconButton size="small" onClick={() => setGeoDrawerDomain(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {geoDrawerData && (
          <Box sx={{ lineHeight: 2 }}>
            <Row label="Country" value={`${countryFlag(geoDrawerData.countryCode)} ${geoDrawerData.country} (${geoDrawerData.countryCode})`} />
            <Row label="Region" value={`${geoDrawerData.regionName} (${geoDrawerData.region})`} />
            <Row label="City" value={`${geoDrawerData.city}${geoDrawerData.district ? ` / ${geoDrawerData.district}` : ""}`} />
            <Row label="ZIP" value={geoDrawerData.zip || "—"} />
            <Row label="ISP" value={geoDrawerData.isp || "—"} />
            <Row label="Org" value={geoDrawerData.org || "—"} />
            <Row label="AS" value={`${geoDrawerData.as} (${geoDrawerData.asname || "—"})`} />
            <Row label="Reverse" value={geoDrawerData.reverse || "—"} />
            <Row label="Flags" value={`Proxy: ${geoDrawerData.proxy ? "Yes" : "No"} | Mobile: ${geoDrawerData.mobile ? "Yes" : "No"} | Hosting: ${geoDrawerData.hosting ? "Yes" : "No"}`} />
          </Box>
        )}
        {geoDrawerRow && !geoDrawerData && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
            No geo data available for this IP.
          </Typography>
        )}
      </Drawer>
    </div>
  );
}

// ── small helper for key/value rows in the drawer ──
function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: 0.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: "nowrap", color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ textAlign: "right", wordBreak: "break-word", maxWidth: "70%" }}
      >
        {value}
      </Typography>
    </Box>
  );
}
