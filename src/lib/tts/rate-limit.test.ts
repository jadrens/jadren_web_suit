import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTtsRateLimiter } from "./rate-limit";

describe("TTS rate limiter", () => {
  test("limits short bursts per IP and allows another IP", () => {
    const limiter = createTtsRateLimiter(":memory:");
    try {
      for (let i = 0; i < 15; i++) expect(limiter.consume("192.0.2.1", 1_000)).toBe(true);
      expect(limiter.consume("192.0.2.1", 1_000)).toBe(false);
      expect(limiter.consume("192.0.2.2", 1_000)).toBe(true);
      expect(limiter.consume("192.0.2.1", 61_001)).toBe(true);
    } finally { limiter.close(); }
  });

  test("limits hourly requests", () => {
    const limiter = createTtsRateLimiter(":memory:");
    try {
      for (let minute = 0; minute < 8; minute++) {
        for (let i = 0; i < 15; i++) expect(limiter.consume("192.0.2.1", minute * 60_001)).toBe(true);
      }
      expect(limiter.consume("192.0.2.1", 8 * 60_001)).toBe(false);
      expect(limiter.consume("192.0.2.1", 3_600_001)).toBe(true);
    } finally { limiter.close(); }
  });

  test("keeps the IP limit after reopening the SQLite file", () => {
    const directory = mkdtempSync(join(tmpdir(), "tts-rate-test-"));
    try {
      const path = join(directory, "requests.sqlite");
      const first = createTtsRateLimiter(path);
      try {
        for (let i = 0; i < 15; i++) expect(first.consume("192.0.2.1", 1_000)).toBe(true);
      } finally { first.close(); }
      const second = createTtsRateLimiter(path);
      try { expect(second.consume("192.0.2.1", 1_000)).toBe(false); }
      finally { second.close(); }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
