"use client";

import { useState, useCallback } from "react";
import Footer from "@components/content/layout/Footer";
import MarkdownContent from "@components/content/MarkdownContent";
import { ReadingProgressProvider } from "@components/content/reading/ReadingProgressContext";
import { Box, Paper, Avatar, Link as MuiLink, useTheme, Snackbar, Alert } from "@mui/material";
import { useI18n } from "@lib/i18n/content";
import { alpha } from "@mui/material";
import { CONTACT_CONFIG, resolveContactColor } from "@config/publishing/contact";
import { CONTACT_ICON_REGISTRY } from "@config/publishing/contact-icons";

interface AboutClientProps {
  content: Record<"en" | "zh", string>;
}

export default function AboutClient({ content }: AboutClientProps) {
  const { locale } = useI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Toast
  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const showToast = useCallback((message: string) => {
    setToast({ open: true, message });
  }, []);
  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // Rule-based: derive every field from config — no hardcoded maps
  const socials = Object.entries(CONTACT_CONFIG)
    .filter(([, cfg]) => cfg.enabled)
    .map(([key, cfg]) => {
      // email is the only special case: mailto link, use url as display
      const isEmail = key === "email";
      const color = resolveContactColor(cfg.color, isDark);
      const href = isEmail ? `mailto:${cfg.url}` : cfg.url;
      const username = isEmail ? cfg.url : cfg.username;
      const IconComponent = CONTACT_ICON_REGISTRY[cfg.icon];
      const hasActions = typeof cfg.actions === "function";

      return { key, name: cfg.name, username, icon: IconComponent, href, color, hasActions, actions: cfg.actions };
    });

  return (
    <div className="min-h-screen flex flex-col">
      
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
        <Box sx={{ width: "100%", maxWidth: 720 }}>
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Avatar
              src="/avatar.svg"
              alt="jadren"
              sx={{
                width: 100,
                height: 100,
                mx: "auto",
                mb: 3,
                border: 3,
                borderColor: "primary.main",
              }}
            />
          </Box>
          <ReadingProgressProvider>
            <MarkdownContent content={content[locale] ?? content.en} />
          </ReadingProgressProvider>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 4 }}>
            {socials.map((social) => {
              const linkProps = social.hasActions
                ? {}
                : {
                    component: MuiLink,
                    href: social.href,
                    target: "_blank",
                    rel: "noopener noreferrer",
                  };

              return (
                <Paper
                  key={social.key}
                  {...linkProps}
                  onClick={
                    social.hasActions
                      ? () => {
                          social.actions!(showToast);
                        }
                      : undefined
                  }
                  elevation={0}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    p: 2,
                    borderRadius: 2,
                    textDecoration: "none",
                    border: 1,
                    borderColor: "divider",
                    cursor: social.hasActions ? "pointer" : undefined,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: social.color,
                      transform: "translateX(4px)",
                      bgcolor: alpha(social.color, 0.08),
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 2,
                      bgcolor: alpha(social.color, 0.12),
                      color: social.color,
                      flexShrink: 0,
                    }}
                  >
                    {social.icon && <social.icon />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.875rem" }}>
                      {social.name}
                    </Box>
                    <Box
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.8rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {social.username}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Box>
      <Footer />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity="info"
          variant="filled"
          sx={{
            bgcolor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
