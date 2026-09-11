import { documentation } from "@lib/publishing/docs";
import { createPageMetadata } from "@lib/seo";
import { DocsIndex } from "./DocsClient";

export const metadata = createPageMetadata({ title: "Documentation", description: "API references and usage guides.", path: "/docs" });
export default function DocsPage() { return <DocsIndex entries={documentation} />; }
