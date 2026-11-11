import { describe, expect, test } from "bun:test";
import { readRefreshCookie } from "./sessions";

describe("refresh cookie parsing", () => {
  test("reads an encoded cookie among unrelated cookies", () => {
    expect(readRefreshCookie(new Headers({ cookie: "other=1; jadren_refresh=abc%3Ddef" }))).toBe("abc=def");
  });

  test("treats malformed encoding and empty values as absent", () => {
    for (const cookie of ["jadren_refresh=%", "jadren_refresh=%E0%A4%A", "jadren_refresh="]) {
      expect(readRefreshCookie(new Headers({ cookie }))).toBeNull();
    }
  });
});
