/**
 * Copies the Vditor runtime assets the editor loads into public/vditor, so the
 * editor never fetches code from unpkg. Run it after upgrading vditor and
 * commit the result:
 *
 *   bun scripts/sync-vditor.ts
 *
 * Diagram renderers (mermaid, echarts, graphviz, ...) are left out to keep the
 * repository small; fenced blocks in those languages then stay plain code.
 * Add their directories to ASSETS to enable one.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ASSETS = [
  "css/content-theme",
  "images",
  "js/lute",
  "js/icons/ant.js",
  "js/i18n/en_US.js",
  "js/i18n/zh_CN.js",
  "js/highlight.js",
  "js/katex",
];

const root = resolve(import.meta.dir, "..");
const source = join(root, "node_modules/vditor");
const target = join(root, "public/vditor");
const { version } = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as { version: string };

rmSync(target, { recursive: true, force: true });
for (const asset of ASSETS) {
  const from = join(source, "dist", asset);
  if (!existsSync(from)) throw new Error(`vditor ${version} has no dist/${asset}`);
  cpSync(from, join(target, "dist", asset), { recursive: true });
}
cpSync(join(source, "LICENSE"), join(target, "LICENSE"));
writeFileSync(join(target, "VERSION"), `${version}\n`);
console.log(`Copied vditor ${version} assets to public/vditor`);
