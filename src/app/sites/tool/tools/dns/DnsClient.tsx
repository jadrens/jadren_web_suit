"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@tool/lib/i18n";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { alpha } from "@mui/material";


interface DnsRecord {
  name: string;
  type: string;
  TTL: number;
  data: string;
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

interface ApiResponse {
  domain?: string;
  type?: string;
  Answer?: DnsRecord[];
  Authority?: DnsRecord[];
  Additional?: DnsRecord[];
  comment?: string;
  error?: string;
}

const DISPLAY_ORDER = [
  "A",
  "CNAME",
  "AAAA",
  "MX",
  "TXT",
  "NS",
  "CAA",
  "PTR",
] as const;

const QUERY_TYPES = ["A", "CNAME", "AAAA", "MX", "TXT", "NS", "CAA"] as const;

type SupportedRecordType = (typeof DISPLAY_ORDER)[number];

interface QuerySection {
  type: SupportedRecordType;
  label: string;
  records: DnsRecord[];
  note?: string;
  id: string;
}

function isIpv4(address: string): boolean {
  return /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(?!$)|$)){4}$/.test(
    address
  );
}

function isIpv6(address: string): boolean {
  return /^(([0-9a-fA-F]{1,4}):){2,7}([0-9a-fA-F]{1,4})$/.test(address);
}

function normalizeQueryInput(value: string) {
  let host = value.trim();

  if (!host) {
    return { host, isIp: false };
  }

  try {
    const parsed = new URL(
      host.includes("://") ? host : `https://${host}`
    );
    host = parsed.hostname;
  } catch {
    // Keep raw input if URL parsing fails
  }

  const normalized = host.replace(/^\[|\]$/g, "");
  const isIp = isIpv4(normalized) || isIpv6(normalized);

  return { host: normalized, isIp };
}

function buildSection(
  type: SupportedRecordType,
  records: DnsRecord[],
  note?: string
): QuerySection {
  return {
    type,
    label: type,
    records,
    note,
    id: `section-${type.toLowerCase()}`,
  };
}

// ---------------------------------------------------------------------------
// Geo row helper (reused from IpClient)
// ---------------------------------------------------------------------------

function GeoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  const rowTheme = useTheme();
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "110px 1fr", sm: "160px 1fr" },
        gap: 1,
        py: 1,
        borderBottom: `1px solid ${rowTheme.palette.divider}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", fontWeight: 500 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          wordBreak: "break-all",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function DnsClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.tools.dns.title);

  const [domain, setDomain] = useState("");
  const [sections, setSections] = useState<QuerySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState({ open: false, message: "" });
  const [geoData, setGeoData] = useState<IpGeolocation | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [queriedIsIp, setQueriedIsIp] = useState(false);

  async function fetchDnsRecords(
    type: SupportedRecordType,
    host: string
  ): Promise<DnsRecord[]> {
    const url = `/api/dns?domain=${encodeURIComponent(
      host
    )}&type=${encodeURIComponent(type)}`;
    const res = await fetch(url);
    const data: ApiResponse = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return [
      ...(data.Answer || []),
      ...(data.Authority || []),
      ...(data.Additional || []),
    ];
  }

  const handleLookup = async () => {
    const trimmed = domain.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setSections([]);
    setGeoData(null);
    setGeoLoading(false);

    const { host, isIp } = normalizeQueryInput(trimmed);
    setQueriedIsIp(isIp);

    if (!host) {
      setError(t.tools.dns.lookupFailed);
      setLoading(false);
      return;
    }

    const initialTypes = isIp ? ["PTR"] : [...QUERY_TYPES];
    const initialSections = initialTypes.map((type) =>
      buildSection(type as SupportedRecordType, [])
    );

    try {
      const settled = await Promise.allSettled(
        initialTypes.map((type) =>
          fetchDnsRecords(type as SupportedRecordType, host)
        )
      );

      const filledSections = initialSections.map((section, index) => {
        const result = settled[index];
        if (result.status === "fulfilled") {
          return {
            ...section,
            records: result.value,
          };
        }

        return {
          ...section,
          note:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        };
      });

      let finalSections = [...filledSections];

      if (!isIp) {
        const cnameSection = finalSections.find((sec) => sec.type === "CNAME");
        const aSection = finalSections.find((sec) => sec.type === "A");
        const aaaaSection = finalSections.find((sec) => sec.type === "AAAA");

        const cnameTargets = Array.from(
          new Set(cnameSection?.records.map((record) => record.data) || [])
        ).filter(Boolean);

        if (
          cnameTargets.length > 0 &&
          !(aSection?.records.length || aaaaSection?.records.length)
        ) {
          const followup = await Promise.allSettled(
            cnameTargets.flatMap((target) =>
              ["A", "AAAA"].map((type) =>
                fetchDnsRecords(type as SupportedRecordType, target).then(
                  (records) => ({ type, target, records })
                )
              )
            )
          );

          followup.forEach((item) => {
            if (item.status !== "fulfilled") {
              return;
            }
            const section = finalSections.find(
              (sec) => sec.type === item.value.type
            );
            if (section) {
              section.records = [...section.records, ...item.value.records];
            }
          });
        }

        const discoveredIps = new Set(
          finalSections
            .filter((sec) => sec.type === "A" || sec.type === "AAAA")
            .flatMap((sec) => sec.records.map((record) => record.data))
        );

        if (discoveredIps.size > 0) {
          const ptrResults = await Promise.allSettled(
            Array.from(discoveredIps).map((ip) =>
              fetchDnsRecords("PTR" as SupportedRecordType, ip).then(
                (records) => ({ ip, records })
              )
            )
          );

          const ptrSection = finalSections.find((sec) => sec.type === "PTR");

          if (ptrSection) {
            const ptrRecords = ptrResults
              .filter(
                (
                  item
                ): item is PromiseFulfilledResult<{
                  ip: string;
                  records: DnsRecord[];
                }> => item.status === "fulfilled"
              )
              .flatMap((item) => item.value.records);

            ptrSection.records = ptrRecords;

            const rejected = ptrResults.filter(
              (item) => item.status === "rejected"
            ) as PromiseRejectedResult[];

            if (rejected.length > 0 && ptrRecords.length === 0) {
              ptrSection.note = rejected[0].reason
                ? String(rejected[0].reason)
                : t.tools.dns.noRecords;
            }
          }
        }
      }

      const orderedSections = DISPLAY_ORDER.map((type) =>
        finalSections.find((section) => section.type === type)
      ).filter(Boolean) as QuerySection[];

      const nonEmptySections = orderedSections.filter(
        (section) => section.records.length > 0
      );
      const emptySections = orderedSections.filter(
        (section) => section.records.length === 0
      );

      setSections([...nonEmptySections, ...emptySections]);

      const hasRecords = orderedSections.some(
        (section) => section.records.length > 0
      );
      if (!hasRecords && !isIp) {
        setError(t.tools.dns.noRecords);
      }

      // When input is an IP, fetch geolocation info (best-effort)
      if (isIp) {
        setGeoLoading(true);
        fetch(`/api/ip-geo?ip=${encodeURIComponent(host)}`, {
          signal: AbortSignal.timeout(10000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((geo) => setGeoData(geo))
          .catch(() => setGeoData(null))
          .finally(() => setGeoLoading(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.tools.dns.lookupFailed);
    } finally {
      setLoading(false);
    }
  };


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && domain.trim() && !loading) {
      handleLookup();
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ open: true, message: t.tools.dns.copied });
    } catch {
      setToast({ open: true, message: "Failed to copy" });
    }
  };

  const handleCopyAll = async () => {
    if (!sections.length) return;
    const text = sections
      .flatMap((section) =>
        section.records.map(
          (r) => `${r.name}\t${r.TTL}\tIN\t${r.type}\t${r.data}`
        )
      )
      .join("\n");
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setToast({ open: true, message: t.tools.dns.copied });
    } catch {
      setToast({ open: true, message: "Failed to copy" });
    }
  };

  const hasResults = sections.length > 0;

  return (
    <div className="page-below-navbar flex flex-col">
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          px: 3,
          py: 8,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 860 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              mb: 1,
              fontFamily: "var(--font-inter)",
            }}
          >
            {t.tools.dns.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mb: 4,
            }}
          >
            {t.tools.dns.description}
          </Typography>

          {/* Input Row */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 1,
              flexWrap: "wrap",
            }}
          >
            <TextField
              fullWidth
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.tools.dns.placeholder}
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.9rem",
                    flex: 1,
                  },
                },
              }}
              sx={{ flex: 1, minWidth: 240 }}
            />
            <Button
              variant="contained"
              onClick={handleLookup}
              disabled={!domain.trim() || loading}
              startIcon={
                loading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SearchIcon />
                )
              }
              sx={{
                px: 4,
                py: 1.5,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                minWidth: 140,
                flex: { xs: "1 1 100%", sm: "0 0 auto" },
              }}
            >
              {loading ? t.tools.dns.lookingUp : t.tools.dns.lookup}
            </Button>
          </Box>


          {/* Error */}
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {/* Quick nav */}
          {hasResults && (
            <Paper
              elevation={0}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                py: 1,
                px: 2,
                mb: 3,
                position: "sticky",
                top: 16,
                bgcolor: "background.paper",
                zIndex: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700, mb: 1 }}
              >
                {t.tools.dns.quickNav}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {sections.map((section) => {
                  const count = section.records.length;
                  const isEmpty = count === 0;
                  return (
                    <Button
                      key={section.id}
                      size="small"
                      onClick={() => {
                        document
                          .getElementById(section.id)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      color={isEmpty ? "error" : "primary"}
                      variant={isEmpty ? "outlined" : "contained"}
                      sx={{
                        textTransform: "none",
                        borderRadius: 1.5,
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {section.type}
                      {count > 0 ? `(${count})` : ""}
                    </Button>
                  );
                })}
              </Box>
            </Paper>
          )}

          {/* IP Geo card (shown when querying an IP) */}
          {hasResults && queriedIsIp && (geoLoading || geoData) && (
            <Card
              elevation={0}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                mb: 3,
              }}
            >
              <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                  IP Geolocation
                </Typography>
                {geoLoading && !geoData ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={18} />
                  </Box>
                ) : geoData ? (
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <GeoRow
                      label="Location"
                      value={
                        [
                          geoData.country,
                          geoData.regionName,
                          geoData.city,
                          geoData.district,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"
                      }
                    />
                    <GeoRow
                      label="Coordinates"
                      value={
                        geoData.lat && geoData.lon
                          ? `${geoData.lat}, ${geoData.lon}`
                          : "—"
                      }
                    />
                    <GeoRow
                      label="Timezone"
                      value={
                        geoData.timezone
                          ? `${geoData.timezone} (UTC${
                              geoData.offset >= 0 ? "+" : ""
                            }${geoData.offset / 3600})`
                          : "—"
                      }
                    />
                    <GeoRow
                      label="ISP"
                      value={geoData.isp || "—"}
                    />
                    <GeoRow
                      label="Organization"
                      value={geoData.org || "—"}
                    />
                    <GeoRow
                      label="ASN"
                      value={
                        geoData.as
                          ? `${geoData.as}${
                              geoData.asname ? ` — ${geoData.asname}` : ""
                            }`
                          : "—"
                      }
                    />
                    <GeoRow
                      label="Reverse DNS"
                      value={geoData.reverse || "—"}
                    />
                    <GeoRow
                      label="Network"
                      value={[
                        geoData.mobile && "Mobile",
                        geoData.proxy && "Proxy",
                        geoData.hosting && "Hosting",
                      ]
                        .filter(Boolean)
                        .join(", ") || "Standard"}
                    />
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {hasResults && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}> 
              {sections.map((section) => (
                <Paper
                  key={section.id}
                  id={section.id}
                  elevation={0}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                    bgcolor: alpha(theme.palette.background.paper, 0.96),
                    scrollMarginTop: "120px",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1.5,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 700 }}
                    >
                      {t.tools.dns.recordSection}: {section.type}
                    </Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        const text = section.records
                          .map(
                            (record) =>
                              `${record.name}\t${record.TTL}\tIN\t${record.type}\t${record.data}`
                          )
                          .join("\n");
                        if (text) {
                          handleCopy(text);
                        }
                      }}
                      sx={{ textTransform: "none" }}
                    >
                      {t.tools.dns.copyAll}
                    </Button>
                  </Box>

                  {section.records.length > 0 ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow
                          sx={{
                            bgcolor: alpha(theme.palette.action.hover, 0.04),
                          }}
                        >
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontFamily: "var(--font-jetbrains-mono), monospace",
                            }}
                          >
                            NAME
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontFamily: "var(--font-jetbrains-mono), monospace",
                            }}
                          >
                            TYPE
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontFamily: "var(--font-jetbrains-mono), monospace",
                            }}
                          >
                            TTL
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontFamily: "var(--font-jetbrains-mono), monospace",
                            }}
                          >
                            DATA
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, width: 48 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {section.records.map((record, idx) => (
                          <TableRow
                            key={`${section.type}-${idx}`}
                            sx={{
                              "&:last-child td": { border: 0 },
                              ...(idx % 2 === 0
                                ? {
                                    bgcolor: alpha(
                                      theme.palette.action.hover,
                                      0.02
                                    ),
                                  }
                                : {}),
                            }}
                          >
                            <TableCell
                              sx={{
                                fontFamily:
                                  "var(--font-jetbrains-mono), monospace",
                                fontSize: "0.85rem",
                                wordBreak: "break-all",
                              }}
                            >
                              {record.name}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontFamily:
                                  "var(--font-jetbrains-mono), monospace",
                                fontSize: "0.85rem",
                              }}
                            >
                              {record.type}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontFamily:
                                  "var(--font-jetbrains-mono), monospace",
                                fontSize: "0.85rem",
                              }}
                            >
                              {record.TTL}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontFamily:
                                  "var(--font-jetbrains-mono), monospace",
                                fontSize: "0.85rem",
                                wordBreak: "break-all",
                                maxWidth: 360,
                              }}
                            >
                              {record.data}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                onClick={() => handleCopy(record.data)}
                                sx={{
                                  minWidth: 36,
                                  p: 0.5,
                                  borderRadius: 1,
                                }}
                              >
                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.85rem",
                      }}
                    >
                      {section.note || t.tools.dns.empty}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          )}

          {/* Empty state */}
          {!hasResults && !loading && !error && (
            <Box
              sx={{
                textAlign: "center",
                py: 10,
                color: "text.disabled",
              }}
            >
              <SearchIcon sx={{ fontSize: 56, mb: 2, opacity: 0.3 }} />
              <Typography variant="body2">
                {t.tools.dns.hint}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Footer />

      <Snackbar
        open={toast.open}
        autoHideDuration={2000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
