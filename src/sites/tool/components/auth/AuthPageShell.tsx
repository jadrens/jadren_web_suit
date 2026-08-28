"use client";

import type { ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";
import { useI18n } from "@tool/lib/i18n";

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
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            border: "1px solid",
            borderColor: "divider",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 24px 70px rgba(0,0,0,.34)"
                : "0 24px 70px rgba(63,56,45,.12)",
          }}
        >
          <Stack spacing={3.5}>
            <Stack
              spacing={1.5}
              sx={{ alignItems: "center", textAlign: "center" }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 3,
                  color: "primary.main",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(157,180,212,.12)"
                      : "rgba(137,160,210,.14)",
                }}
              >
                {icon}
              </Box>
              <Box>
                <Typography
                  variant="overline"
                  color="primary.main"
                  sx={{ fontWeight: 800, letterSpacing: ".14em" }}
                >
                  {eyebrow}
                </Typography>
              </Box>
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
