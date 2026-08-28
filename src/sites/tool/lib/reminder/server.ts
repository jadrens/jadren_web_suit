import { db } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import { bearerToken, verifyAccessToken } from "@tool/lib/auth/jwt";

export type ReminderStatus = "active" | "paused" | "completed";

export interface ReminderRow {
  reminder_id: string;
  title: string;
  note: string;
  remind_at: string | Date;
  next_remind_at: string | Date;
  repeat_interval_minutes: number | null;
  status: ReminderStatus;
  created_at: string | Date;
  updated_at: string | Date;
  last_sent_at: string | Date | null;
  completed_at: string | Date | null;
  last_delivery_status?: "sent" | "rate_limited" | null;
}

export class InvalidAccessTokenError extends Error {}

export async function requestReminderUser(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT_SECRET")) throw error;
    throw new InvalidAccessTokenError();
  }
}

export function reminderAuthFailure(error: unknown) {
  if (error instanceof Error && error.message.includes("JWT_SECRET")) {
    return internalError(error);
  }
  if (error instanceof InvalidAccessTokenError) {
    return apiError("Token is invalid or expired", 401, "invalid_token");
  }
  return null;
}

export function requireVerifiedReminderUser(
  user: Awaited<ReturnType<typeof requestReminderUser>>
) {
  if (!user) return apiError("Bearer token is required", 401, "token_required");
  if (user.status === 2) {
    return apiError("Account is unavailable", 403, "account_unavailable");
  }
  if (user.status !== 1) {
    return apiError("Verify your email before creating reminders", 403, "email_unverified");
  }
  return null;
}

export function toReminder(row: ReminderRow) {
  return {
    reminderId: row.reminder_id,
    title: row.title,
    note: row.note,
    remindAt: new Date(row.remind_at).toISOString(),
    nextRemindAt: new Date(row.next_remind_at).toISOString(),
    repeatIntervalMinutes: row.repeat_interval_minutes,
    repeats: row.repeat_interval_minutes !== null,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    lastDeliveryStatus: row.last_delivery_status ?? null,
  };
}

export const reminderSelect = `
  SELECT r.reminder_id, r.title, r.note, r.remind_at, r.next_remind_at,
         r.repeat_interval_minutes, r.status, r.created_at, r.updated_at,
         r.last_sent_at, r.completed_at,
         (SELECT d.status
            FROM reminder_delivery d
           WHERE d.reminder_id = r.reminder_id
           ORDER BY d.processed_at DESC
           LIMIT 1) AS last_delivery_status
    FROM reminder_event r`;

export { db };
