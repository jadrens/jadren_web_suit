import DictionaryClient from "./DictionaryClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "English-Chinese Dictionary",
  description: "Look up English words and phrases with bilingual definitions, pronunciations, word forms, and examples.",
  path: "/tools/dictionary",
  keywords: ["English Chinese dictionary", "English word lookup", "英汉词典", "英语词典"],
});

export default function DictionaryPage() {
  return <DictionaryClient />;
}
