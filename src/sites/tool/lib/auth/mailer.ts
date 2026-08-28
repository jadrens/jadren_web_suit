import { Resend } from "resend";
import {
  verificationCodeEmail,
  type VerificationEmailLocale,
} from "./emails/verification-code";
import AUTH_CONFIG from "@tool/var/auth";

const CODE_LIFETIME_MINUTES = 10;

export async function sendVerificationEmail(
  email: string,
  code: string,
  locale: VerificationEmailLocale
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);
  const content = verificationCodeEmail(code, locale, CODE_LIFETIME_MINUTES);
  const { data, error } = await resend.emails.send({
    from: AUTH_CONFIG.resendFromEmail,
    to: [email],
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (error) {
    throw new Error(`Resend failed to send verification email: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend returned no email ID");
  }
}
