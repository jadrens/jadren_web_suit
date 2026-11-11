import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");

describe("self-hosted vditor assets", () => {
  test("match the installed vditor version", () => {
    const installed = JSON.parse(readFileSync(join(root, "node_modules/vditor/package.json"), "utf8")).version;
    const copied = readFileSync(join(root, "public/vditor/VERSION"), "utf8").trim();
    // Rerun `bun scripts/sync-vditor.ts` after upgrading vditor.
    expect(copied).toBe(installed);
  });

  test("include the runtime the editor always loads", () => {
    for (const file of ["js/lute/lute.min.js", "js/icons/ant.js", "js/i18n/en_US.js", "js/i18n/zh_CN.js"]) {
      expect(existsSync(join(root, "public/vditor/dist", file))).toBe(true);
    }
  });
});
