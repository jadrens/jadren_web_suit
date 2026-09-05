import { NextResponse } from "next/server";
import { firstRow } from "@lib/auth/db";
import { apiError, internalError } from "@lib/auth/http";
import {
  db,
  reminderAuthFailure,
  requestReminderUser,
  requireVerifiedReminderUser,
  toReminder,
  type ReminderRow,
  type ReminderStatus,
} from "@lib/reminder/server";
import {
  parseReminderContent,
  parseReminderSchedule,
} from "@lib/reminder/validation";

interface RouteContext {
  params: Promise<{ reminderId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requestReminderUser(request);
    const authError = requireVerifiedReminderUser(user);
    if (authError) return authError;
    const { reminderId } = await context.params;
    const body = await request.json().catch(() => null);

    if (body?.title !== undefined || body?.note !== undefined) {
      const parsed = parseReminderContent(body as Record<string, unknown>);
      if (!parsed.value) return apiError(parsed.error, 400, parsed.code);
      const result = await db.query<ReminderRow>(
        `UPDATE reminder_event
            SET title = $3, note = $4, updated_at = NOW()
          WHERE reminder_id = $1 AND user_id = $2
          RETURNING reminder_id, title, note, remind_at, next_remind_at,
                    repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                    last_sent_at, completed_at, NULL::varchar AS last_delivery_status`,
        [reminderId, user!.sub, parsed.value.title, parsed.value.note]
      );
      const reminder = firstRow(result.rows);
      if (!reminder) {
        return apiError("Reminder was not found", 404, "reminder_not_found");
      }
      return NextResponse.json({ reminder: toReminder(reminder) });
    }

    if (body?.scheduleType !== undefined) {
      const parsed = parseReminderSchedule(body as Record<string, unknown>);
      if (!parsed.value) return apiError(parsed.error, 400, parsed.code);
      const schedule = parsed.value;
      const result = await db.query<ReminderRow>(
        `UPDATE reminder_event
            SET schedule_type = $3::varchar, remind_at = $4, next_remind_at = $4,
                repeat_interval_minutes = $5,
                status = CASE WHEN $3::varchar = 'never' THEN 'paused' ELSE 'active' END,
                completed_at = NULL, updated_at = NOW()
          WHERE reminder_id = $1 AND user_id = $2
          RETURNING reminder_id, title, note, remind_at, next_remind_at,
                    repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                    last_sent_at, completed_at, NULL::varchar AS last_delivery_status`,
        [
          reminderId,
          user!.sub,
          schedule.scheduleType,
          schedule.remindAt,
          schedule.repeatIntervalMinutes,
        ]
      );
      const reminder = firstRow(result.rows);
      if (!reminder) {
        return apiError("Reminder was not found", 404, "reminder_not_found");
      }
      return NextResponse.json({ reminder: toReminder(reminder) });
    }

    if (typeof body?.remindAt === "string") {
      const remindAt = new Date(body.remindAt);
      if (!Number.isFinite(remindAt.getTime())) {
        return apiError("Reminder time is invalid", 400, "invalid_remind_at");
      }
      if (remindAt.getTime() <= Date.now()) {
        return apiError(
          "Reminder time must be in the future",
          400,
          "remind_at_not_future"
        );
      }

      const result = await db.query<ReminderRow>(
        `UPDATE reminder_event
            SET remind_at = $3, next_remind_at = $3, status = 'active',
                completed_at = NULL, updated_at = NOW()
          WHERE reminder_id = $1 AND user_id = $2
            AND status = 'completed' AND repeat_interval_minutes IS NULL
          RETURNING reminder_id, title, note, remind_at, next_remind_at,
                    repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                    last_sent_at, completed_at, NULL::varchar AS last_delivery_status`,
        [reminderId, user!.sub, remindAt]
      );
      const reminder = firstRow(result.rows);
      if (!reminder) {
        return apiError(
          "Only completed one-time reminders can be reactivated",
          409,
          "reminder_not_reactivatable"
        );
      }
      return NextResponse.json({ reminder: toReminder(reminder) });
    }

    const nextStatus = body?.status as ReminderStatus | undefined;
    if (nextStatus !== "active" && nextStatus !== "paused") {
      return apiError("Status must be active or paused", 400, "invalid_status");
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
        RETURNING reminder_id, title, note, remind_at, next_remind_at,
                  repeat_interval_minutes, schedule_type, status, created_at, updated_at,
                  last_sent_at, completed_at, NULL::varchar AS last_delivery_status`,
      [reminderId, user!.sub, nextStatus]
    );
    const reminder = firstRow(result.rows);
    if (!reminder) {
      return apiError("Active reminder was not found", 404, "reminder_not_found");
    }
    return NextResponse.json({ reminder: toReminder(reminder) });
  } catch (error) {
    return reminderAuthFailure(error) ?? internalError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requestReminderUser(request);
    const authError = requireVerifiedReminderUser(user);
    if (authError) return authError;
    const { reminderId } = await context.params;
    const result = await db.query<{ reminder_id: string }>(
      `DELETE FROM reminder_event
        WHERE reminder_id = $1 AND user_id = $2
        RETURNING reminder_id`,
      [reminderId, user!.sub]
    );
    if (!firstRow(result.rows)) {
      return apiError("Reminder was not found", 404, "reminder_not_found");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return reminderAuthFailure(error) ?? internalError(error);
  }
}
