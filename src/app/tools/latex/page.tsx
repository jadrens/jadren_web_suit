import LatexClient from "./LatexClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "LaTeX Math Editor",
  description: "Type math formulas visually like in a math app and copy clean LaTeX. Works on desktop and mobile with a built-in math keyboard.",
  path: "/tools/latex",
  keywords: ["LaTeX editor", "math formula editor", "online equation editor", "LaTeX math", "visual LaTeX"],
});

export default function LatexPage() {
  return <LatexClient />;
}
