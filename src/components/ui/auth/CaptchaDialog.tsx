"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { authSession } from "@lib/client-api/session";
import type { CaptchaReason } from "@lib/client-api/auth-session";
import { useI18n } from "@lib/i18n/app";
import { authErrorMessage } from "./form-utils";
import CaptchaAnswerField from "./CaptchaAnswerField";

interface Challenge {
  id: string;
  url: string;
  length: number;
}

/**
 * Answers the auth session's CAPTCHA prompts. Mounted once with the auth
 * lifecycle, so every page that calls a guarded auth RPC gets the dialog.
 */
export default function CaptchaDialog() {
  const { t } = useI18n();
  const copy = t.auth.captcha;
  const [reason, setReason] = useState<CaptchaReason | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((solution: string | null) => void) | null>(null);
  const loadToken = useRef(0);

  const replaceChallenge = useCallback((next: Challenge | null) => {
    setChallenge((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    const token = ++loadToken.current;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const { id, image, length } = await authSession.getCaptcha();
      if (token !== loadToken.current) return;
      const url = URL.createObjectURL(new Blob([new Uint8Array(image)], { type: "image/gif" }));
      replaceChallenge({ id, url, length });
    } catch (requestError) {
      if (token !== loadToken.current) return;
      replaceChallenge(null);
      setError(authErrorMessage(requestError, t.auth.errors));
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, [replaceChallenge, t.auth.errors]);

  const settle = useCallback((solution: string | null) => {
    resolver.current?.(solution);
    resolver.current = null;
    loadToken.current++;
    setReason(null);
    setLoading(false);
    replaceChallenge(null);
  }, [replaceChallenge]);

  useEffect(() => authSession.setCaptchaSolver((nextReason) => {
    // A newer prompt supersedes one still open.
    resolver.current?.(null);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setReason(nextReason);
      void load();
    });
  }), [load]);

  useEffect(() => () => {
    resolver.current?.(null);
    resolver.current = null;
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = answer.replace(/\s+/g, "");
    if (!challenge || value.length !== challenge.length) return;
    settle(`${challenge.id}.${value.toUpperCase()}`);
  }

  const ready = !!challenge && answer.replace(/\s+/g, "").length === challenge.length;

  return (
    <Dialog open={reason !== null} onClose={() => settle(null)} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle sx={{ fontWeight: 700 }}>{copy.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {reason === "captcha_invalid" ? <Alert severity="warning">{copy.retry}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Typography variant="body2" color="text.secondary">
              {copy.hint.replace("{length}", String(challenge?.length ?? 5))}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  flex: 1,
                  aspectRatio: "200 / 72",
                  borderRadius: 1,
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "action.hover",
                }}
              >
                {challenge ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob URL of a server-rendered GIF
                  <img
                    src={challenge.url}
                    alt={copy.imageAlt}
                    width={200}
                    height={72}
                    style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
                  />
                ) : loading ? (
                  <CircularProgress size={24} />
                ) : null}
              </Box>
              <Tooltip title={copy.refresh}>
                <span>
                  <IconButton aria-label={copy.refresh} onClick={() => void load()} disabled={loading}>
                    <RefreshRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <CaptchaAnswerField value={answer} onChange={setAnswer} length={challenge?.length ?? 5} autoFocus />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => settle(null)}>{copy.cancel}</Button>
          <Button type="submit" variant="contained" disabled={!ready}>
            {copy.submit}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
