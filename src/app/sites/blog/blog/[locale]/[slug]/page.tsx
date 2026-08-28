import Navbar from "@blog/components/layout/Navbar";
import { getPostBySlug, getAdjacentPosts, Locale } from "@blog/lib/posts";
import { getSearchIndex } from "@blog/lib/search-index";
import { getPostView, incrementView } from "../../actions";
import PostClient from "./PostClient";
import { Metadata } from "next";
import MarkdownContent from "@blog/components/content/MarkdownContent";
import { Typography } from "@mui/material";

interface Props {
  params: Promise<{ slug: string; locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = getPostBySlug(slug, locale);
  return {
    title: post.title,
    description: `Post: ${post.title}`,
  };
}

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: Props) {
  const { slug, locale } = await params;
  const [post, views, adjacent] = await Promise.all([
    getPostBySlug(slug, locale),
    getPostView(slug),
    getAdjacentPosts(slug, locale),
  ]);
  const allPosts = getSearchIndex(locale).postsByDate;
  const wordCount = post.content.replace(/\s/g, "").length;
  const date = post.date;
  const client_post = {
    date: date,
    word_count: wordCount,
    tags: post.tags,
    slug: post.slug,
    title: post.title
  }

  return (
    <div className="min-h-screen flex flex-col" suppressHydrationWarning>
      <Navbar />
      <PostClient post={client_post} views={views} slug={slug} incrementView={incrementView} locale={locale}
        allPosts={allPosts}
        title={<Typography color="text.primary" className="text-sm">
              {post.title}
            </Typography>}
        md_content={<MarkdownContent content={post.content} />}
        prev={adjacent.prev}
        next={adjacent.next}
      />
    </div>
  );
}