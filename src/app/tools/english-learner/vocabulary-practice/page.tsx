import NceeVocabularyClient from "../ncee-vocabulary/NceeVocabularyClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({ title: "Vocabulary Practice", description: "Practice words from selectable English vocabulary databases.", path: "/tools/english-learner/vocabulary-practice", keywords: ["English vocabulary", "spelling practice", "高考词汇"] });
export default function VocabularyPracticePage() { return <NceeVocabularyClient />; }
