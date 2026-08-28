import { randomUUID } from "node:crypto";
import { closeDb, db, firstRow, withTransaction } from "../src/sites/tool/lib/auth/db";
import { sendReminderEmail } from "../src/sites/tool/lib/auth/mailer";
import {
  nextOccurrenceAfter,
  REMINDER_EMAILS_PER_UTC_HOUR,
  utcHourWindow,
} from "../src/sites/tool/lib/reminder/validation";

interface CandidateRow {
  reminder_id: string;
  user_id: string;
}

interface DueReminderRow {
  reminder_id: string;
  user_id: string;
  title: string;
  note: string;
  next_remind_at: Date;
  repeat_interval_minutes: number | null;
  email: string;
  user_status: number;
}

interface ExistingAuditRow {
  status: "pending" | "sent" | "failed";
  provider_email_id: string | null;
  quota_warning: boolean;
}

async function advanceReminder(
  client: Parameters<Parameters<typeof withTransaction>[0]>[0],
  reminder: DueReminderRow,
  now: Date,
  sent: boolean
) {
  if (reminder.repeat_interval_minutes === null) {
    await client.query(
      `UPDATE reminder_event
          SET status = 'completed', completed_at = $2, updated_at = $2,
              last_sent_at = CASE WHEN $3 THEN $2 ELSE last_sent_at END
        WHERE reminder_id = $1`,
      [reminder.reminder_id, now, sent]
    );
    return;
  }
  const next = nextOccurrenceAfter(
    new Date(reminder.next_remind_at),
    reminder.repeat_interval_minutes,
    now
  );
  await client.query(
    `UPDATE reminder_event
        SET next_remind_at = $2, updated_at = $3,
            last_sent_at = CASE WHEN $4 THEN $3 ELSE last_sent_at END
      WHERE reminder_id = $1`,
    [reminder.reminder_id, next, now, sent]
  );
}

async function processReminder(candidate: CandidateRow) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [candidate.user_id]);
    const result = await client.query<DueReminderRow>(
      `SELECT r.reminder_id, r.user_id, r.title, r.note, r.next_remind_at,
              r.repeat_interval_minutes, u.email, u.status AS user_status
         FROM reminder_event r
         JOIN user_main u ON u.user_id = r.user_id
        WHERE r.reminder_id = $1 AND r.user_id = $2
          AND r.status = 'active' AND r.next_remind_at <= NOW()
        FOR UPDATE OF r`,
      [candidate.reminder_id, candidate.user_id]
    );
    const reminder = firstRow(result.rows);
    if (!reminder || reminder.user_status !== 1) return false;

    const now = new Date();
    const scheduledFor = new Date(reminder.next_remind_at);
    const eventKey = `reminder/${reminder.reminder_id}/${scheduledFor.getTime()}`;
    const existing = await client.query<{ status: string }>(
      "SELECT status FROM reminder_delivery WHERE event_key = $1 LIMIT 1",
      [eventKey]
    );
    if (existing.rows[0]) {
      await advanceReminder(client, reminder, now, existing.rows[0].status === "sent");
      return true;
    }

    const auditResult = await client.query<ExistingAuditRow>(
      `SELECT status, provider_email_id,
              COALESCE((metadata->>'quotaWarning')::boolean, FALSE) AS quota_warning
         FROM email_audit_log
        WHERE idempotency_key = $1
        LIMIT 1`,
      [eventKey]
    );
    const existingAudit = firstRow(auditResult.rows);
    if (existingAudit?.status === "sent" && existingAudit.provider_email_id) {
      await client.query(
        `INSERT INTO reminder_delivery (
           delivery_id, event_key, reminder_id, user_id, scheduled_for,
           status, provider_email_id, quota_warning
         ) VALUES ($1, $2, $3, $4, $5, 'sent', $6, $7)`,
        [
          randomUUID(), eventKey, reminder.reminder_id, reminder.user_id,
          scheduledFor, existingAudit.provider_email_id, existingAudit.quota_warning,
        ]
      );
      await advanceReminder(client, reminder, now, true);
      return true;
    }

    const hour = utcHourWindow(now);
    const countResult = await client.query<{ sent_count: string }>(
      `SELECT COUNT(*)::text AS sent_count
         FROM email_audit_log
        WHERE user_id = $1 AND category = 'reminder' AND status = 'sent'
          AND sent_at >= $2 AND sent_at < $3`,
      [reminder.user_id, hour.start, hour.end]
    );
    const sentCount = Number(countResult.rows[0]?.sent_count ?? 0);
    if (sentCount >= REMINDER_EMAILS_PER_UTC_HOUR) {
      await client.query(
        `INSERT INTO reminder_delivery (
           delivery_id, event_key, reminder_id, user_id, scheduled_for, status
         ) VALUES ($1, $2, $3, $4, $5, 'rate_limited')`,
        [randomUUID(), eventKey, reminder.reminder_id, reminder.user_id, scheduledFor]
      );
      await advanceReminder(client, reminder, now, false);
      return true;
    }

    const quotaWarning = sentCount === REMINDER_EMAILS_PER_UTC_HOUR - 1;
    const providerEmailId = await sendReminderEmail({
      userId: reminder.user_id,
      reminderId: reminder.reminder_id,
      email: reminder.email,
      title: reminder.title,
      note: reminder.note,
      scheduledFor,
      quotaResetsAt: quotaWarning ? hour.end : null,
      idempotencyKey: eventKey,
    });
    await client.query(
      `INSERT INTO reminder_delivery (
         delivery_id, event_key, reminder_id, user_id, scheduled_for,
         status, provider_email_id, quota_warning
       ) VALUES ($1, $2, $3, $4, $5, 'sent', $6, $7)`,
      [
        randomUUID(), eventKey, reminder.reminder_id, reminder.user_id,
        scheduledFor, providerEmailId, quotaWarning,
      ]
    );
    await advanceReminder(client, reminder, now, true);
    return true;
  });
}

async function dispatch() {
  const candidates = await db.query<CandidateRow>(
    `SELECT reminder_id, user_id
       FROM reminder_event
      WHERE status = 'active' AND next_remind_at <= NOW()
      ORDER BY next_remind_at ASC
      LIMIT 100`
  );
  let processed = 0;
  let failed = 0;
  for (const candidate of candidates.rows) {
    try {
      if (await processReminder(candidate)) processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Reminder dispatch failed for ${candidate.reminder_id}`, error);
    }
  }
  console.info(`Reminder dispatch complete: ${processed} processed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} reminder deliveries failed`);
}

try {
  await dispatch();
} finally {
  await closeDb();
}
