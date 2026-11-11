import type { Metadata } from "next";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "Markdown Editor",
  description: "Write and publish Markdown articles",
};

export default function EditorPage() {
  return (
    <div className="min-h-screen flex flex-col">
      
      <EditorClient />
    </div>
  );
}
