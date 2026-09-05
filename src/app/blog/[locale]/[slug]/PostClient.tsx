"use client";

import { useState, useEffect } from "react";
import { Box, Breadcrumbs, Chip, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EventIcon from "@mui/icons-material/Event";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import TableOfContents from "@components/content/toc/TableOfContents";
import TableOfContentsDrawer from "@components/content/toc/TableOfContentsDrawer";
import FloatingTOCButton from "@components/content/toc/FloatingTOCButton";
import PostsSidebar from "@components/content/sidebar/PostsSidebar";
import ReadingProgressBar from "@components/content/reading/ReadingProgressBar";
import BackToTopButton from "@components/content/reading/BackToTopButton";
import { ReadingProgressProvider } from "@components/content/reading/ReadingProgressContext";
import { useScrollProgress } from "@hooks/reading/useScrollProgress";
import { useBrowserConfig, BrowserConfigKeys } from "@hooks/reading/useBrowserConfig";
import { useI18n } from "@lib/i18n/content";
import { Locale } from "@lib/publishing/posts";
import { PostMeta } from "@lib/publishing/search-index";
import { SITE_CONFIG } from "@config/publishing/config";

interface PostClientProps {
  post: {
    slug: string;
    date: string;
    word_count: number;
    tags: string[];
    title: string;
  };
  views: number;
  slug: string;
  incrementView: (slug: string) => Promise<void>;
  locale: Locale;
  allPosts: PostMeta[];
  title: React.ReactNode;
  md_content: React.ReactNode;
  prev: PostMeta | null;
  next: PostMeta | null;
}

function getRelativeTime(dateStr: string, t: any): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.abs(now.getTime() - date.getTime());
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  const ta = t?.blog?.timeAgo;
  const s = (n: number, sing: string, pl: string) =>
    n === 1 ? `${n} ${sing}` : `${n} ${pl}`;

  if (years > 0) {
    const y = years;
    const m = months % 12;
    const d = days % 30;
    if (m > 0 && d > 0) return `${s(y, ta.year, ta.years)} ${s(m, ta.month, ta.months)} ${s(d, ta.day, ta.days)}`;
    if (m > 0) return `${s(y, ta.year, ta.years)} ${s(m, ta.month, ta.months)}`;
    return `${s(y, ta.year, ta.years)}`;
  }
  if (months > 0) {
    const m = months;
    const d = days % 30;
    const h = hours % 24;
    if (d > 0 && h > 0) return `${s(m, ta.month, ta.months)} ${s(d, ta.day, ta.days)} ${s(h, ta.hour, ta.hours)}`;
    if (d > 0) return `${s(m, ta.month, ta.months)} ${s(d, ta.day, ta.days)}`;
    return `${s(m, ta.month, ta.months)}`;
  }
  if (days > 0) {
    const d = days;
    const h = hours % 24;
    const min = minutes % 60;
    if (h > 0 && min > 0) return `${s(d, ta.day, ta.days)} ${s(h, ta.hour, ta.hours)} ${s(min, ta.minute, ta.minutes)}`;
    if (h > 0) return `${s(d, ta.day, ta.days)} ${s(h, ta.hour, ta.hours)}`;
    return `${s(d, ta.day, ta.days)}`;
  }
  if (hours > 0) {
    const h = hours;
    const min = minutes % 60;
    if (min > 0) return `${s(h, ta.hour, ta.hours)} ${s(min, ta.minute, ta.minutes)}`;
    return `${s(h, ta.hour, ta.hours)}`;
  }
  if (minutes > 0) {
    return `${s(minutes, ta.minute, ta.minutes)}`;
  }
  return `${s(seconds, ta.second, ta.seconds)}`;
}

function PostContent({ post, views, slug, incrementView, locale, allPosts, title, md_content, prev, next }: PostClientProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useBrowserConfig(BrowserConfigKeys.sidebarOpen, true);
  const [localViews, setLocalViews] = useState(views);
  const [mounted, setMounted] = useState(false);

  

  useScrollProgress();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    incrementView(slug);
    setLocalViews((v) => v + 1);
  }, [slug, incrementView]);

  return (
    <>
      <TableOfContentsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <FloatingTOCButton onClick={() => setDrawerOpen(true)} />
      <ReadingProgressBar />
      <BackToTopButton />

      <Box sx={{ display: { xs: "block", sm: "grid" }, gridTemplateColumns: { sm: sidebarOpen ? "250px 1fr 250px" : "1fr 250px" }, gap: 4, pr: { sm: 3 }, transition: "grid-template-columns 0.3s ease" }}>
        {/* Posts sidebar — open state in left grid column */}
        {sidebarOpen && (
          <PostsSidebar
            open
            onToggle={() => setSidebarOpen(false)}
            posts={allPosts}
            currentSlug={slug}
            locale={locale}
          />
        )}
        <Box component="main" sx={{ width: '100%', pl: { sm: '76px', xs: 3 }, pr: { xs: 3, sm: 0 }, py: 8 }}>
          <Breadcrumbs sx={{ mb: 2, animation: 'fadeIn 0.5s ease-out', animationDelay: '0.1s', animationFillMode: 'both' }}>
            <Link
              href={`/blog/${locale}`}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 no-underline transition-colors duration-200"
            >
                            {t.blog.backToPosts}
            </Link>
            {title}
            
          </Breadcrumbs>
          <article>
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h3"
                component="h1"
                gutterBottom
                sx={{
                  fontWeight: "bold",
                  color: "primary.main",
                  animation: mounted ? 'slideUp 0.6s ease-out' : 'none',
                  animationDelay: '0.2s',
                  animationFillMode: 'both',
                }}
              >
                {post.title}
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "center",
                    mb: 1,
                    flexWrap: "wrap",
                    animation: mounted ? 'fadeIn 0.5s ease-out' : 'none',
                    animationDelay: '0.4s',
                    animationFillMode: 'both',
                  }}
                >
                  <Tooltip title={getRelativeTime(post.date, t) + ` ${t.blog.timeAgo.ago}`} arrow>
                    <Chip
                      icon={<EventIcon />}
                      label={post.date.split('T')[0]}
                      size="small"
                      variant="outlined"
                      sx={{
                        transition: 'all 0.2s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                      }}
                    />
                  </Tooltip>
                  <Chip
                    icon={<VisibilityIcon />}
                    label={`${localViews} ${t.blog.views}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                    }}
                  />
                  <Chip
                    icon={<TextFieldsIcon />}
                    label={`${post.word_count} ${t.blog.characters}`}
                    size="small"
                    variant="outlined"
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    animation: mounted ? 'fadeIn 0.5s ease-out' : 'none',
                    animationDelay: '0.5s',
                    animationFillMode: 'both',
                  }}
                >
                  {post.tags.map((tag) => (
                    <Chip
                      key={tag}
                      icon={<LocalOfferIcon />}
                      label={tag}
                      size="small"
                      variant="outlined"
                      sx={{
                        borderColor: 'secondary.main',
                        color: theme.palette.secondary.main,
                        transition: 'all 0.2s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 2, bgcolor: 'secondary.main', color: theme.palette.secondary.contrastText }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
            <Box
              sx={{
                animation: mounted ? 'fadeIn 0.6s ease-out' : 'none',
                animationDelay: '0.5s',
                animationFillMode: 'both',
              }}
            >
              {md_content}
            </Box>
            {(prev || next) && (
              <Box
                sx={{
                  mt: 6,
                  mb: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexWrap: 'wrap',
                  animation: mounted ? 'fadeIn 0.5s ease-out' : 'none',
                  animationDelay: '0.6s',
                  animationFillMode: 'both',
                }}
              >
                <Box sx={{ display: 'flex', flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
                  {prev && (
                    <Tooltip title={`${t.blog.prevPost}: ${prev.title}`} arrow>
                      <Chip
                        component={Link}
                        href={`/blog/${locale}/${prev.slug}`}
                        icon={<ArrowBackIcon />}
                        label={prev.title}
                        aria-label={`${t.blog.prevPost}: ${prev.title}`}
                        size="small"
                        clickable
                        sx={{ maxWidth: { xs: '100%', sm: 280 } }}
                      />
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                  {next && (
                    <Tooltip title={`${t.blog.nextPost}: ${next.title}`} arrow>
                      <Chip
                        component={Link}
                        href={`/blog/${locale}/${next.slug}`}
                        icon={<ArrowForwardIcon />}
                        label={next.title}
                        aria-label={`${t.blog.nextPost}: ${next.title}`}
                        size="small"
                        clickable
                        sx={{ maxWidth: { xs: '100%', sm: 280 } }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </Box>
            )}
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              {SITE_CONFIG.articleEditEnabled && (
                <Chip
                  component={Link}
                  href={`/editor?locale=${locale}&slug=${encodeURIComponent(post.slug)}`}
                  icon={<EditIcon />}
                  label={t.blog.editPage}
                  variant="outlined"
                  size="small"
                  clickable
                  sx={{ '& .MuiChip-icon': { ml: 1 }, '& .MuiChip-label': { pr: 1.5 } }}
                  deleteIcon={<ArrowForwardIcon />}
                  onDelete={() => {}}
                />
              )}
            </Box>
          </article>
        </Box>
        <TableOfContents />
      </Box>

      {/* Posts sidebar toggle — closed state, outside grid */}
      {!sidebarOpen && (
        <PostsSidebar
          open={false}
          onToggle={() => setSidebarOpen(true)}
          posts={allPosts}
          currentSlug={slug}
          locale={locale}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default function PostClient({ post, views, slug, incrementView, locale, allPosts, title, md_content, prev, next }: PostClientProps) {
  return (
    <ReadingProgressProvider>
      <PostContent post={post} views={views} slug={slug} incrementView={incrementView} locale={locale} allPosts={allPosts} title={title} md_content={md_content} prev={prev} next={next} />
    </ReadingProgressProvider>
  );
}
