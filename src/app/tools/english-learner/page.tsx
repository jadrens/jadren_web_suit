import EnglishLearnerClient from "./EnglishLearnerClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({ title: "Tools for English Learners", description: "AI-assisted tools for improving English writing.", path: "/tools/english-learner", keywords: ["English learner", "grammar checker", "English writing"] });
export default function EnglishLearnerPage() { return <EnglishLearnerClient />; }
