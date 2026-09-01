import { NextResponse } from "next/server";
import { internalError } from "@shared/libs/auth/http";
import {
  db,
  reminderAuthFailure,
  requestReminderUser,
  requireVerifiedReminderUser,
} from "@shared/libs/reminder/server";

interface EmailAuditRow {
  audit_id: string;
  reminder_id: string | null;
  recipient_email: string;
  subject: string;
  body_text: string;
  content_sha256: string;
  status: "pending" | "sent" | "failed";
  provider_email_id: string | null;
  failure_message: string | null;
  created_at: string | Date;
  sent_at: string | Date | null;
}

export async function GET(request: Request) {
  try {
    const user = await requestReminderUser(request);
    const authError = requireVerifiedReminderUser(user);
    if (authError) return authError;

    const result = await db.query<EmailAuditRow>(
      `SELECT audit_id, reminder_id, recipient_email, subject, body_text,
              content_sha256, status, provider_email_id, failure_message,
              created_at, sent_at
         FROM email_audit_log
        WHERE user_id = $1 AND category = 'reminder'
        ORDER BY created_at DESC
        LIMIT 100`,
      [user!.sub]
    );
    return NextResponse.json({
      audits: result.rows.map((row) => ({
        auditId: row.audit_id,
        reminderId: row.reminder_id,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        bodyText: row.body_text,
        contentSha256: row.content_sha256,
        status: row.status,
        providerEmailId: row.provider_email_id,
        failureMessage: row.failure_message,
        createdAt: new Date(row.created_at).toISOString(),
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      })),
    });
  } catch (error) {
    return reminderAuthFailure(error) ?? internalError(error);
  }
}
