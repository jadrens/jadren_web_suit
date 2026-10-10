import { randomUUID } from "node:crypto";
import type { ServiceImpl } from "@connectrpc/connect";
import type { LlmSettingsService, QuickLinkService, ReminderService } from "@gen/jadren/v1/account_pb";
import { db, firstRow } from "@lib/auth/db";
import { bearerToken, verifyAccessToken } from "@lib/auth/jwt";
import {
  reminderSelect,
  toReminder,
  verifiedReminderUser,
  type ReminderRow,
  type ReminderStatus,
} from "@lib/reminder/server";
import { parseReminderContent, parseReminderInput, parseReminderSchedule } from "@lib/reminder/validation";
import { apiFailure, isUniqueViolation } from "../errors";
import { headersOf } from "../context";

// --- Quick links -----------------------------------------------------------

interface QuickLinkRow {
  short_name: string;
  target_url: string;
  note: string | null;
  created_at: string | Date;
  expire_at: string | Date;
  click_count: string;
}

const SHORT_NAME_PATTERN = /^[A-Za-z0-9]{1,64}$/;
const QUICK_LINK_COLUMNS = `short_name, target_url, note, created_at, expire_at,
              click_count::text`;

function toQuickLink(row: QuickLinkRow) {
  return {
    shortName: row.short_name,
    targetUrl: row.target_url,
    note: row.note ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expire_at).toISOString(),
    clickCount: row.click_count,
  };
}

function normalizeTargetUrl(value: string) {
  if (value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Empty clears the note; undefined means the note is invalid. */
function normalizeNote(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const note = value.trim();
  return note.length <= 255 ? note || null : undefined;
}

async function quickLinkUser(headers: { headers: Headers }) {
  const token = bearerToken(headers);
  if (!token) throw apiFailure("Bearer token is required", 401, "token_required");
  let user;
  try {
    user = await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
    throw apiFailure("Token is invalid or expired", 401, "invalid_token");
  }
  if (user.status === 2) throw apiFailure("Account is unavailable", 403, "account_unavailable");
  return user;
}

export const quickLinkService: ServiceImpl<typeof QuickLinkService> = {
  async listQuickLinks(_request, context) {
    const user = await quickLinkUser(headersOf(context));
    const result = await db.query<QuickLinkRow>(
      `SELECT ${QUICK_LINK_COLUMNS}
         FROM quick_link
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [user.sub]
    );
    return { links: result.rows.map(toQuickLink) };
  },

  async createQuickLink(request, context) {
    const user = await quickLinkUser(headersOf(context));

    const shortName = request.shortName.trim();
    if (!SHORT_NAME_PATTERN.test(shortName)) {
      throw apiFailure("Short name must contain only 1-64 letters or numbers", 400, "invalid_short_name");
    }
    const targetUrl = normalizeTargetUrl(request.targetUrl);
    if (!targetUrl) {
      throw apiFailure("Target URL must be a valid HTTP or HTTPS URL", 400, "invalid_target_url");
    }
    const note = normalizeNote(request.note);
    if (note === undefined) {
      throw apiFailure("Note must contain no more than 255 characters", 400, "invalid_note");
    }
    const expiresAt = new Date(request.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw apiFailure("Expiration date is invalid", 400, "invalid_expiration");
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw apiFailure("Expiration date must be in the future", 400, "expiration_not_future");
    }

    try {
      const result = await db.query<QuickLinkRow>(
        `INSERT INTO quick_link (short_name, user_id, target_url, note, expire_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${QUICK_LINK_COLUMNS}`,
        [shortName, user.sub, targetUrl, note, expiresAt]
      );
      const link = firstRow(result.rows);
      if (!link) throw new Error("Quick-link insert returned no row");
      return { link: toQuickLink(link) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw apiFailure("Short name is already in use", 409, "quick_link_exists");
      }
      throw error;
    }
  },

  async updateQuickLink(request, context) {
    const user = await quickLinkUser(headersOf(context));
    const { shortName } = request;

    const currentResult = await db.query<QuickLinkRow>(
      `SELECT ${QUICK_LINK_COLUMNS}
         FROM quick_link
        WHERE short_name = $1 AND user_id = $2
        LIMIT 1`,
      [shortName, user.sub]
    );
    const current = firstRow(currentResult.rows);
    if (!current) throw apiFailure("Quick link was not found", 404, "quick_link_not_found");

    let targetUrl = current.target_url;
    let note = current.note;
    let expiresAt = new Date(current.expire_at);
    let changed = false;

    if (request.targetUrl !== undefined) {
      const normalized = normalizeTargetUrl(request.targetUrl);
      if (!normalized) {
        throw apiFailure("Target URL must be a valid HTTP or HTTPS URL", 400, "invalid_target_url");
      }
      targetUrl = normalized;
      changed = true;
    }
    if (request.note !== undefined) {
      const normalized = normalizeNote(request.note);
      if (normalized === undefined) {
        throw apiFailure("Note must contain no more than 255 characters", 400, "invalid_note");
      }
      note = normalized;
      changed = true;
    }
    if (request.disable === true) {
      expiresAt = new Date();
      changed = true;
    } else if (request.expiresAt !== undefined) {
      const nextExpiration = new Date(request.expiresAt);
      if (!Number.isFinite(nextExpiration.getTime())) {
        throw apiFailure("Expiration date is invalid", 400, "invalid_expiration");
      }
      if (
        nextExpiration.getTime() <= Date.now() ||
        nextExpiration.getTime() <= new Date(current.expire_at).getTime()
      ) {
        throw apiFailure("Expiration date must extend the current expiration", 400, "expiration_not_extended");
      }
      expiresAt = nextExpiration;
      changed = true;
    }
    if (!changed) throw apiFailure("No supported changes were provided", 400, "empty_update");

    const result = await db.query<QuickLinkRow>(
      `UPDATE quick_link
          SET target_url = $3, note = $4, expire_at = $5
        WHERE short_name = $1 AND user_id = $2
        RETURNING ${QUICK_LINK_COLUMNS}`,
      [shortName, user.sub, targetUrl, note, expiresAt]
    );
    const link = firstRow(result.rows);
    if (!link) throw apiFailure("Quick link was not found", 404, "quick_link_not_found");
    return { link: toQuickLink(link) };
  },

  async deleteQuickLink(request, context) {
    const user = await quickLinkUser(headersOf(context));
    const result = await db.query<{ short_name: string }>(
      `DELETE FROM quick_link
        WHERE short_name = $1 AND user_id = $2
        RETURNING short_name`,
      [request.shortName, user.sub]
    );
    if (!firstRow(result.rows)) throw apiFailure("Quick link was not found", 404, "quick_link_not_found");
    return {};
  },
};

// --- Reminders -------------------------------------------------------------

const REMINDER_RETURNING = `RETURNING reminder_id, title, note, remind_at, next_remind_at,
                    repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                    last_sent_at, completed_at, NULL::varchar AS last_delivery_status`;

function reminderMessage(row: ReminderRow) {
  const reminder = toReminder(row);
  return {
    ...reminder,
    remindAt: reminder.remindAt ?? undefined,
    nextRemindAt: reminder.nextRemindAt ?? undefined,
    repeatIntervalMinutes: reminder.repeatIntervalMinutes ?? undefined,
    lastSentAt: reminder.lastSentAt ?? undefined,
    completedAt: reminder.completedAt ?? undefined,
    lastDeliveryStatus: reminder.lastDeliveryStatus ?? undefined,
  };
}

function requireReminder(row: ReminderRow | null | undefined, message = "Reminder was not found") {
  if (!row) throw apiFailure(message, 404, "reminder_not_found");
  return { reminder: reminderMessage(row) };
}

export const reminderService: ServiceImpl<typeof ReminderService> = {
  async listReminders(_request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const result = await db.query<ReminderRow>(
      `${reminderSelect}
        WHERE r.user_id = $1
        ORDER BY
          CASE r.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
          r.next_remind_at ASC NULLS LAST,
          r.created_at DESC`,
      [user.sub]
    );
    return { reminders: result.rows.map(reminderMessage) };
  },

  async createReminder(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const parsed = parseReminderInput({
      title: request.title,
      note: request.note,
      remindAt: request.remindAt ?? null,
      scheduleType: request.scheduleType,
      repeatIntervalMinutes: request.repeatIntervalMinutes ?? null,
    });
    if (!parsed.value) throw apiFailure(parsed.error, 400, parsed.code);

    const value = parsed.value;
    const result = await db.query<ReminderRow>(
      `INSERT INTO reminder_event (
         reminder_id, user_id, title, note, remind_at, next_remind_at,
         repeat_interval_minutes, schedule_type, status
       ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7::varchar,
                 CASE WHEN $7::varchar = 'never' THEN 'paused' ELSE 'active' END)
       ${REMINDER_RETURNING}`,
      [randomUUID(), user.sub, value.title, value.note, value.remindAt, value.repeatIntervalMinutes, value.scheduleType]
    );
    if (!result.rows[0]) throw new Error("Reminder insert returned no row");
    return requireReminder(result.rows[0]);
  },

  async updateReminderContent(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const parsed = parseReminderContent({ title: request.title, note: request.note });
    if (!parsed.value) throw apiFailure(parsed.error, 400, parsed.code);
    const result = await db.query<ReminderRow>(
      `UPDATE reminder_event
          SET title = $3, note = $4, updated_at = NOW()
        WHERE reminder_id = $1 AND user_id = $2
        ${REMINDER_RETURNING}`,
      [request.reminderId, user.sub, parsed.value.title, parsed.value.note]
    );
    return requireReminder(firstRow(result.rows));
  },

  async updateReminderSchedule(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const parsed = parseReminderSchedule({
      scheduleType: request.scheduleType,
      remindAt: request.remindAt ?? null,
      repeatIntervalMinutes: request.repeatIntervalMinutes ?? null,
    });
    if (!parsed.value) throw apiFailure(parsed.error, 400, parsed.code);
    const schedule = parsed.value;
    const result = await db.query<ReminderRow>(
      `UPDATE reminder_event
          SET schedule_type = $3::varchar, remind_at = $4, next_remind_at = $4,
              repeat_interval_minutes = $5,
              status = CASE WHEN $3::varchar = 'never' THEN 'paused' ELSE 'active' END,
              completed_at = NULL, updated_at = NOW()
        WHERE reminder_id = $1 AND user_id = $2
        ${REMINDER_RETURNING}`,
      [request.reminderId, user.sub, schedule.scheduleType, schedule.remindAt, schedule.repeatIntervalMinutes]
    );
    return requireReminder(firstRow(result.rows));
  },

  async setReminderStatus(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const nextStatus = request.status as ReminderStatus;
    if (nextStatus !== "active" && nextStatus !== "paused") {
      throw apiFailure("Status must be active or paused", 400, "invalid_status");
    }
    const result = await db.query<ReminderRow>(
      `UPDATE reminder_event
          SET status = $3,
              next_remind_at = CASE
                WHEN $3 = 'active' AND next_remind_at <= NOW() THEN NOW()
                ELSE next_remind_at
              END,
              updated_at = NOW()
        WHERE reminder_id = $1 AND user_id = $2 AND status <> 'completed'
          AND schedule_type <> 'never'
        ${REMINDER_RETURNING}`,
      [request.reminderId, user.sub, nextStatus]
    );
    return requireReminder(firstRow(result.rows), "Active reminder was not found");
  },

  async reactivateReminder(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const remindAt = new Date(request.remindAt);
    if (!Number.isFinite(remindAt.getTime())) {
      throw apiFailure("Reminder time is invalid", 400, "invalid_remind_at");
    }
    if (remindAt.getTime() <= Date.now()) {
      throw apiFailure("Reminder time must be in the future", 400, "remind_at_not_future");
    }
    const result = await db.query<ReminderRow>(
      `UPDATE reminder_event
          SET remind_at = $3, next_remind_at = $3, status = 'active',
              completed_at = NULL, updated_at = NOW()
        WHERE reminder_id = $1 AND user_id = $2
          AND status = 'completed' AND repeat_interval_minutes IS NULL
        ${REMINDER_RETURNING}`,
      [request.reminderId, user.sub, remindAt]
    );
    const reminder = firstRow(result.rows);
    if (!reminder) {
      throw apiFailure("Only completed one-time reminders can be reactivated", 409, "reminder_not_reactivatable");
    }
    return requireReminder(reminder);
  },

  async deleteReminder(request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const result = await db.query<{ reminder_id: string }>(
      `DELETE FROM reminder_event
        WHERE reminder_id = $1 AND user_id = $2
        RETURNING reminder_id`,
      [request.reminderId, user.sub]
    );
    if (!firstRow(result.rows)) throw apiFailure("Reminder was not found", 404, "reminder_not_found");
    return {};
  },

  async listReminderAudits(_request, context) {
    const user = await verifiedReminderUser(headersOf(context));
    const result = await db.query<{
      audit_id: string;
      reminder_id: string | null;
      recipient_email: string;
      subject: string;
      body_text: string;
      content_sha256: string;
      status: string;
      provider_email_id: string | null;
      failure_message: string | null;
      created_at: string | Date;
      sent_at: string | Date | null;
    }>(
      `SELECT audit_id, reminder_id, recipient_email, subject, body_text,
              content_sha256, status, provider_email_id, failure_message,
              created_at, sent_at
         FROM email_audit_log
        WHERE user_id = $1 AND category = 'reminder'
        ORDER BY created_at DESC
        LIMIT 100`,
      [user.sub]
    );
    return {
      audits: result.rows.map((row) => ({
        auditId: row.audit_id,
        reminderId: row.reminder_id ?? undefined,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        bodyText: row.body_text,
        contentSha256: row.content_sha256,
        status: row.status,
        providerEmailId: row.provider_email_id ?? undefined,
        failureMessage: row.failure_message ?? undefined,
        createdAt: new Date(row.created_at).toISOString(),
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : undefined,
      })),
    };
  },
};

// --- LLM settings backup ---------------------------------------------------

interface BackupRow {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updated_at: Date | string;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

async function backupUser(headers: { headers: Headers }) {
  const token = bearerToken(headers);
  try {
    const user = token ? await verifyAccessToken(token) : null;
    if (user?.status === 1) return user;
  } catch {
    // Reported as an authentication failure below.
  }
  throw apiFailure("A verified account is required", 401, "authentication_required");
}

function backupMessage(row: BackupRow) {
  return {
    backup: {
      version: row.version,
      salt: row.salt,
      iv: row.iv,
      ciphertext: row.ciphertext,
      updatedAt: new Date(row.updated_at).toISOString(),
    },
  };
}

export const llmSettingsService: ServiceImpl<typeof LlmSettingsService> = {
  async getBackup(_request, context) {
    const user = await backupUser(headersOf(context));
    const result = await db.query<BackupRow>(
      "SELECT version, salt, iv, ciphertext, updated_at FROM user_llm_settings_backup WHERE user_id = $1",
      [user.sub]
    );
    const backup = firstRow(result.rows);
    if (!backup) throw apiFailure("No cloud backup exists", 404, "backup_not_found");
    return backupMessage(backup);
  },

  async putBackup(request, context) {
    const user = await backupUser(headersOf(context));
    const { version, salt, iv, ciphertext } = request;
    if (
      version !== 1 || salt.length > 64 || !BASE64.test(salt) ||
      iv.length > 64 || !BASE64.test(iv) ||
      ciphertext.length === 0 || ciphertext.length > 262144 || !BASE64.test(ciphertext)
    ) {
      throw apiFailure("Invalid encrypted backup", 400, "invalid_backup");
    }
    const result = await db.query<BackupRow>(
      `INSERT INTO user_llm_settings_backup (user_id, version, salt, iv, ciphertext)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         version = EXCLUDED.version, salt = EXCLUDED.salt, iv = EXCLUDED.iv,
         ciphertext = EXCLUDED.ciphertext, updated_at = NOW()
       RETURNING version, salt, iv, ciphertext, updated_at`,
      [user.sub, version, salt, iv, ciphertext]
    );
    const backup = firstRow(result.rows);
    if (!backup) throw new Error("Backup upsert returned no row");
    return backupMessage(backup);
  },
};
