export type VerificationEmailLocale = "en" | "zh";
export type VerificationEmailPurpose = "register" | "verify" | "reset";

const EMAIL_COPY = {
  en: {
    htmlLang: "en",
    title: "Email verification code",
    header: "Email verification",
    heading: "Your verification code",
    instruction: "Enter this code on the verification page:",
    expiry: (minutes: number) =>
      `This code expires in ${minutes} minutes. Do not share it with anyone.`,
    ignore: "If you did not request this code, you can safely ignore this email.",
    footer: "This is an automated message from jadren tools. Please do not reply.",
    subject: "Your jadren tools verification code",
  },
  zh: {
    htmlLang: "zh-CN",
    title: "邮箱验证码",
    header: "邮箱身份验证",
    heading: "你的验证码",
    instruction: "请在验证页面输入以下验证码：",
    expiry: (minutes: number) =>
      `验证码将在 ${minutes} 分钟后失效，请勿向任何人透露。`,
    ignore: "如果这不是你的操作，可以安全地忽略此邮件。",
    footer: "此邮件由 jadren tools 自动发送，请勿直接回复。",
    subject: "你的 jadren tools 邮箱验证码",
  },
} as const;

// What the code is for changes the wording; the layout stays the same.
const PURPOSE_COPY: Record<
  VerificationEmailLocale,
  Record<VerificationEmailPurpose, { header: string; instruction: string; subject: string; textLead: string }>
> = {
  en: {
    register: {
      header: "Create your account",
      instruction: "Enter this code on the sign-up page to confirm your email:",
      subject: "Confirm your email for jadren tools",
      textLead: "Your jadren tools sign-up code is",
    },
    verify: {
      header: EMAIL_COPY.en.header,
      instruction: EMAIL_COPY.en.instruction,
      subject: EMAIL_COPY.en.subject,
      textLead: "Your jadren tools verification code is",
    },
    reset: {
      header: "Password reset",
      instruction: "Enter this code on the password reset page to choose a new password:",
      subject: "Reset your jadren tools password",
      textLead: "Your jadren tools password reset code is",
    },
  },
  zh: {
    register: {
      header: "注册账户",
      instruction: "请在注册页面输入以下验证码以确认你的邮箱：",
      subject: "确认你的 jadren tools 注册邮箱",
      textLead: "你的 jadren tools 注册验证码是",
    },
    verify: {
      header: EMAIL_COPY.zh.header,
      instruction: EMAIL_COPY.zh.instruction,
      subject: EMAIL_COPY.zh.subject,
      textLead: "你的 jadren tools 邮箱验证码是",
    },
    reset: {
      header: "重置密码",
      instruction: "请在重置密码页面输入以下验证码以设置新密码：",
      subject: "重置你的 jadren tools 密码",
      textLead: "你的 jadren tools 密码重置验证码是",
    },
  },
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character
  );
}

export function verificationCodeEmail(
  code: string,
  locale: VerificationEmailLocale,
  expiresInMinutes = 10,
  purpose: VerificationEmailPurpose = "verify"
) {
  const copy = { ...EMAIL_COPY[locale], ...PURPOSE_COPY[locale][purpose] };
  const safeCode = escapeHtml(code);
  const html = `<!doctype html>
<html lang="${copy.htmlLang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${copy.title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#17202a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e6e9ed;overflow:hidden;">
            <tr>
              <td style="padding:32px 36px 20px;text-align:center;background:#111827;color:#ffffff;">
                <div style="font-size:22px;font-weight:700;letter-spacing:.3px;">jadren tools</div>
                <div style="margin-top:8px;font-size:14px;color:#cbd5e1;">${copy.header}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 36px;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.4;text-align:center;">${copy.heading}</h1>
                <p style="margin:0 0 26px;font-size:15px;line-height:1.7;text-align:center;color:#4b5563;">${copy.instruction}</p>
                <div style="padding:18px 12px;border-radius:12px;background:#f3f4f6;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#111827;">${safeCode}</div>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.7;text-align:center;color:#6b7280;">${copy.expiry(expiresInMinutes)}</p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.7;text-align:center;color:#9ca3af;">${copy.ignore}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-top:1px solid #eef0f2;text-align:center;font-size:12px;color:#9ca3af;">${copy.footer}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    subject: copy.subject,
    text: `${copy.textLead} ${code}${locale === "zh" ? "。" : ". "}${copy.expiry(expiresInMinutes)}`,
    html,
  };
}
