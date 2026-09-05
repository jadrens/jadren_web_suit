"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Typography, Card, CardContent, CardActionArea } from "@mui/material";
import Footer from "@components/ui/layout/Footer";
import Link from "next/link";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { alpha, useTheme } from "@mui/material";
import DnsIcon from "@mui/icons-material/Dns";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { checkHealth } from "@lib/dns-manager/api";

interface ToolItem {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

function formatTimeAgo(date: Date, t: Record<string, string>): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return t.justNow;
  if (seconds < 60) return `${seconds}${t.secondsAgo}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${t.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t.hoursAgo}`;
  const days = Math.floor(hours / 24);
  return `${days}${t.daysAgo}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

export default function MtoolsClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.mtools.title);

  const [health, setHealth] = useState<boolean | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [checking, setChecking] = useState(true);

  const doCheck = useCallback(async () => {
    setChecking(true);
    try {
      const ok = await checkHealth().then(() => true).catch(() => false);
      setHealth(ok);
    } catch {
      setHealth(false);
    } finally {
      setLastCheck(new Date());
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    doCheck();
    const timer = setInterval(doCheck, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [doCheck]);

  // Force a re-render every second so the "X ago" text stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const tools: ToolItem[] = [
    {
      key: "dns-manager",
      title: t.mtools.dnsManager.title,
      description: t.mtools.dnsManager.description,
      href: "/mtools/dns-manager",
      icon: <DnsIcon sx={{ fontSize: 32 }} />,
    },
  ];

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
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              mb: 1,
              fontFamily: "var(--font-inter)",
            }}
          >
            {t.mtools.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mb: 6,
            }}
          >
            {t.mtools.description}
          </Typography>

          {/* Tool cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 3,
              mb: 5,
            }}
          >
            {tools.map((tool) => (
              <Card
                key={tool.key}
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 2,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    transform: "translateY(-2px)",
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
                  },
                }}
              >
                <CardActionArea
                  component={Link}
                  href={tool.href}
                  sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    }}
                  >
                    {tool.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {tool.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tool.description}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Box>

          {/* Health check section */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              fontFamily: "var(--font-inter)",
              mb: 2,
            }}
          >
            {t.mtools.health.title}
          </Typography>

          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(
                health === null
                  ? theme.palette.text.disabled
                  : health
                    ? theme.palette.success.main
                    : theme.palette.error.main,
                0.04
              ),
            }}
          >
            <CardContent
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
                py: 2.5,
                px: 3,
                "&:last-child": { pb: 2.5 },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                {health === null ? (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      bgcolor: alpha(theme.palette.text.disabled, 0.12),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.7rem",
                        color: "text.disabled",
                      }}
                    >
                      --
                    </Typography>
                  </Box>
                ) : health ? (
                  <CheckCircleIcon sx={{ fontSize: 40, color: "success.main" }} />
                ) : (
                  <ErrorIcon sx={{ fontSize: 40, color: "error.main" }} />
                )}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {health === null
                      ? t.mtools.health.checking
                      : health
                        ? t.mtools.health.online
                        : t.mtools.health.offline}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t.mtools.health.serverLabel}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" color="text.secondary">
                  {t.mtools.health.lastChecked}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontWeight: 500,
                  }}
                >
                  {lastCheck ? formatTimeAgo(lastCheck, t.mtools.health.timeAgo as unknown as Record<string, string>) : "-"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                  }}
                >
                  {lastCheck ? formatTime(lastCheck) : ""}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
      <Footer />
    </div>
  );
}
