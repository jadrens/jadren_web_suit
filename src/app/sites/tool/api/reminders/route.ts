import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, internalError } from "@shared/libs/auth/http";
import {
  db,
  reminderAuthFailure,
  reminderSelect,
  requestReminderUser,
  requireVerifiedReminderUser,
  toReminder,
  type ReminderRow,
} from "@shared/libs/reminder/server";
import { parseReminderInput } from "@shared/libs/reminder/validation";

export async function GET(request: Request) {
  try {
    const user = await requestReminderUser(request);
    const authError = requireVerifiedReminderUser(user);
    if (authError) return authError;

    const result = await db.query<ReminderRow>(
      `${reminderSelect}
        WHERE r.user_id = $1
        ORDER BY
          CASE r.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
          r.next_remind_at ASC NULLS LAST,
          r.created_at DESC`,
      [user!.sub]
    );
    return NextResponse.json({ reminders: result.rows.map(toReminder) });
  } catch (error) {
    return reminderAuthFailure(error) ?? internalError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requestReminderUser(request);
    const authError = requireVerifiedReminderUser(user);
    if (authError) return authError;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Invalid JSON body", 400, "invalid_json");
    }
    const parsed = parseReminderInput(body as Record<string, unknown>);
    if (!parsed.value) return apiError(parsed.error, 400, parsed.code);

    const reminderId = randomUUID();
    const value = parsed.value;
    const result = await db.query<ReminderRow>(
      `INSERT INTO reminder_event (
         reminder_id, user_id, title, note, remind_at, next_remind_at,
         repeat_interval_minutes, schedule_type, status
       ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7::varchar,
                 CASE WHEN $7::varchar = 'never' THEN 'paused' ELSE 'active' END)
       RETURNING reminder_id, title, note, remind_at, next_remind_at,
                 repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                 last_sent_at, completed_at, NULL::varchar AS last_delivery_status`,
      [
        reminderId,
        user!.sub,
        value.title,
        value.note,
        value.remindAt,
        value.repeatIntervalMinutes,
        value.scheduleType,
      ]
    );
    const reminder = result.rows[0];
    if (!reminder) throw new Error("Reminder insert returned no row");
    return NextResponse.json({ reminder: toReminder(reminder) }, { status: 201 });
  } catch (error) {
    return reminderAuthFailure(error) ?? internalError(error);
  }
}
