"use client";

import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, InputBase } from "@mui/material";

export const RESEND_COOLDOWN_SECONDS = 60;

/** Seconds left before a code may be resent; call `start()` after each send. */
export function useResendCooldown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(RESEND_COOLDOWN_SECONDS) };
}

interface CodeFieldProps {
  value: string;
  onChange: (code: string) => void;
  onResend: () => void;
  sending: boolean;
  cooldown: number;
  disabled?: boolean;
  autoFocus?: boolean;
  labels: {
    code: string;
    resend: string;
    sending: string;
    resendIn: (seconds: number) => string;
  };
}

/** A six-digit code input with an attached resend button and countdown. */
export default function CodeField({
  value,
  onChange,
  onResend,
  sending,
  cooldown,
  disabled = false,
  autoFocus = false,
  labels,
}: CodeFieldProps) {
  const resendLabel = sending ? labels.sending : cooldown > 0 ? labels.resendIn(cooldown) : labels.resend;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        minHeight: 56,
        overflow: "hidden",
        border: "1px solid",
        borderColor: disabled ? "action.disabled" : "divider",
        borderRadius: 1,
        transition: (theme) => theme.transitions.create(["border-color", "box-shadow"]),
        "&:focus-within": disabled
          ? undefined
          : {
              borderColor: "primary.main",
              boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
            },
      }}
    >
      <InputBase
        placeholder={labels.code}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        disabled={disabled}
        fullWidth
        inputProps={{ maxLength: 6, pattern: "[0-9]{6}", "aria-label": labels.code }}
        sx={{
          minWidth: 0,
          px: 2,
          "& input": {
            textAlign: "center",
            letterSpacing: value ? ".45em" : "normal",
            textIndent: value ? ".45em" : 0,
            fontSize: "1.2rem",
            fontWeight: 700,
          },
        }}
      />
      <Button
        type="button"
        variant="text"
        disabled={disabled || sending || cooldown > 0}
        aria-label={resendLabel}
        onClick={onResend}
        sx={{
          width: { xs: 92, sm: 104 },
          minWidth: 0,
          borderLeft: "1px solid",
          borderColor: "divider",
          borderRadius: 0,
          px: 1,
          whiteSpace: "nowrap",
        }}
      >
        {sending ? <CircularProgress size={17} color="inherit" /> : cooldown > 0 ? `${cooldown}s` : labels.resend}
      </Button>
    </Box>
  );
}
