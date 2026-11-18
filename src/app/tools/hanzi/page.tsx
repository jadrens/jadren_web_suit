import HanziClient from "./HanziClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "Hanzi Lookup by Radical, Stroke and IDS",
  description:
    "Look up Chinese characters by Kangxi radical, residual or total strokes, pinyin, Unicode code point or IDS decomposition. Includes Unicode's U-source records for glyphs that have no code point yet.",
  path: "/tools/hanzi",
  keywords: [
    "hanzi lookup",
    "Chinese character lookup",
    "radical stroke search",
    "部首检字",
    "笔画查字",
    "IDS decomposition",
    "unencoded characters",
    "U-source ideographs",
    "Unihan",
  ],
});

export default function HanziPage() {
  return <HanziClient />;
}
