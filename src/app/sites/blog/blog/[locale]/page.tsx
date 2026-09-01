import Navbar from "@blog/components/layout/Navbar";
import { getPosts, getAllViews } from "../actions";
import BlogContent from "../BlogContent";
import { Locale } from "@shared/libs/blog/posts";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const localeName = locale === "zh" ? "中文" : "English";
  return {
    title: `${localeName} Posts - jadren-blog`,
    description: `All blog posts in ${localeName}`,
  };
}

export const dynamic = "force-dynamic";

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  const [posts, allViews] = await Promise.all([getPosts(locale), getAllViews()]);
  const allTags = [...new Set(posts.flatMap((post) => post.tags))].sort();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <BlogContent posts={posts} allViews={allViews} locale={locale} allTags={allTags} />
    </div>
  );
}
