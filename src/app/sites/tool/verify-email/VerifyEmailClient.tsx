"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputBase,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import AuthPageShell from "@tool/components/auth/AuthPageShell";
import {
  authErrorMessage,
  validEmail,
} from "@tool/components/auth/form-utils";
import { authSession } from "@tool/lib/client-api";
import { useI18n } from "@tool/lib/i18n";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";

const RESEND_COOLDOWN_SECONDS = 60;
type Notice = "initially-sent" | "sent" | "success" | null;

interface VerifyEmailClientProps {
  initialEmail: string;
  initiallySent: boolean;
  initialSentAt: number | null;
  initialExpiresAt: number | null;
}

function formatTimestamp(timestamp: number, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: locale === "en",
  }).format(new Date(timestamp));
}

export default function VerifyEmailClient({
  initialEmail,
  initiallySent,
  initialSentAt,
  initialExpiresAt,
}: VerifyEmailClientProps) {
  const { t, locale } = useI18n();
  const copy = t.auth.verify;
  useDocumentTitle(copy.title);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(
    initiallySent ? "initially-sent" : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [cooldown, setCooldown] = useState(
    initiallySent ? RESEND_COOLDOWN_SECONDS : 0
  );

  useEffect(() => setError(null), [locale]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);
    if (!validEmail(normalizedEmail)) {
      setError(copy.emailInvalid);
      return;
    }

    setSending(true);
    try {
      const response = await authSession.sendVerificationCode(
        normalizedEmail,
        locale
      );
      const responseSentAt = Date.parse(response.sentAt);
      const responseExpiresAt = Date.parse(response.expiresAt);
      const nextSentAt = Number.isFinite(responseSentAt)
        ? responseSentAt
        : Date.now();
      const nextExpiresAt = Number.isFinite(responseExpiresAt)
        ? responseExpiresAt
        : nextSentAt + response.expiresIn * 1000;
      setEmail(normalizedEmail);
      setSentAt(nextSentAt);
      setExpiresAt(nextExpiresAt);
      setNotice("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
    } finally {
      setSending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setNotice(null);
    if (!validEmail(normalizedEmail)) {
      setError(copy.emailInvalid);
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError(copy.codeInvalid);
      return;
    }

    setSubmitting(true);
    try {
      await authSession.verifyEmail(normalizedEmail, code);
      setVerified(true);
      setNotice("success");
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      icon={<MarkEmailReadRoundedIcon fontSize="large" />}
      footer={
        <Typography variant="body2" color="text.secondary">
          {copy.verifiedPrompt}{" "}
          <MuiLink href="/login" sx={{ fontWeight: 700 }}>
            {copy.login}
          </MuiLink>
        </Typography>
      }
    >
      <Stack component="form" spacing={2} onSubmit={verify} noValidate>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {notice ? (
          <Alert severity={notice === "success" ? "success" : "info"}>
            <Stack spacing={0.5}>
              <span>
                {notice === "success"
                  ? copy.success
                  : notice === "sent"
                    ? copy.sent
                    : copy.initiallySent}
              </span>
              {notice !== "success" && sentAt !== null && expiresAt !== null ? (
                <Typography variant="caption" component="div">
                  {copy.sentAt}: {formatTimestamp(sentAt, locale)}
                  <br />
                  {copy.expiresAt}: {formatTimestamp(expiresAt, locale)}
                </Typography>
              ) : null}
            </Stack>
          </Alert>
        ) : null}
        <TextField
          label={copy.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={verified}
          required
          fullWidth
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: verified
              ? "minmax(0, 1fr)"
              : "minmax(0, 1fr) auto",
            minHeight: 56,
            overflow: "hidden",
            border: "1px solid",
            borderColor: verified ? "action.disabled" : "divider",
            borderRadius: 1,
            transition: (theme) =>
              theme.transitions.create(["border-color", "box-shadow"]),
            "&:focus-within": verified
              ? undefined
              : {
                  borderColor: "primary.main",
                  boxShadow: (theme) =>
                    `0 0 0 1px ${theme.palette.primary.main}`,
                },
          }}
        >
          <InputBase
            placeholder={copy.code}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            disabled={verified}
            required
            fullWidth
            inputProps={{
              maxLength: 6,
              pattern: "[0-9]{6}",
              "aria-label": copy.code,
            }}
            sx={{
              minWidth: 0,
              px: 2,
              "& input": {
                textAlign: "center",
                letterSpacing: code ? ".45em" : "normal",
                textIndent: code ? ".45em" : 0,
                fontSize: "1.2rem",
                fontWeight: 700,
              },
            }}
          />
          {!verified ? (
            <Button
              type="button"
              variant="text"
              disabled={sending || cooldown > 0}
              aria-label={
                sending
                  ? copy.sending
                  : cooldown > 0
                    ? copy.resendIn(cooldown)
                    : sentAt === null
                      ? copy.sendCode
                      : copy.resend
              }
              onClick={() => void sendCode()}
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
              {sending ? (
                <CircularProgress size={17} color="inherit" />
              ) : cooldown > 0 ? (
                `${cooldown}s`
              ) : sentAt === null ? (
                copy.sendCode
              ) : (
                copy.resendShort
              )}
            </Button>
          ) : null}
        </Box>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting || verified}
          sx={{ minHeight: 48, fontWeight: 700 }}
        >
          {submitting ? (
            <CircularProgress size={23} color="inherit" />
          ) : verified ? (
            copy.completed
          ) : (
            copy.submit
          )}
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
