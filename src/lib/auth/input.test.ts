import { describe, expect, test } from "bun:test";
import { defaultNicknameCandidates, normalizeNickname } from "./input";

describe("nickname validation", () => {
  test("rejects @ so nicknames never look like an email", () => {
    expect(normalizeNickname("someone@example.com")).toBeNull();
    expect(normalizeNickname("jadren")).toBe("jadren");
  });
});

describe("default nickname", () => {
  test("starts with the email local part, then numbered variants", () => {
    const candidates = defaultNicknameCandidates("jadren@example.com");
    expect(candidates.slice(0, 3)).toEqual(["jadren", "jadren2", "jadren3"]);
    expect(candidates).toHaveLength(20);
    expect(candidates.at(-1)).toMatch(/^jadren\d{6}$/);
  });

  test("every candidate is a valid nickname", () => {
    for (const email of ["a@example.com", `${"x".repeat(64)}@example.com`, "first.last+tag@example.com"]) {
      for (const candidate of defaultNicknameCandidates(email)) {
        expect(normalizeNickname(candidate)).toBe(candidate);
      }
    }
  });

  test("pads a one-character local part and trims a long one to 50", () => {
    expect(defaultNicknameCandidates("a@example.com")[0]).toBe("a2");
    const long = defaultNicknameCandidates(`${"x".repeat(64)}@example.com`);
    expect(long[0]).toHaveLength(50);
    expect(long[1]).toBe(`${"x".repeat(49)}2`);
  });
});
