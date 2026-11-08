"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Box,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import AuthPageShell from "@components/ui/auth/AuthPageShell";
import CodeField, { useResendCooldown } from "@components/ui/auth/CodeField";
import {
  authErrorMessage,
  validEmail,
  validPassword,
} from "@components/ui/auth/form-utils";
import { authSession } from "@lib/client-api";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";

type Field = "email" | "nickname" | "password" | "confirmPassword";
const FIELDS: readonly Field[] = ["email", "nickname", "password", "confirmPassword"];

/** 0 (empty) to 4 (strong): length plus the variety of character classes. */
function passwordStrength(password: string): number {
  if (!password) return 0;
  if (!validPassword(password)) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (password.length >= 12) score++;
  if (classes >= 2) score++;
  if (classes >= 3 && password.length >= 10) score++;
  return Math.min(score, 4);
}

const STRENGTH_COLORS = ["divider", "error.main", "warning.main", "info.main", "success.main"] as const;

function FieldIcon({ children }: { children: ReactNode }) {
  return (
    <InputAdornment position="start" sx={{ color: "text.disabled", "& .MuiSvgIcon-root": { fontSize: 20 } }}>
      {children}
    </InputAdornment>
  );
}

// Only called from event handlers; kept outside the component for the purity lint.
const currentTime = () => Date.now();

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
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    nickname: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const inputRefs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  // Step two: the details are kept while the user confirms the e-mail with a code.
  const [step, setStep] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const cooldown = useResendCooldown();

  const fieldErrors: Record<Field, string | null> = {
    // Empty is allowed: the server then uses the email's local part.
    nickname:
      nickname.trim() && (nickname.trim().length < 2 || nickname.trim().length > 50 || nickname.includes("@"))
        ? copy.nicknameInvalid
        : null,
    email: validEmail(email.trim().toLowerCase()) ? null : copy.emailInvalid,
    password: validPassword(password) ? null : copy.passwordInvalid,
    confirmPassword: password === confirmPassword && confirmPassword ? null : copy.passwordMismatch,
  };
  const visibleError = (field: Field) => (touched[field] ? fieldErrors[field] : null);
  const markTouched = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));

  const strength = passwordStrength(password);
  const strengthLabels = [
    "",
    copy.strengthWeak,
    copy.strengthFair,
    copy.strengthGood,
    copy.strengthStrong,
  ];
  const emailLocalPart = validEmail(email) ? email.trim().split("@")[0].slice(0, 50) : "";
  const nicknameHelp =
    visibleError("nickname") ??
    (!nickname.trim() && emailLocalPart.length >= 2 ? copy.nicknameDefault(emailLocalPart) : copy.nicknameHint);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const normalizedEmail = email.trim().toLowerCase();

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const response = await authSession.sendRegistrationCode(normalizedEmail, locale);
      const expires = Date.parse(response.expiresAt);
      setCodeExpiresAt(Number.isFinite(expires) ? expires : currentTime() + response.expiresIn * 1000);
      setCodeSentTo(normalizedEmail);
      cooldown.start();
      return true;
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const firstInvalid = FIELDS.find((field) => fieldErrors[field]);
    if (firstInvalid) {
      setTouched({ nickname: true, email: true, password: true, confirmPassword: true });
      inputRefs.current[firstInvalid]?.focus();
      return;
    }
    // Going back and continuing again with the same e-mail reuses the code already sent.
    if (codeSentTo === normalizedEmail && codeExpiresAt !== null && codeExpiresAt > currentTime()) {
      setStep("code");
      return;
    }
    if (await sendCode()) {
      setCode("");
      setStep("code");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t.auth.verify.codeInvalid);
      return;
    }
    setSubmitting(true);
    try {
      await authSession.register({ nickname: nickname.trim(), email: normalizedEmail, password, code });
      router.replace("/");
    } catch (requestError) {
      setError(authErrorMessage(requestError, t.auth.errors));
      setSubmitting(false);
    }
  }

  const expiryTime =
    codeExpiresAt === null
      ? ""
      : new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(codeExpiresAt);

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
      {step === "code" ? (
        <Stack component="form" spacing={2.25} onSubmit={handleCreate} noValidate>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Alert severity="info" icon={<MailOutlineRoundedIcon />}>
            {copy.codeSentTo(normalizedEmail)}
            {expiryTime ? <Typography variant="caption" component="div">{copy.codeExpires(expiryTime)}</Typography> : null}
          </Alert>
          <CodeField
            value={code}
            onChange={setCode}
            onResend={() => void sendCode()}
            sending={sending}
            cooldown={cooldown.seconds}
            autoFocus
            labels={{
              code: t.auth.verify.code,
              resend: t.auth.verify.resendShort,
              sending: t.auth.verify.sending,
              resendIn: t.auth.verify.resendIn,
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || code.length !== 6}
            disableElevation
            sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2.5 }}
          >
            {submitting ? <CircularProgress size={23} color="inherit" /> : copy.createAccount}
          </Button>
          <Button type="button" variant="text" onClick={() => { setError(null); setStep("details"); }}>
            {copy.changeDetails}
          </Button>
        </Stack>
      ) : (
      <Stack component="form" spacing={2.25} onSubmit={handleDetails} noValidate>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TextField
          label={copy.email}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => markTouched("email")}
          inputRef={(node: HTMLInputElement | null) => { inputRefs.current.email = node; }}
          error={!!visibleError("email")}
          helperText={visibleError("email")}
          required
          fullWidth
          autoFocus
          slotProps={{
            input: { startAdornment: <FieldIcon><MailOutlineRoundedIcon /></FieldIcon> },
          }}
        />
        <TextField
          label={copy.nickname}
          autoComplete="nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          onBlur={() => markTouched("nickname")}
          inputRef={(node: HTMLInputElement | null) => { inputRefs.current.nickname = node; }}
          error={!!visibleError("nickname")}
          helperText={nicknameHelp}
          fullWidth
          slotProps={{
            htmlInput: { minLength: 2, maxLength: 50 },
            input: { startAdornment: <FieldIcon><BadgeOutlinedIcon /></FieldIcon> },
          }}
        />
        <Box>
          <TextField
            label={copy.password}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => markTouched("password")}
            inputRef={(node: HTMLInputElement | null) => { inputRefs.current.password = node; }}
            error={!!visibleError("password")}
            helperText={visibleError("password") ?? copy.passwordHint}
            required
            fullWidth
            slotProps={{
              input: {
                startAdornment: <FieldIcon><LockOutlinedIcon /></FieldIcon>,
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
          {password ? (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", mt: 1, px: 1.75 }}
              aria-label={`${copy.strength}: ${strengthLabels[strength]}`}
            >
              <Stack direction="row" spacing={0.5} sx={{ flex: 1 }} aria-hidden>
                {[1, 2, 3, 4].map((step) => (
                  <Box
                    key={step}
                    sx={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      bgcolor: step <= strength ? STRENGTH_COLORS[strength] : "divider",
                      transition: "background-color .2s",
                    }}
                  />
                ))}
              </Stack>
              <Typography
                variant="caption"
                sx={{ minWidth: 40, textAlign: "right", fontWeight: 700, color: STRENGTH_COLORS[strength] }}
              >
                {strengthLabels[strength]}
              </Typography>
            </Stack>
          ) : null}
        </Box>
        <TextField
          label={copy.confirmPassword}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={() => markTouched("confirmPassword")}
          inputRef={(node: HTMLInputElement | null) => { inputRefs.current.confirmPassword = node; }}
          error={!!visibleError("confirmPassword")}
          helperText={visibleError("confirmPassword") ?? (passwordsMatch ? copy.passwordsMatch : undefined)}
          required
          fullWidth
          slotProps={{
            input: {
              startAdornment: <FieldIcon><LockOutlinedIcon /></FieldIcon>,
              endAdornment: passwordsMatch ? (
                <InputAdornment position="end">
                  <CheckCircleRoundedIcon color="success" fontSize="small" />
                </InputAdornment>
              ) : null,
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={sending}
          disableElevation
          sx={{ minHeight: 48, fontWeight: 700, borderRadius: 2.5 }}
        >
          {sending ? (
            <CircularProgress size={23} color="inherit" />
          ) : (
            copy.submit
          )}
        </Button>
      </Stack>
      )}
    </AuthPageShell>
  );
}
