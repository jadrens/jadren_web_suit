import { getPostBySlug, getAdjacentPosts, getAllPostMetas, Locale } from "@lib/publishing/posts";
import { getPostView, incrementView } from "../../actions";
import PostClient from "./PostClient";
import { Metadata } from "next";
import MarkdownContent from "@components/content/MarkdownContent";
import { Typography } from "@mui/material";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string; locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const post = await getPostBySlug(slug, locale);
  if (!post) return {};
  return {
    title: post.title,
    description: `Post: ${post.title}`,
  };
}

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: Props) {
  const { slug, locale } = await params;
  const [post, views, allPosts] = await Promise.all([
    getPostBySlug(slug, locale),
    getPostView(slug),
    getAllPostMetas(locale),
  ]);
  if (!post) notFound();
  const adjacent = getAdjacentPosts(slug, allPosts);
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
