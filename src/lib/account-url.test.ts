import { describe, expect, test } from "bun:test";
import { isSafeAccountReturn } from "./account-url";

describe("account return URLs", () => {
  test("accepts local paths and the existing approved HTTP origins", () => {
    for (const value of ["/", "/blog/zh?tag=next#posts", "/tools?q=a%20b", "https://jadren.me/tools", "https://jadren.cn", "http://jadren.debug:3000/", "http://localhost:3000/"]) {
      expect(isSafeAccountReturn(value)).toBe(true);
    }
  });

  test("rejects browser URL normalization tricks and unapproved origins", () => {
    for (const value of [undefined, "", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "/\r/evil.example", " /blog/zh", "https://jadren.me\n.evil.example", "https://jadren.me.evil.example", "https://jadren.me@evil.example", "javascript:alert(1)", "blog/zh"]) {
      expect(isSafeAccountReturn(value)).toBe(false);
    }
  });
});
