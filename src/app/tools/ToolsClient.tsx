"use client";

import { Box, Typography, Card, CardActionArea } from "@mui/material";
import Footer from "@components/ui/layout/Footer";
import Link from "next/link";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { alpha, useTheme } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import DnsIcon from "@mui/icons-material/Dns";
import LanguageIcon from "@mui/icons-material/Language";
import ShieldIcon from "@mui/icons-material/Shield";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";

interface ToolItem {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  requiresLogin?: boolean;
  requiresLlm?: boolean;
}

export default function ToolsClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.tools.title);

  const tools: ToolItem[] = [
    {
      key: "englishLearner",
      title: t.tools.englishLearner.title,
      description: t.tools.englishLearner.cardDescription,
      href: "/tools/english-learner",
      icon: <SchoolRoundedIcon sx={{ fontSize: 32 }} />,
      requiresLlm: true,
    },
    {
      key: "reminder",
      title: t.tools.reminder.title,
      description: t.tools.reminder.cardDescription,
      href: "/tools/reminder",
      icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 32 }} />,
      requiresLogin: true,
    },
    {
      key: "quickLink",
      title: t.tools.quickLink.title,
      description: t.tools.quickLink.cardDescription,
      href: "/tools/quick-link",
      icon: <LinkRoundedIcon sx={{ fontSize: 32 }} />,
      requiresLogin: true,
    },
    {
      key: "colourPicker",
      title: t.tools.colourPicker.title,
      description: t.tools.colourPicker.description,
      href: "/tools/colour-picker",
      icon: <ColorLensIcon sx={{ fontSize: 32 }} />,
    },
    {
      key: "base64",
      title: t.tools.base64.title,
      description: t.tools.base64.description,
      href: "/tools/base64",
      icon: <LockIcon sx={{ fontSize: 32 }} />,
    },
    {
      key: "dns",
      title: t.tools.dns.title,
      description: t.tools.dns.description,
      href: "/tools/dns",
      icon: <DnsIcon sx={{ fontSize: 32 }} />,
    },
    {
      key: "ip",
      title: t.tools.ip.title,
      description: t.tools.ip.description,
      href: "/tools/ip",
      icon: <LanguageIcon sx={{ fontSize: 32 }} />,
    },
    {
      key: "qrcode",
      title: t.tools.qrcode.title,
      description: t.tools.qrcode.description,
      href: "/tools/qrcode",
      icon: <QrCode2Icon sx={{ fontSize: 32 }} />,
    },
    {
      key: "dnsLeak",
      title: t.tools.dnsLeak.title,
      description: t.tools.dnsLeak.description,
      href: "/tools/dns-leak",
      icon: <ShieldIcon sx={{ fontSize: 32 }} />,
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
            {t.tools.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mb: 6,
            }}
          >
            {t.tools.description}
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 3,
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
                  sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, height: "100%", marginHorizontal: "auto"}}
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
                    {tool.requiresLogin && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75, color: "primary.main" }}>
                        <LoginRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {t.tools.quickLink.requiresLogin}
                        </Typography>
                      </Box>
                    )}
                    {tool.requiresLlm && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75, color: "secondary.main" }}>
                        <SmartToyRoundedIcon sx={{ fontSize: 16 }} />
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                          {t.tools.englishLearner.requiresLlm}
                        </Typography>
                      </Box>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {tool.description}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      </Box>
      <Footer />
    </div>
  );
}
