import { notFound } from "next/navigation";
import { documentation, getDocumentation } from "@lib/publishing/docs";
import { createPageMetadata } from "@lib/seo";
import DocsClient from "../DocsClient";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return documentation.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const doc = documentation.find(item => item.slug === slug);
  return doc ? createPageMetadata({ title: doc.title.en, description: doc.description.en, path: `/docs/${slug}` }) : {};
}
export default async function DocumentationPage({ params }: Props) {
  const doc = await getDocumentation((await params).slug);
  if (!doc) notFound();
  return <DocsClient doc={doc} />;
}
