import { Resend } from "resend";
import { createHash, randomUUID } from "node:crypto";
import {
  verificationCodeEmail,
  type VerificationEmailLocale,
} from "./emails/verification-code";
import AUTH_CONFIG from "@tool/var/auth";
import { reminderEmail } from "./emails/reminder";
import { db, firstRow } from "./db";

const CODE_LIFETIME_MINUTES = 10;

interface AuditRow {
  audit_id: string;
  content_sha256: string;
  status: "pending" | "sent" | "failed";
  provider_email_id: string | null;
}

async function sendAuditedEmail(input: {
  userId: string | null;
  reminderId: string | null;
  category: "verification" | "reminder";
  recipient: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const senderEmail = input.category === "reminder"
    ? process.env.REMINDER_FROM_EMAIL?.trim() || AUTH_CONFIG.reminderFromEmail
    : process.env.AUTH_FROM_EMAIL?.trim() || AUTH_CONFIG.verificationFromEmail;
  const contentSha256 = createHash("sha256")
    .update(JSON.stringify({
      from: senderEmail,
      to: input.recipient,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }))
    .digest("hex");

  const auditResult = await db.query<AuditRow>(
    `INSERT INTO email_audit_log (
       audit_id, user_id, reminder_id, category, recipient_email,
       sender_email, subject, body_text, body_html, content_sha256,
       idempotency_key, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     ON CONFLICT (idempotency_key) DO UPDATE
       SET updated_at = NOW()
     RETURNING audit_id, content_sha256, status, provider_email_id`,
    [
      randomUUID(), input.userId, input.reminderId, input.category,
      input.recipient, senderEmail, input.subject,
      input.text, input.html, contentSha256, input.idempotencyKey,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  const audit = firstRow(auditResult.rows);
  if (!audit) throw new Error("Email audit insert returned no row");
  if (audit.content_sha256 !== contentSha256) {
    throw new Error("Idempotency key was reused with different email content");
  }
  if (audit.status === "sent" && audit.provider_email_id) {
    return audit.provider_email_id;
  }

  await db.query(
    `UPDATE email_audit_log
        SET status = 'pending', failure_message = NULL, updated_at = NOW()
      WHERE audit_id = $1`,
    [audit.audit_id]
  );

  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from: senderEmail,
        to: [input.recipient],
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
      { idempotencyKey: input.idempotencyKey }
    );
    if (error) throw new Error(`Resend failed to send email: ${error.message}`);
    if (!data?.id) throw new Error("Resend returned no email ID");

    await db.query(
      `UPDATE email_audit_log
          SET status = 'sent', provider_email_id = $2, sent_at = NOW(),
              failure_message = NULL, updated_at = NOW()
        WHERE audit_id = $1`,
      [audit.audit_id, data.id]
    );
    return data.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await db.query(
      `UPDATE email_audit_log
          SET status = 'failed', failure_message = $2, updated_at = NOW()
        WHERE audit_id = $1`,
      [audit.audit_id, message.slice(0, 4000)]
    ).catch((auditError) => console.error("Could not update email audit failure", auditError));
    throw error;
  }
}

export async function sendVerificationEmail(
  userId: string,
  email: string,
  code: string,
  locale: VerificationEmailLocale
) {
  const content = verificationCodeEmail(code, locale, CODE_LIFETIME_MINUTES);
  await sendAuditedEmail({
    userId,
    reminderId: null,
    category: "verification",
    recipient: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: `verification/${randomUUID()}`,
    metadata: { locale, expiresInMinutes: CODE_LIFETIME_MINUTES },
  });
}

export async function sendReminderEmail(input: {
  email: string;
  userId: string;
  reminderId: string;
  title: string;
  note: string;
  scheduledFor: Date;
  quotaResetsAt: Date | null;
  idempotencyKey: string;
}) {
  const content = reminderEmail(input);
  return sendAuditedEmail({
    userId: input.userId,
    reminderId: input.reminderId,
    category: "reminder",
    recipient: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      scheduledFor: input.scheduledFor.toISOString(),
      quotaWarning: Boolean(input.quotaResetsAt),
      quotaResetsAt: input.quotaResetsAt?.toISOString() ?? null,
    },
  });
}
