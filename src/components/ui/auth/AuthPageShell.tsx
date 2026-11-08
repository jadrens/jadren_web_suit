"use client";

import type { ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import { useI18n } from "@lib/i18n/app";

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthPageShell({
  eyebrow,
  title,
  description,
  icon,
  children,
  footer,
}: AuthPageShellProps) {
  const { t } = useI18n();
  return (
    <Box
      component="main"
      sx={{
        minHeight: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
        display: "grid",
        placeItems: "center",
        px: 2,
        py: { xs: 4, sm: 7 },
        background: (theme) =>
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at 20% 15%, rgba(157,180,212,.15), transparent 34%), radial-gradient(circle at 82% 82%, rgba(201,168,124,.12), transparent 30%), #171717"
            : "radial-gradient(circle at 20% 15%, rgba(137,160,210,.22), transparent 34%), radial-gradient(circle at 82% 82%, rgba(201,168,124,.18), transparent 30%), #f7f5f1",
      }}
    >
      <Container maxWidth="xs" disableGutters>
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            overflow: "hidden",
            p: { xs: 3, sm: 4.5 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 24px 70px rgba(0,0,0,.34)"
                : "0 24px 70px rgba(63,56,45,.12)",
            // A thin accent along the top edge gives the card a finished edge.
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "0 0 auto 0",
              height: 3,
              background: "linear-gradient(90deg, rgba(157,180,212,.9), rgba(201,168,124,.8))",
            },
            // Auth forms read as sentences: no shouted buttons, and every field is
            // required, so per-field asterisks only add noise.
            "& .MuiButton-root": { textTransform: "none", letterSpacing: 0 },
            "& .MuiFormLabel-asterisk": { display: "none" },
          }}
        >
          <Stack spacing={3.5}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Box
                  aria-hidden
                  sx={{
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2.5,
                    color: "primary.main",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(157,180,212,.12)"
                        : "rgba(137,160,210,.14)",
                    "& .MuiSvgIcon-root": { fontSize: 26 },
                  }}
                >
                  {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    color="primary.main"
                    sx={{ display: "block", fontWeight: 800, letterSpacing: ".14em", lineHeight: 1.6 }}
                  >
                    {eyebrow}
                  </Typography>
                  <Typography
                    component="h1"
                    variant="h5"
                    sx={{ fontWeight: 800, lineHeight: 1.25 }}
                  >
                    {title}
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {description}
              </Typography>
            </Stack>

            {children}

            {footer ? (
              <Box
                sx={{
                  pt: 2.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  textAlign: "center",
                }}
              >
                {footer}
              </Box>
            ) : null}
          </Stack>
        </Paper>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2.5, textAlign: "center" }}
        >
          {t.auth.common.serviceFooter}
        </Typography>
      </Container>
    </Box>
  );
}
