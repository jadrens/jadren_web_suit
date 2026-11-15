"use client";

import { InputAdornment, TextField, Tooltip } from "@mui/material";
import KeyboardCapslockRoundedIcon from "@mui/icons-material/KeyboardCapslockRounded";
import { useI18n } from "@lib/i18n/app";

/** CAPTCHA answer input. Answers are case-insensitive, so typing is forced to capitals and an icon says so. */
export default function CaptchaAnswerField({
  value,
  onChange,
  length,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const copy = t.auth.captcha;
  return (
    <TextField
      label={copy.answer}
      value={value}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
      autoFocus={autoFocus}
      autoComplete="off"
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={copy.capsLocked}>
                <KeyboardCapslockRoundedIcon color="action" aria-label={copy.capsLocked} role="img" />
              </Tooltip>
            </InputAdornment>
          ),
        },
        htmlInput: {
          maxLength: length + 4,
          autoCapitalize: "characters",
          spellCheck: false,
          style: { letterSpacing: "0.3em", fontFamily: "monospace" },
        },
      }}
    />
  );
}
