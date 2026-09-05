import GrammarCheckerClient from "./GrammarCheckerClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({ title: "English Grammar Checker", description: "Check English grammar, spelling, collocations, punctuation, and naturalness with your locally configured LLM.", path: "/tools/english-learner/grammar-checker", keywords: ["English grammar checker", "grammar correction", "English learner"] });
export default function GrammarCheckerPage() { return <GrammarCheckerClient />; }
