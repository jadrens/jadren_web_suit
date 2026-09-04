import AiCenterClient from "./AiCenterClient";
import { createPageMetadata } from "@shared/libs/seo";

export const metadata = createPageMetadata({ title: "English Learning AI Center", description: "Chat with an AI vocabulary curator and add new sentence-practice words to User Data.", path: "/tools/english-learner/ai-center", keywords: ["English learning AI", "vocabulary assistant", "sentence practice"] });
export default function AiCenterPage() { return <AiCenterClient />; }
