"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockResetRoundedIcon from "@mui/icons-material/LockResetRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import { createRequestGate } from "@components/ui/auth/request-gate";
import AuthPageShell from "@components/ui/auth/AuthPageShell";
import CodeField, { useResendCooldown } from "@components/ui/auth/CodeField";
import { authErrorMessage, validEmail, validPassword } from "@components/ui/auth/form-utils";
import { authSession } from "@lib/client-api";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

export default function ResetPasswordClient({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const copy = t.auth.reset;
  useDocumentTitle(copy.title);
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cooldown = useResendCooldown();
  const requestGate = useRef(createRequestGate());
  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    setError(null);
    if (!validEmail(normalizedEmail)) {
      setError(t.auth.register.emailInvalid);
      return false;
    }
    const release = requestGate.current.acquire();
    if (!release) return false;
    setSending(true);
    try {
      await authSession.sendPasswordResetCode(normalizedEmail, locale);
      cooldown.start();
      return true;
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
      return false;
    } finally {
      setSending(false);
      release();
    }
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await sendCode()) {
      setCode("");
      setStep("reset");
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError(t.auth.verify.codeInvalid);
    if (!validPassword(password)) return setError(t.auth.register.passwordInvalid);
    if (password !== confirmPassword) return setError(t.auth.register.passwordMismatch);

    const release = requestGate.current.acquire();
    if (!release) return;
    setSubmitting(true);
    try {
      await authSession.resetPassword(normalizedEmail, code, password);
      router.replace("/");
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
      setSubmitting(false);
    } finally {
      release();
    }
  }

  const visibility = (
    <InputAdornment position="end">
      <IconButton
        aria-label={showPassword ? t.auth.common.hidePassword : t.auth.common.showPassword}
        onClick={() => setShowPassword((value) => !value)}
        edge="end"
      >
        {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <AuthPageShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      icon={<LockResetRoundedIcon fontSize="large" />}
      footer={
        <Typography variant="body2" color="text.secondary">
          {copy.remembered}{" "}
          <MuiLink href="/login" sx={{ fontWeight: 700 }}>
            {copy.login}
          </MuiLink>
        </Typography>
      }
    >
      {step === "email" ? (
        <Stack component="form" spacing={2.25} onSubmit={handleEmail} noValidate>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label={copy.email}
            disabled={sending}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Button type="submit" variant="contained" size="large" disabled={sending} disableElevation sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2.5 }}>
            {sending ? <CircularProgress size={23} color="inherit" /> : copy.sendCode}
          </Button>
        </Stack>
      ) : (
        <Stack component="form" spacing={2.25} onSubmit={handleReset} noValidate>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Alert severity="info" icon={<MailOutlineRoundedIcon />}>
            {copy.codeSentTo(normalizedEmail)}
          </Alert>
          <CodeField
            value={code}
            onChange={setCode}
            onResend={() => void sendCode()}
            sending={sending}
            disabled={sending || submitting}
            cooldown={cooldown.seconds}
            autoFocus
            labels={{
              code: t.auth.verify.code,
              resend: t.auth.verify.resendShort,
              sending: t.auth.verify.sending,
              resendIn: t.auth.verify.resendIn,
            }}
          />
          <TextField
            label={copy.newPassword}
            disabled={sending || submitting}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            helperText={t.auth.register.passwordHint}
            required
            fullWidth
            slotProps={{ input: { endAdornment: visibility } }}
          />
          <TextField
            label={copy.confirmPassword}
            disabled={sending || submitting}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={sending || submitting || code.length !== 6} disableElevation sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2.5 }}>
            {submitting ? <CircularProgress size={23} color="inherit" /> : copy.submit}
          </Button>
          <Button type="button" variant="text" disabled={sending || submitting} onClick={() => { setError(null); setStep("email"); }}>
            {copy.changeEmail}
          </Button>
        </Stack>
      )}
    </AuthPageShell>
  );
}
