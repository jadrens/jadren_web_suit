import EnglishLearnerClient from "./EnglishLearnerClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({ title: "Tools for English Learners", description: "English dictionary, vocabulary practice, and writing tools.", path: "/tools/english-learner", keywords: ["English learner", "English dictionary", "grammar checker", "English writing"] });
export default function EnglishLearnerPage() { return <EnglishLearnerClient />; }
