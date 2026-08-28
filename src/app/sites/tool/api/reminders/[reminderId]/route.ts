import { NextResponse } from "next/server";
import { firstRow } from "@tool/lib/auth/db";
import { apiError, internalError } from "@tool/lib/auth/http";
import {
  db,
  reminderAuthFailure,
  requestReminderUser,
  requireVerifiedReminderUser,
  toReminder,
  type ReminderRow,
  type ReminderStatus,
} from "@tool/lib/reminder/server";

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
        RETURNING reminder_id, title, note, remind_at, next_remind_at,
                  repeat_interval_minutes, status, created_at, updated_at,
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
