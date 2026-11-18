import PdfImpositionClient from "./PdfImpositionClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "PDF Imposition / Booklet Printer",
  description: "Arrange PDF pages two-up for duplex printing — saddle-stitch booklets, single-sheet folds, and sequential 2-up. Free, in your browser, no upload required.",
  path: "/tools/pdf-imposition",
  keywords: ["PDF imposition", "booklet printing", "2-up PDF", "saddle stitch", "duplex printing", "PDF 拼版"],
});

export default function PdfImpositionPage() {
  return <PdfImpositionClient />;
}
