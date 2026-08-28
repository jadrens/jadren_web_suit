import Navbar from "@blog/components/layout/Navbar";
import { getPosts, getAllViews } from "../actions";
import BlogContent from "../BlogContent";
import { Locale } from "@blog/lib/posts";
import { getAllTags } from "@blog/lib/search-index";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<any> {
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
  const posts = await getPosts(locale);
  const allViews = await getAllViews();
  const allTags = getAllTags(locale);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <BlogContent posts={posts} allViews={allViews} locale={locale} allTags={allTags} />
    </div>
  );
}