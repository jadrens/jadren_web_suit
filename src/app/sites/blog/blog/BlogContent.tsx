"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Collapse,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import TocIcon from "@mui/icons-material/Toc";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useI18n } from "@blog/lib/i18n";
import { useTheme } from "@mui/material/styles";
import { Locale } from "@blog/lib/posts";
import { extractHeadings, Heading } from "@blog/components/reading/ReadingProgressContext";

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
  if (!keyword.trim()) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
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

interface TocPreviewItemProps {
  heading: Heading;
  locale: Locale;
  slug: string;
}

function TocPreviewItem({ heading, locale, slug }: TocPreviewItemProps) {
  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          component={Link}
          href={`/blog/${locale}/${slug}#${heading.id}`}
          sx={{ py: 0.5, pl: 1 + (heading.level - 1) * 1.5 }}
        >
          <ListItemText
            primary={
              <Typography variant={heading.level === 1 ? "body2" : "caption"} noWrap>
                {heading.text}
              </Typography>
            }
          />
        </ListItemButton>
      </ListItem>
      {heading.children.map((child) => (
        <TocPreviewItem key={child.id} heading={child} locale={locale} slug={slug} />
      ))}
    </>
  );
}

export default function BlogContent({ posts, allViews, locale, allTags }: BlogContentProps) {
  const { t } = useI18n();
  const theme = useTheme();

  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterAnchor, setTagFilterAnchor] = useState<HTMLElement | null>(null);
  const [expandedTocSlug, setExpandedTocSlug] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (selectedTags.length > 0) {
      result = result.filter((post) => post.tags.some((tag) => selectedTags.includes(tag)));
    }

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(
        (post) =>
          post.title.toLowerCase().includes(keyword) ||
          post.content.toLowerCase().includes(keyword) ||
          post.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    }

    result.sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDesc ? -diff : diff;
    });

    return result;
  }, [posts, searchKeyword, sortDesc, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const isFiltering = searchKeyword.trim() || selectedTags.length > 0;

  return (
    <Box component="main" className="flex-1 mx-auto w-full max-w-4xl sm:px-4 px-6 py-8">
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4, fontWeight: "bold" }}>
        {t.blogPage.posts}
      </Typography>

      {/* Toolbar */}
      <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          placeholder={t.blogPage.search}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 200, flex: 1 }}
        />

        <Tooltip title={sortDesc ? t.blogPage.sortAsc : t.blogPage.sortDesc}>
          <IconButton onClick={() => setSortDesc(!sortDesc)} color="primary">
            {sortDesc ? <ArrowDownwardIcon /> : <ArrowUpwardIcon />}
          </IconButton>
        </Tooltip>

        <Button variant="outlined" startIcon={<FilterListIcon />} onClick={(e) => setTagFilterAnchor(e.currentTarget)}>
          {t.blogPage.filterByTag} {selectedTags.length > 0 && `(${selectedTags.length})`}
        </Button>

        {isFiltering && (
          <Button size="small" onClick={() => { setSearchKeyword(""); setSelectedTags([]); }}>
            {t.blogPage.clearFilters}
          </Button>
        )}
      </Box>

      {/* Tag filter summary */}
      <AnimatePresence>
        {selectedTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16, display: "flex", gap: 1, flexWrap: "wrap" }}
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

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <Typography color="text.secondary">{t.blogPage.noPosts}</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <AnimatePresence mode="popLayout">
            {filteredPosts.map((post) => (
              <motion.div
                key={post.slug}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Card sx={{ position: "relative", transition: "box-shadow 0.2s", "&:hover": { boxShadow: `0 0 15px ${alpha(theme.palette.primary.main, 0.5)}` } }}>
                  <Link href={`/blog/${locale}/${post.slug}`} style={{ textDecoration: "none", display: "block" }}>
                    <CardContent>
                      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: "medium", pr: 5 }}>
                        {highlightText(post.title, searchKeyword)}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                        {post.tags.map((tag) => (
                          <Chip
                            key={tag}
                            icon={<LocalOfferIcon />}
                            label={highlightText(tag, searchKeyword)}
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
                    <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: "divider" }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
                        {t.blogPage.outline}
                      </Typography>
                      {extractHeadings(post.content).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          {t.toc.noHeadings}
                        </Typography>
                      ) : (
                        <List dense disablePadding>
                          {extractHeadings(post.content).map((heading) => (
                            <TocPreviewItem key={heading.id} heading={heading} locale={locale} slug={post.slug} />
                          ))}
                        </List>
                      )}
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

      {/* Tag filter popover */}
      <Popover
        open={Boolean(tagFilterAnchor)}
        anchorEl={tagFilterAnchor}
        onClose={() => setTagFilterAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 280 }}>
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
              />
            ))}
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}