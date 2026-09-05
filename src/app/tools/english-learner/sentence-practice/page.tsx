import SentencePracticeClient from "./SentencePracticeClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({ title: "Vocabulary Sentence Practice", description: "Practice distinct English word usages with AI-generated sentence exercises.", path: "/tools/english-learner/sentence-practice", keywords: ["English vocabulary", "sentence practice", "AI English practice"] });
export default function SentencePracticePage() { return <SentencePracticeClient />; }
