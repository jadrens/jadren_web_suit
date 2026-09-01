"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  useTheme,
  Divider,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import LanguageIcon from "@mui/icons-material/Language";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@shared/libs/i18n/tool";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { alpha } from "@mui/material";
import SITE_CONFIG  from "@tool/var/config"

const API_BASE = SITE_CONFIG.baseUrl;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
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

export default function IpClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.tools.ip.title);
  const [ip, setIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [geoData, setGeoData] = useState<IpGeolocation | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const fetchIp = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGeoData(null);
    try {
      const res = await fetch("/api/ip");
      if (!res.ok) throw new Error("Failed to fetch IP");
      const data = await res.json();
      setIp(data.ip);

      // Async fetch geo info
      setGeoLoading(true);
      fetch(`/api/ip-geo?ip=${encodeURIComponent(data.ip)}`, { signal: AbortSignal.timeout(10000) })
        .then((r) => (r.ok ? r.json() : null))
        .then((geo) => setGeoData(geo))
        .catch(() => setGeoData(null))
        .finally(() => setGeoLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIp();
  }, [fetchIp]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSnackbarMessage(label);
      setSnackbarOpen(true);
    } catch {
      setSnackbarMessage(t.tools.ip.copyFailed);
      setSnackbarOpen(true);
    }
  };

  const curlExample = `curl -s ${API_BASE}/api/ip`;
  const curlJsonExample = `curl -s ${API_BASE}/api/ip | jq .`;
  const responseExample = `{
  "ip": "${ip || "1.2.3.4"}",
  "headers": {
    "x-forwarded-for": "${ip || "1.2.3.4"}",
    "x-real-ip": "${ip || "1.2.3.4"}"
  }
}`;

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
        <Box sx={{ width: "100%", maxWidth: 960 }}>
          {/* 标题 */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              mb: 1,
              fontFamily: "var(--font-inter)",
            }}
          >
            {t.tools.ip.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mb: 6,
            }}
          >
            {t.tools.ip.description}
          </Typography>

          {/* IP 显示卡片 */}
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 3,
              mb: 4,
              overflow: "hidden",
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: "center" }}>
              <Typography
                variant="subtitle2"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                {t.tools.ip.yourIp}
              </Typography>

              {loading ? (
                <Box sx={{ py: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : error ? (
                <Typography variant="h6" color="error" sx={{ py: 4 }}>
                  {error}
                </Typography>
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 800,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        color: "primary.main",
                        wordBreak: "break-all",
                      }}
                    >
                      {ip}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => copyToClipboard(ip!, t.tools.ip.copied)}
                      >
                        {t.tools.ip.copy}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={fetchIp}
                      >
                        {t.tools.ip.refresh}
                      </Button>
                    </Box>
                  </Box>

                  {/* Geo info */}
                  {(geoLoading || geoData) && (
                    <Box
                      sx={{
                        mt: 3,
                        pt: 3,
                        borderTop: `1px solid ${theme.palette.divider}`,
                        textAlign: "left",
                      }}
                    >
                      {geoLoading && !geoData ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                          <CircularProgress size={18} />
                        </Box>
                      ) : geoData ? (
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          <GeoRow
                            label={t.tools.ip.location}
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
                            label={t.tools.ip.coordinates}
                            value={
                              geoData.lat && geoData.lon
                                ? `${geoData.lat}, ${geoData.lon}`
                                : "—"
                            }
                          />
                          <GeoRow
                            label={t.tools.ip.timezone}
                            value={
                              geoData.timezone
                                ? `${geoData.timezone} (UTC${
                                    geoData.offset >= 0 ? "+" : ""
                                  }${geoData.offset / 3600})`
                                : "—"
                            }
                          />
                          <GeoRow
                            label={t.tools.ip.isp}
                            value={geoData.isp || "—"}
                          />
                          <GeoRow
                            label={t.tools.ip.organization}
                            value={geoData.org || "—"}
                          />
                          <GeoRow
                            label={t.tools.ip.asn}
                            value={
                              geoData.as
                                ? `${geoData.as}${
                                    geoData.asname ? ` — ${geoData.asname}` : ""
                                  }`
                                : "—"
                            }
                          />
                          <GeoRow
                            label={t.tools.ip.reverseDns}
                            value={geoData.reverse || "—"}
                          />
                          <GeoRow
                            label={t.tools.ip.network}
                            value={[
                              geoData.mobile && t.tools.ip.mobile,
                              geoData.proxy && t.tools.ip.proxy,
                              geoData.hosting && t.tools.ip.hosting,
                            ]
                              .filter(Boolean)
                              .join(", ") || t.tools.ip.standard}
                          />
                        </Box>
                      ) : null}
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* API 调用指南 */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              mb: 3,
              fontFamily: "var(--font-inter)",
            }}
          >
            {t.tools.ip.apiGuide}
          </Typography>

          {/* API 端点 */}
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {t.tools.ip.endpoint}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "0.875rem",
                  wordBreak: "break-all",
                }}
              >
                <LanguageIcon sx={{ fontSize: 18, color: "primary.main", flexShrink: 0 }} />
                <Typography
                  component="code"
                  sx={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    flex: 1,
                  }}
                >
                  GET {API_BASE}/api/ip
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyToClipboard(`${API_BASE}/api/ip`, t.tools.ip.copied)}
                  sx={{ flexShrink: 0 }}
                >
                  {t.tools.ip.copy}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Curl 示例 */}
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                {t.tools.ip.curlExample}
              </Typography>

              {/* 基础请求 */}
              <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
                {t.tools.ip.basicRequest}
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "0.8125rem",
                  mb: 2,
                }}
              >
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                  }}
                >
                  {curlExample}
                </Box>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyToClipboard(curlExample, t.tools.ip.copied)}
                  sx={{ mt: 1 }}
                >
                  {t.tools.ip.copy}
                </Button>
              </Box>

              {/* JSON 格式化 */}
              <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
                {t.tools.ip.jsonPretty}
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "0.8125rem",
                }}
              >
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                  }}
                >
                  {curlJsonExample}
                </Box>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyToClipboard(curlJsonExample, t.tools.ip.copied)}
                  sx={{ mt: 1 }}
                >
                  {t.tools.ip.copy}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* 响应示例 */}
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                {t.tools.ip.responseExample}
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "0.8125rem",
                }}
              >
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                  }}
                >
                  {responseExample}
                </Box>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => copyToClipboard(responseExample, t.tools.ip.copied)}
                  sx={{ mt: 1 }}
                >
                  {t.tools.ip.copy}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {t.tools.ip.responseFields}
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, fontSize: "0.875rem", lineHeight: 2 }}>
                <li>
                  <Typography component="code" sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.8125rem", fontWeight: 600, color: "primary.main" }}>
                    ip
                  </Typography>
                  {" — "}{t.tools.ip.fieldIp}
                </li>
                <li>
                  <Typography component="code" sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.8125rem", fontWeight: 600, color: "primary.main" }}>
                    headers.x-forwarded-for
                  </Typography>
                  {" — "}{t.tools.ip.fieldXff}
                </li>
                <li>
                  <Typography component="code" sx={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.8125rem", fontWeight: 600, color: "primary.main" }}>
                    headers.x-real-ip
                  </Typography>
                  {" — "}{t.tools.ip.fieldXri}
                </li>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
      <Footer />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
}
