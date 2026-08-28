"use client";

import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";
import { useI18n } from "@tool/lib/i18n";

const GOOGLE_COLORS = [
  "#4285F4",
  "#DB4437",
  "#F4B400",
  "#0F9D58",
];

export default function NotFound() {
  const { t } = useI18n();
  const digits = ["4", "0", "4"];

  return (
    <div className="page-below-navbar flex flex-col">
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
          {t.notFound.message}
        </Typography>
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
          {t.notFound.backHome}
        </Button>
      </Box>
    </div>
  );
}
