import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = { title: "About" };

function getAboutContent(): Record<"en" | "zh", string> {
  const root = process.cwd();
  const en = fs.readFileSync(path.join(root, "content/about/en.md"), "utf-8");
  const zh = fs.readFileSync(path.join(root, "content/about/zh.md"), "utf-8");
  return { en, zh };
}

export default function AboutPage() {
  const content = getAboutContent();
  return <AboutClient content={content} />;
}
