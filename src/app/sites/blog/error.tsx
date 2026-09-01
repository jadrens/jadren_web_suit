"use client";

import { Box, Typography, Button } from "@mui/material";
import Navbar from "@blog/components/layout/Navbar";
import Link from "next/link";
import { useI18n } from "@shared/libs/i18n/blog";

const GOOGLE_COLORS = [
  "#4285F4",
  "#DB4437",
  "#F4B400",
  "#0F9D58",
];

export default function Error({
  error,
  reset,
}: {
  error: { digest?: string; message?: string };
  reset?: () => void;
}) {
  const { t } = useI18n();
  const statusCode = getStatusCode(error?.message);
  const digits = String(statusCode).split("");
  const errorMessages = t.error as Record<string, string>;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: 3,
        }}
      >
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: "5rem", sm: "7rem" },
            fontWeight: 700,
            fontFamily: "var(--font-inter)",
            lineHeight: 1,
            mb: 2,
            display: "flex",
          }}
        >
          {digits.map((digit, i) => (
            <Box
              component="span"
              key={i}
              sx={{ color: GOOGLE_COLORS[i % GOOGLE_COLORS.length] }}
            >
              {digit}
            </Box>
          ))}
        </Typography>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 400,
            color: "text.secondary",
            mb: 4,
          }}
        >
          {errorMessages[String(statusCode)] || errorMessages[500]}
        </Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            component={Link}
            href="/"
            variant="contained"
            sx={{
              fontFamily: "var(--font-inter)",
              fontWeight: 500,
              borderRadius: 2,
              px: 4,
              py: 1.5,
              bgcolor: "primary.main",
            }}
          >
            {t.error.backHome}
          </Button>
          {reset && (
            <Button
              onClick={reset}
              variant="outlined"
              sx={{
                fontFamily: "var(--font-inter)",
                fontWeight: 500,
                borderRadius: 2,
                px: 4,
                py: 1.5,
              }}
            >
              {t.error.retry}
            </Button>
          )}
        </Box>
      </Box>
    </div>
  );
}

function getStatusCode(message?: string): number {
  if (!message) return 500;
  const match = message.match(/\((\d+)\)/);
  return match ? parseInt(match[1]) : 500;
}