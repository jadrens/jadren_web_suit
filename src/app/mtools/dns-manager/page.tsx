"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  useTheme,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
} from "@mui/material";
import DnsIcon from "@mui/icons-material/Dns";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CachedIcon from "@mui/icons-material/Cached";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BarChartIcon from "@mui/icons-material/BarChart";
import { alpha } from "@mui/material";
import { hasToken, getStats, listZones, checkHealth, getServerConfig, updateServerConfig } from "@lib/dns-manager/api";
import type { StatsResponse, ZoneListResponse, ServerConfig } from "@lib/dns-manager/types";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

export default function DnsManagerDashboard() {
  const theme = useTheme();
  useDocumentTitle("DNS Manager");
  const [health, setHealth] = useState<boolean | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [zones, setZones] = useState<ZoneListResponse | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    if (!hasToken()) return;
    setLoading(true);
    setError("");

    try {
      const [h, s, z, cfg] = await Promise.all([
        checkHealth().then(() => true).catch(() => false),
        getStats().catch(() => null),
        listZones().catch(() => null),
        getServerConfig().catch(() => null),
      ]);
      setHealth(h);
      setStats(s as StatsResponse | null);
      setZones(z as ZoneListResponse | null);
      setServerConfig(cfg as ServerConfig | null);
    } catch {
      setError("Failed to fetch data from the DNS server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    if (!serverConfig) return;
    setSavingConfig(true);
    try {
      await updateServerConfig({
        default_ttl: serverConfig.default_ttl,
        default_response: serverConfig.default_response,
        default_record: serverConfig.default_record,
      });
      setToast({ open: true, message: "Server config saved", severity: "success" });
    } catch (err) {
      setToast({ open: true, message: err instanceof Error ? err.message : "Failed to save config", severity: "error" });
    } finally {
      setSavingConfig(false);
    }
  };

  if (!hasToken()) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Box sx={{ textAlign: "center" }}>
          <DnsIcon sx={{ fontSize: 56, mb: 2, color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">
            Please enter your API token to continue
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1000, mx: "auto" }}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, fontFamily: "var(--font-inter)", mb: 1 }}
      >
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        DNS Server at <code>nshk.jadren.me</code>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Health card */}
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(
                health ? theme.palette.success.main : theme.palette.error.main,
                0.04
              ),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              {health === null ? (
                <CircularProgress size={40} />
              ) : health ? (
                <CheckCircleIcon sx={{ fontSize: 40, color: "success.main" }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 40, color: "error.main" }} />
              )}
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
                {health ? "Online" : "Offline"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Server Health
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Zone count */}
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <DnsIcon sx={{ fontSize: 40, color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
                {stats?.zones ?? zones?.total ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Zones
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Total queries */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <BarChartIcon sx={{ fontSize: 40, color: "info.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "info.main",
                }}
              >
                {stats?.recorder && "total_queries" in stats.recorder
                  ? stats.recorder.total_queries.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Queries
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Cache hited + hit rate */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.success.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <CachedIcon sx={{ fontSize: 40, color: "success.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "success.main",
                }}
              >
                {stats?.recorder && "cache_hited" in stats.recorder
                  ? stats.recorder.cache_hited.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cache Hited
              </Typography>
              {stats?.recorder && "cache_hited" in stats.recorder && stats.recorder.total_queries > 0 && (
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 700,
                    fontFamily: "var(--font-inter)",
                    color: "success.main",
                    mt: 0.5,
                  }}
                >
                  {((stats.recorder.cache_hited / stats.recorder.total_queries) * 100).toFixed(1)}% hit rate
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Dropped */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.error.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 40, color: "error.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "error.main",
                }}
              >
                {stats?.recorder && "dropped" in stats.recorder
                  ? stats.recorder.dropped.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dropped
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Server default config */}
      {serverConfig && (
        <Card
          elevation={0}
          sx={{
            mt: 4,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ py: 2.5, px: 3, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: "var(--font-inter)", mb: 2 }}>
              Server Defaults
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2.5,
                alignItems: "flex-end",
              }}
            >
              {/* Listen address — read only */}
              <TextField
                label="Listen Address"
                value={serverConfig.listen}
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
                  },
                }}
                sx={{ minWidth: 180 }}
              />

              {/* Default TTL */}
              <TextField
                label="Default TTL (seconds)"
                type="number"
                value={serverConfig.default_ttl}
                onChange={(e) =>
                  setServerConfig({ ...serverConfig, default_ttl: parseInt(e.target.value) || 0 })
                }
                slotProps={{
                  input: {
                    sx: { fontFamily: "var(--font-jetbrains-mono), monospace" },
                  },
                }}
                sx={{ minWidth: 150 }}
              />

              {/* Default response */}
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel>Default Response</InputLabel>
                <Select
                  value={serverConfig.default_response}
                  label="Default Response"
                  onChange={(e) =>
                    setServerConfig({
                      ...serverConfig,
                      default_response: e.target.value as ServerConfig["default_response"],
                    })
                  }
                  sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  <MenuItem value="refuse">refuse</MenuItem>
                  <MenuItem value="nxdomain">nxdomain</MenuItem>
                  <MenuItem value="servfail">servfail</MenuItem>
                </Select>
              </FormControl>

              {/* Default record */}
              <FormControlLabel
                control={
                  <Switch
                    checked={serverConfig.default_record}
                    onChange={(e) =>
                      setServerConfig({ ...serverConfig, default_record: e.target.checked })
                    }
                  />
                }
                label="Record by default"
              />

              <Button
                variant="contained"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
              >
                {savingConfig ? "Saving..." : "Save Config"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Active zones */}
      <Typography
        variant="h6"
        sx={{ fontWeight: 600, fontFamily: "var(--font-inter)", mt: 5, mb: 2 }}
      >
        Active Zones ({zones?.total ?? 0})
      </Typography>

      {zones && zones.zones.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {zones.zones.map((zone) => (
            <Card
              key={zone.pattern}
              elevation={0}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ py: 2, px: 3, "&:last-child": { pb: 2 } }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        wordBreak: "break-all",
                      }}
                    >
                      {zone.pattern}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                      <Chip label={`TTL: ${zone.ttl}s`} size="small" variant="outlined" />
                      <Chip
                        label={zone.record ? "Recording" : "Not Recording"}
                        size="small"
                        color={zone.record ? "success" : "default"}
                        variant="outlined"
                      />
                      <Chip
                        label={zone.fast_open ? "Fast Open" : "Geo Resolve"}
                        size="small"
                        color={zone.fast_open ? "warning" : "info"}
                        variant="outlined"
                      />
                      {Object.keys(zone.countries).map((code) => (
                        <Chip
                          key={code}
                          label={code}
                          size="small"
                          color={code === "default" ? "primary" : "info"}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No zones configured
        </Typography>
      )}

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
          onClose={() => setToast({ ...toast, open: false })}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
