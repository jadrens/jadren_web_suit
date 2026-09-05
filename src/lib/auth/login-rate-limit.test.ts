import { describe, expect, test } from "bun:test";
import { createLoginRateLimiter } from "./login-rate-limit";

describe("login rate limiter", () => {
  test("limits one identifier and IP pair to eight attempts", () => {
    const limiter = createLoginRateLimiter(":memory:");
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        expect(limiter.consume("user@example.com", "192.0.2.1", 1_000)).toBe(true);
      }
      expect(limiter.consume("user@example.com", "192.0.2.1", 1_000)).toBe(false);
    } finally {
      limiter.close();
    }
  });

  test("limits an IP across different identifiers", () => {
    const limiter = createLoginRateLimiter(":memory:");
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        expect(limiter.consume(`user-${attempt}`, "192.0.2.2", 2_000)).toBe(true);
      }
      expect(limiter.consume("another-user", "192.0.2.2", 2_000)).toBe(false);
    } finally {
      limiter.close();
    }
  });

  test("successful login reset clears the identifier and IP pair", () => {
    const limiter = createLoginRateLimiter(":memory:");
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        limiter.consume("jadren", "192.0.2.3", 3_000);
      }
      expect(limiter.consume("jadren", "192.0.2.3", 3_000)).toBe(false);
      limiter.reset("jadren", "192.0.2.3");
      expect(limiter.consume("jadren", "192.0.2.3", 3_000)).toBe(true);
    } finally {
      limiter.close();
    }
  });
});
