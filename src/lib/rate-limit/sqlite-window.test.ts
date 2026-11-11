import { describe, expect, test } from "bun:test";
import { createSqliteWindowLimiter } from "./sqlite-window";

describe("sqlite window limiter", () => {
  test("applies every rule and frees slots as the window slides", () => {
    const limiter = createSqliteWindowLimiter({
      table: "test_events",
      databasePath: ":memory:",
      rules: [
        { windowMs: 1_000, limit: 2 },
        { windowMs: 10_000, limit: 3 },
      ],
    });
    try {
      expect(limiter.consume("a", 0)).toBe(true);
      expect(limiter.consume("a", 1)).toBe(true);
      expect(limiter.consume("a", 2)).toBe(false); // short window full
      expect(limiter.consume("b", 2)).toBe(true); // keys are independent
      expect(limiter.consume("a", 1_500)).toBe(true); // short window slid
      expect(limiter.consume("a", 2_600)).toBe(false); // long window full
      limiter.reset("a");
      expect(limiter.consume("a", 2_700)).toBe(true);
    } finally {
      limiter.close();
    }
  });

  test("rejects empty keys and unsafe table names", () => {
    const limiter = createSqliteWindowLimiter({ table: "t", databasePath: ":memory:", rules: [{ windowMs: 1, limit: 1 }] });
    expect(limiter.consume(" ")).toBe(false);
    limiter.close();
    expect(() => createSqliteWindowLimiter({ table: "x; DROP", databasePath: ":memory:", rules: [{ windowMs: 1, limit: 1 }] })).toThrow();
  });
});
