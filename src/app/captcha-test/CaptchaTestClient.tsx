"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import AuthPageShell from "@components/ui/auth/AuthPageShell";
import CaptchaAnswerField from "@components/ui/auth/CaptchaAnswerField";
import { authErrorMessage } from "@components/ui/auth/form-utils";
import { authSession } from "@lib/client-api/session";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

interface Challenge {
  id: string;
  url: string;
  length: number;
  shownAt: number;
}

type Outcome = { correct: boolean; seconds: number } | { cancelled: true };

export default function CaptchaTestClient() {
  const { t } = useI18n();
  const copy = t.auth.captchaTest;
  useDocumentTitle(copy.title);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ attempts: 0, solved: 0, totalSeconds: 0 });
  const loadToken = useRef(0);
  const currentUrl = useRef<string | null>(null);

  const load = useCallback(async () => {
    const token = ++loadToken.current;
    setLoading(true);
    setError(null);
    setAnswer("");
    try {
      const { id, image, length } = await authSession.getCaptcha();
      if (token !== loadToken.current) return;
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      const url = URL.createObjectURL(new Blob([new Uint8Array(image)], { type: "image/gif" }));
      currentUrl.current = url;
      setChallenge({ id, url, length, shownAt: Date.now() });
    } catch (requestError) {
      if (token !== loadToken.current) return;
      setChallenge(null);
      setError(authErrorMessage(requestError, t.auth.errors));
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, [t.auth.errors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first challenge is fetched once the page mounts.
    void load();
    const tokens = loadToken;
    const urls = currentUrl;
    return () => {
      tokens.current++;
      if (urls.current) URL.revokeObjectURL(urls.current);
    };
  }, [load]);

  function record(correct: boolean, seconds: number) {
    setOutcome({ correct, seconds });
    setStats((previous) => ({
      attempts: previous.attempts + 1,
      solved: previous.solved + (correct ? 1 : 0),
      totalSeconds: previous.totalSeconds + seconds,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = answer.replace(/\s+/g, "");
    if (!challenge || !value || checking) return;
    setChecking(true);
    setError(null);
    try {
      const seconds = (Date.now() - challenge.shownAt) / 1000;
      record(await authSession.checkCaptcha(challenge.id, value), seconds);
      // The check consumed this challenge.
      await load();
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
    } finally {
      setChecking(false);
    }
  }

  async function tryDialog() {
    setError(null);
    const startedAt = Date.now();
    try {
      const correct = await authSession.tryCaptchaDialog();
      if (correct === null) setOutcome({ cancelled: true });
      else record(correct, (Date.now() - startedAt) / 1000);
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
    }
  }

  const average = stats.attempts ? (stats.totalSeconds / stats.attempts).toFixed(1) : "–";

  return (
    <AuthPageShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      icon={<VerifiedUserRoundedIcon fontSize="large" />}
      footer={
        <Typography variant="body2" color="text.secondary">
          {copy.rules}
        </Typography>
      }
    >
      <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {outcome ? (
          "cancelled" in outcome ? (
            <Alert severity="info">{copy.dialogCancelled}</Alert>
          ) : (
            <Alert severity={outcome.correct ? "success" : "warning"}>
              {outcome.correct ? copy.correct : copy.incorrect} ·{" "}
              {copy.solvedIn.replace("{seconds}", outcome.seconds.toFixed(1))}
            </Alert>
          )
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t.auth.captcha.hint.replace("{length}", String(challenge?.length ?? 5))}
        </Typography>
        <Box
          sx={{
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
              alt={t.auth.captcha.imageAlt}
              width={200}
              height={72}
              style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
            />
          ) : loading ? (
            <CircularProgress size={24} />
          ) : null}
        </Box>
        <CaptchaAnswerField value={answer} onChange={setAnswer} length={challenge?.length ?? 5} />
        <Stack direction="row" spacing={1}>
          <Button
            type="submit"
            variant="contained"
            disabled={!challenge || !answer.trim() || checking}
            sx={{ flex: 1, minHeight: 44, fontWeight: 700 }}
          >
            {checking ? <CircularProgress size={22} color="inherit" /> : copy.check}
          </Button>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => void load()} disabled={loading}>
            {copy.next}
          </Button>
        </Stack>
        <Divider />
        <Stack direction="row" sx={{ justifyContent: "space-between", textAlign: "center" }}>
          {[
            [copy.attempts, String(stats.attempts)],
            [copy.solved, String(stats.solved)],
            [copy.averageTime, average === "–" ? average : `${average} s`],
          ].map(([label, value]) => (
            <Box key={label} sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{value}</Typography>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Box>
          ))}
        </Stack>
        <Button variant="text" onClick={() => void tryDialog()}>
          {copy.dialog}
        </Button>
      </Stack>
    </AuthPageShell>
  );
}
