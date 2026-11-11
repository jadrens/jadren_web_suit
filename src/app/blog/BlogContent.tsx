"use client";

import { useState, useMemo, useDeferredValue, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  alpha,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip,
  Popover,
  Collapse,
  Pagination,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import TocIcon from "@mui/icons-material/Toc";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useI18n } from "@lib/i18n/content";
import { useTheme } from "@mui/material/styles";
import { Locale } from "@lib/publishing/posts";


interface Post {
  slug: string;
  title: string;
  date: string;
  content: string;
  tags: string[];
}

interface BlogContentProps {
  posts: Post[];
  allViews: Record<string, number>;
  locale: Locale;
  allTags: string[];
}

function highlightText(text: string, keyword: string): React.ReactNode {
  const query = keyword.trim();
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Box component="mark" key={i} sx={{ bgcolor: "warning.main", color: "warning.contrastText", px: 0.25, borderRadius: 0.5 }}>
        {part}
      </Box>
    ) : (
      part
    )
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20, scale: 0.95 },
};

const POSTS_PER_PAGE = 12;

const PostOutlinePreview = dynamic(() => import("@components/content/toc/PostOutlinePreview"));

export default function BlogContent({ posts, allViews, locale, allTags }: BlogContentProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterAnchor, setTagFilterAnchor] = useState<HTMLElement | null>(null);
  const [expandedTocSlug, setExpandedTocSlug] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const deferredKeyword = useDeferredValue(searchKeyword);
  const normalizedKeyword = deferredKeyword.trim().toLowerCase();
  const isSearchPending = searchKeyword !== deferredKeyword;
  const searchablePosts = useMemo(() => posts.map((post) => ({
    post,
    text: `${post.title}\n${post.content}\n${post.tags.join("\n")}`.toLowerCase(),
    timestamp: Date.parse(post.date) || 0,
  })), [posts]);


  const filteredPosts = useMemo(() => {
    let result = [...searchablePosts];

    if (selectedTags.length > 0) {
      result = result.filter(({ post }) => post.tags.some((tag) => selectedTags.includes(tag)));
    }

    if (normalizedKeyword) {
      result = result.filter(({ text }) => text.includes(normalizedKeyword));
    }

    result.sort((a, b) => {
      const diff = a.timestamp - b.timestamp;
      return sortDesc ? -diff : diff;
    });

    return result.map(({ post }) => post);
  }, [searchablePosts, normalizedKeyword, sortDesc, selectedTags]);
  const pageCount = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const visiblePosts = filteredPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

  const toggleTag = (tag: string) => {
    setPage(1);
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const isFiltering = Boolean(searchKeyword.trim() || selectedTags.length > 0);
  const clearFilters = () => { setSearchKeyword(""); setSelectedTags([]); setPage(1); };

  return (
    <Box component="main" ref={mainRef} className="flex-1 mx-auto w-full max-w-4xl sm:px-4 px-6 py-8">
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 3, fontWeight: "bold", fontSize: { xs: "2rem", sm: "3rem" } }}>
        {t.blogPage.posts}
      </Typography>

      {/* Toolbar */}
      <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          placeholder={t.blogPage.search}
          value={searchKeyword}
          onChange={(e) => { setSearchKeyword(e.target.value); setPage(1); }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchKeyword && (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label={t.blogPage.clearSearch} onClick={() => { setSearchKeyword(""); setPage(1); }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": t.blogPage.search, type: "search" },
          }}
          sx={{ minWidth: 0, flex: "1 1 240px" }}
        />

        <Tooltip title={sortDesc ? t.blogPage.sortAsc : t.blogPage.sortDesc}>
          <IconButton aria-label={sortDesc ? t.blogPage.sortAsc : t.blogPage.sortDesc} onClick={() => { setSortDesc(!sortDesc); setPage(1); }} color="primary">
            {sortDesc ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
          </IconButton>
        </Tooltip>

        <Button variant="outlined" startIcon={<FilterListIcon />} disabled={allTags.length === 0} aria-haspopup="dialog" aria-expanded={Boolean(tagFilterAnchor)} aria-controls={tagFilterAnchor ? "blog-tag-filter" : undefined} onClick={(e) => setTagFilterAnchor(e.currentTarget)}>
          {t.blogPage.filterByTag} {selectedTags.length > 0 && `(${selectedTags.length})`}
        </Button>

        {isFiltering && (
          <Button size="small" onClick={clearFilters}>
            {t.blogPage.clearFilters}
          </Button>
        )}
      </Box>

      {/* Tag filter summary */}
      <AnimatePresence>
        {selectedTags.length > 0 && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}
          >
            {selectedTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onDelete={() => toggleTag(tag)}
                color="primary"
                variant="outlined"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Typography variant="body2" color="text.secondary" role="status" aria-live="polite" sx={{ mb: 2 }}>
        {filteredPosts.length} {t.blogPage.results}
      </Typography>

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <Box sx={{ py: 6, px: 3, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 3 }}>
          <SearchIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">{isFiltering ? t.blogPage.noMatches : t.blogPage.noPosts}</Typography>
          {isFiltering && <Button sx={{ mt: 2 }} onClick={clearFilters}>{t.blogPage.clearFilters}</Button>}
        </Box>
      ) : (
        <Box aria-busy={isSearchPending} sx={{ display: "flex", flexDirection: "column", gap: 2, opacity: isSearchPending ? 0.6 : 1 }}>
          <AnimatePresence mode="popLayout">
            {visiblePosts.map((post) => (
              <motion.div
                key={post.slug}
                variants={cardVariants}
                initial={reduceMotion ? false : "hidden"}
                animate="visible"
                exit="exit"
                layout={!reduceMotion}
                transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
              >
                <Card sx={{ position: "relative", transition: "box-shadow 0.2s", "&:hover": { boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.5)}` } }}>
                  <Link href={`/blog/${locale}/${post.slug}`} style={{ textDecoration: "none", display: "block" }}>
                    <CardContent>
                      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: "medium", pr: 5 }}>
                        {highlightText(post.title, deferredKeyword)}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                        {post.tags.map((tag) => (
                          <Chip
                            key={tag}
                            icon={<LocalOfferIcon />}
                            label={highlightText(tag, deferredKeyword)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: "0.75rem", ...(selectedTags.includes(tag) && { borderColor: "primary.main", bgcolor: alpha(theme.palette.primary.main, 0.1) }) }}
                          />
                        ))}
                      </Box>
                      <Box sx={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip icon={<CalendarTodayIcon />} label={post.date.split('T')[0]} size="small" variant="outlined" />
                        <Chip icon={<VisibilityIcon />} label={`${allViews[post.slug] || 0} ${t.blog.views}`} size="small" variant="outlined" />
                      </Box>
                    </CardContent>
                  </Link>
                  <Collapse in={expandedTocSlug === post.slug} timeout="auto" unmountOnExit>
                    <Box id={`outline-${post.slug}`} sx={{ px: 2, pb: 2, borderTop: 1, borderColor: "divider" }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
                        {t.blogPage.outline}
                      </Typography>
                      <PostOutlinePreview content={post.content} locale={locale} slug={post.slug} />
                    </Box>
                  </Collapse>
                  <Tooltip title={t.blogPage.outline}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedTocSlug((prev) => (prev === post.slug ? null : post.slug));
                      }}
                      sx={{ position: "absolute", top: 12, right: 12 }}
                      aria-label={t.blogPage.outline}
                      aria-expanded={expandedTocSlug === post.slug}
                      aria-controls={expandedTocSlug === post.slug ? `outline-${post.slug}` : undefined}
                    >
                      {expandedTocSlug === post.slug ? <ExpandLessIcon /> : <TocIcon />}
                    </IconButton>
                  </Tooltip>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </Box>
      )}

      {pageCount > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination count={pageCount} page={currentPage} color="primary" aria-label={t.blogPage.pagination} onChange={(_, value) => {
            setPage(value);
            setExpandedTocSlug(null);
            mainRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion ? "instant" : "smooth" });
          }} />
        </Box>
      )}

      {/* Tag filter popover */}
      <Popover
        id="blog-tag-filter"
        open={Boolean(tagFilterAnchor)}
        anchorEl={tagFilterAnchor}
        onClose={() => setTagFilterAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box role="dialog" aria-label={t.blogPage.filterByTag} sx={{ p: 2, width: 320, maxWidth: "calc(100vw - 32px)" }}>
          <Typography variant="subtitle2" gutterBottom>
            {t.blogPage.filterByTag}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                onClick={() => toggleTag(tag)}
                variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                color={selectedTags.includes(tag) ? "primary" : "default"}
                size="small"
                aria-pressed={selectedTags.includes(tag)}
              />
            ))}
          </Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
            <Button onClick={() => setTagFilterAnchor(null)}>{t.blogPage.done}</Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
