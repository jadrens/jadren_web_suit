export const MIN_REPEAT_INTERVAL_MINUTES = 30;
export const MAX_REPEAT_INTERVAL_MINUTES = 525_600;
export const MAX_REMINDER_TITLE_LENGTH = 160;
export const MAX_REMINDER_NOTE_LENGTH = 5_000;
export const REMINDER_EMAILS_PER_UTC_HOUR = 25;

export type ReminderScheduleType = "one_time" | "repeat" | "never";

export interface ReminderScheduleInput {
  scheduleType: ReminderScheduleType;
  remindAt: Date | null;
  repeatIntervalMinutes: number | null;
}

export interface ReminderContentInput {
  title: string;
  note: string;
}

export interface ReminderInput {
  title: string;
  note: string;
  scheduleType: ReminderScheduleType;
  remindAt: Date | null;
  repeatIntervalMinutes: number | null;
}

export type ReminderInputResult =
  | { value: ReminderInput; error?: never; code?: never }
  | { value?: never; error: string; code: string };

export function parseReminderContent(body: Record<string, unknown>):
  | { value: ReminderContentInput; error?: never; code?: never }
  | { value?: never; error: string; code: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > MAX_REMINDER_TITLE_LENGTH) {
    return { error: `Title must contain 1-${MAX_REMINDER_TITLE_LENGTH} characters`, code: "invalid_title" };
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note || note.length > MAX_REMINDER_NOTE_LENGTH) {
    return { error: `Note must contain 1-${MAX_REMINDER_NOTE_LENGTH} characters`, code: "invalid_note" };
  }

  return { value: { title, note } };
}

export function parseReminderSchedule(body: Record<string, unknown>):
  | { value: ReminderScheduleInput; error?: never; code?: never }
  | { value?: never; error: string; code: string } {
  // Keep accepting the original create payload while clients roll forward.
  const scheduleType = body.scheduleType === undefined
    ? (body.repeats === true ? "repeat" : "one_time")
    : body.scheduleType;
  if (scheduleType !== "one_time" && scheduleType !== "repeat" && scheduleType !== "never") {
    return { error: "Schedule type is invalid", code: "invalid_schedule_type" };
  }
  if (scheduleType === "never") {
    return { value: { scheduleType, remindAt: null, repeatIntervalMinutes: null } };
  }

  const remindAt = typeof body.remindAt === "string" ? new Date(body.remindAt) : null;
  if (!remindAt || !Number.isFinite(remindAt.getTime())) {
    return { error: "Reminder time is invalid", code: "invalid_remind_at" };
  }
  if (remindAt.getTime() <= Date.now()) {
    return { error: "Reminder time must be in the future", code: "remind_at_not_future" };
  }

  let repeatIntervalMinutes: number | null = null;
  if (scheduleType === "repeat") {
    const interval = body.repeatIntervalMinutes;
    if (
      typeof interval !== "number" ||
      !Number.isInteger(interval) ||
      interval < MIN_REPEAT_INTERVAL_MINUTES ||
      interval > MAX_REPEAT_INTERVAL_MINUTES
    ) {
      return {
        error: `Repeat interval must be an integer between ${MIN_REPEAT_INTERVAL_MINUTES} and ${MAX_REPEAT_INTERVAL_MINUTES} minutes`,
        code: "invalid_repeat_interval",
      };
    }
    repeatIntervalMinutes = interval;
  }

  return { value: { scheduleType, remindAt, repeatIntervalMinutes } };
}

export function parseReminderInput(body: Record<string, unknown>): ReminderInputResult {
  const content = parseReminderContent(body);
  if (!content.value) return content;

  const schedule = parseReminderSchedule(body);
  if (!schedule.value) return schedule;

  return { value: { ...content.value, ...schedule.value } };
}

export function nextOccurrenceAfter(scheduledFor: Date, intervalMinutes: number, now: Date) {
  const intervalMs = intervalMinutes * 60_000;
  const elapsed = Math.max(0, now.getTime() - scheduledFor.getTime());
  return new Date(
    scheduledFor.getTime() + (Math.floor(elapsed / intervalMs) + 1) * intervalMs
  );
}

export function utcHourWindow(now: Date) {
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  return { start, end: new Date(start.getTime() + 60 * 60_000) };
}
