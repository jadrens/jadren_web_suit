"use client";

import { useState, type FormEvent } from "react";
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
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import AuthPageShell from "@components/ui/auth/AuthPageShell";
import {
  authErrorMessage,
  validEmail,
  validPassword,
} from "@components/ui/auth/form-utils";
import { authSession } from "@lib/client-api";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

export default function RegisterClient() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const copy = t.auth.register;
  useDocumentTitle(copy.title);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedNickname = nickname.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedNickname.length < 2 || normalizedNickname.length > 50) {
      setError(copy.nicknameInvalid);
      return;
    }
    if (!validEmail(normalizedEmail)) {
      setError(copy.emailInvalid);
      return;
    }
    if (!validPassword(password)) {
      setError(copy.passwordInvalid);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);
    try {
      await authSession.register({
        nickname: normalizedNickname,
        email: normalizedEmail,
        password,
      });

      let sentAt: number | null = null;
      let expiresAt: number | null = null;
      try {
        const response = await authSession.sendVerificationCode(
          normalizedEmail,
          locale
        );
        sentAt = Date.parse(response.sentAt);
        expiresAt = Date.parse(response.expiresAt);
        if (!Number.isFinite(sentAt) || !Number.isFinite(expiresAt)) {
          sentAt = null;
          expiresAt = null;
        }
      } catch {
        // Registration succeeded; the verification page can resend the code.
      }
      const query = new URLSearchParams({ email: normalizedEmail });
      if (sentAt !== null && expiresAt !== null) {
        query.set("sent", "1");
        query.set("sentAt", String(sentAt));
        query.set("expiresAt", String(expiresAt));
      }
      router.push(`/verify-email?${query.toString()}`);
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
      icon={<PersonAddAlt1RoundedIcon fontSize="large" />}
      footer={
        <Typography variant="body2" color="text.secondary">
          {copy.existingAccount}{" "}
          <MuiLink href="/login" sx={{ fontWeight: 700 }}>
            {copy.login}
          </MuiLink>
        </Typography>
      }
    >
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label={copy.nickname}
          autoComplete="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { minLength: 2, maxLength: 50 } }}
        />
        <TextField
          label={copy.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
        />
        <TextField
          label={copy.password}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showPassword
                        ? t.auth.common.hidePassword
                        : t.auth.common.showPassword
                    }
                    onClick={() => setShowPassword((value) => !value)}
                    edge="end"
                  >
                    {showPassword ? (
                      <VisibilityOffRoundedIcon />
                    ) : (
                      <VisibilityRoundedIcon />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          label={copy.confirmPassword}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting}
          sx={{ minHeight: 48, fontWeight: 700 }}
        >
          {submitting ? (
            <CircularProgress size={23} color="inherit" />
          ) : (
            copy.submit
          )}
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
