import { describe, expect, test } from "bun:test";
import {
  nextOccurrenceAfter,
  parseReminderContent,
  parseReminderInput,
  parseReminderSchedule,
  utcHourWindow,
} from "./validation";

describe("reminder validation", () => {
  test("rejects repeat intervals below 30 minutes", () => {
    const result = parseReminderInput({
      title: "Stand up",
      note: "Move around",
      remindAt: new Date(Date.now() + 60_000).toISOString(),
      repeats: true,
      repeatIntervalMinutes: 29,
    });
    expect(result.code).toBe("invalid_repeat_interval");
  });

  test("accepts a 30-minute interval", () => {
    const result = parseReminderInput({
      title: "Stand up",
      note: "Move around",
      remindAt: new Date(Date.now() + 60_000).toISOString(),
      repeats: true,
      repeatIntervalMinutes: 30,
    });
    expect(result.value?.repeatIntervalMinutes).toBe(30);
  });

  test("accepts never without a reminder time", () => {
    const result = parseReminderInput({
      title: "Reference note",
      note: "Keep this without emailing it",
      scheduleType: "never",
    });
    expect(result.value).toEqual({
      title: "Reference note",
      note: "Keep this without emailing it",
      scheduleType: "never",
      remindAt: null,
      repeatIntervalMinutes: null,
    });
  });

  test("requires a future time when changing to one-time", () => {
    const result = parseReminderSchedule({ scheduleType: "one_time", remindAt: null });
    expect(result.code).toBe("invalid_remind_at");
  });

  test("validates and trims edited content", () => {
    expect(parseReminderContent({ title: " Updated ", note: " Note " }).value).toEqual({
      title: "Updated",
      note: "Note",
    });
    expect(parseReminderContent({ title: "", note: "Note" }).code).toBe("invalid_title");
  });
});

describe("reminder scheduling", () => {
  test("skips missed repeats and returns the first future occurrence", () => {
    expect(
      nextOccurrenceAfter(
        new Date("2026-08-29T10:00:00.000Z"),
        30,
        new Date("2026-08-29T11:04:00.000Z")
      ).toISOString()
    ).toBe("2026-08-29T11:30:00.000Z");
  });

  test("uses UTC clock-hour boundaries", () => {
    const window = utcHourWindow(new Date("2026-08-29T11:42:12.000Z"));
    expect(window.start.toISOString()).toBe("2026-08-29T11:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-08-29T12:00:00.000Z");
  });
});
