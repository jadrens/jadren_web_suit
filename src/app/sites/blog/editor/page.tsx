import type { Metadata } from "next";
import Navbar from "@blog/components/layout/Navbar";
import EditorClient from "./EditorClient";

export const metadata: Metadata = {
  title: "Markdown Editor - jadren-blog",
  description: "Write and publish Markdown articles",
};

export default function EditorPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <EditorClient />
    </div>
  );
}
