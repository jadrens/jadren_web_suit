import { readFile } from "node:fs/promises";
import path from "node:path";

export const documentation = [{
  slug: "dictionary",
  toolHref: "/tools/dictionary",
  toolLabel: { zh: "打开词典", en: "Open dictionary" },
  title: { zh: "词典 API", en: "Dictionary API" },
  description: { zh: "查询英语单词与短语，获取完整词条和前缀建议。", en: "Look up English words and phrases, retrieve complete entries, and request prefix suggestions." },
}, {
  slug: "ip",
  title: { zh: "IP API", en: "IP API" },
  description: { zh: "获取当前请求的客户端 IP 地址与代理转发头。", en: "Retrieve the client IP address and proxy forwarding headers for the current request." },
  toolHref: "/tools/ip",
  toolLabel: { zh: "打开 IP 查询", en: "Open IP lookup" },
}];

export async function getDocumentation(slug: string) {
  const entry = documentation.find(item => item.slug === slug);
  if (!entry) return null;
  const [zh, en] = await Promise.all(["zh", "en"].map(locale => readFile(path.join(process.cwd(), "docs", "public", `${entry.slug}.${locale}.md`), "utf8")));
  return { ...entry, content: { zh, en } };
}
