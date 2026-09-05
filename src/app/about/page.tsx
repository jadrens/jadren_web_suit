import fs from "fs";
import path from "path";
import AboutClient from "./AboutClient";

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
