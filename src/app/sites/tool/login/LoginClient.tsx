"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import AuthPageShell from "@tool/components/auth/AuthPageShell";
import { authErrorMessage } from "@tool/components/auth/form-utils";
import { useAuth } from "@tool/lib/client-api/use-auth";
import { useI18n } from "@tool/lib/i18n";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";

export default function LoginClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const auth = useAuth();
  const { t, locale } = useI18n();
  const copy = t.auth.login;
  useDocumentTitle(copy.title);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setError(null), [locale]);

  useEffect(() => {
    if (auth.status === "authenticated") router.replace(nextPath);
  }, [auth.status, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError(copy.required);
      return;
    }

    setSubmitting(true);
    try {
      await auth.login({ identifier: identifier.trim(), password });
      router.replace(nextPath);
      router.refresh();
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
      icon={<LoginRoundedIcon fontSize="large" />}
      footer={
        <Typography variant="body2" color="text.secondary">
          {copy.noAccount}{" "}
          <MuiLink href="/register" sx={{ fontWeight: 700 }}>
            {copy.register}
          </MuiLink>
        </Typography>
      }
    >
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label={copy.identifier}
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
          autoFocus
          fullWidth
        />
        <TextField
          label={copy.password}
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
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
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting || auth.status === "refreshing"}
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
