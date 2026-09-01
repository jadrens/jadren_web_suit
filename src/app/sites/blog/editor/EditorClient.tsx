"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ForkRightRoundedIcon from "@mui/icons-material/ForkRightRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import MarkdownContent from "@blog/components/content/MarkdownContent";
import { ReadingProgressProvider } from "@blog/components/reading/ReadingProgressContext";
import type {
  EditorArticle,
  EditorArticleSummary,
} from "@shared/libs/blog/editor";
import { useI18n, type Locale } from "@shared/libs/i18n/blog";
import { apiClient, type HttpMethod } from "@shared/libs/client-api";
import { useAuth } from "@shared/libs/client-api/use-auth";
import Link from "next/link";
import VditorEditor from "./VditorEditor";
import { useUnsavedChanges } from "@shared/hooks/useUnsavedChanges";

const blankArticle = (locale: Locale): EditorArticle => ({
  pendingId: null,
  postId: null,
  locale,
  slug: "",
  title: "",
  description: "",
  content: locale === "zh" ? "# 新文章\n\n开始写作……" : "# New article\n\nStart writing…",
  tags: [],
  updatedAt: new Date().toISOString(),
  published: false,
  authorId: null,
  authorName: null,
  ownerId: null,
  ownerName: null,
  lastEditedUser: null,
  lastEditedUserName: null,
  forkedFromPendingId: null,
  contributors: [],
});

function articleFingerprint(
  article: EditorArticle | EditorArticleSummary,
  tags = article.tags
) {
  return JSON.stringify({
    pendingId: article.pendingId,
    postId: article.postId,
    locale: article.locale,
    slug: article.slug,
    title: article.title,
    description: article.description,
    content: "content" in article ? article.content : null,
    tags,
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
  return apiClient.request<T>((init?.method ?? "GET") as HttpMethod, path, {
    body,
    headers: init?.headers,
  });
}

export default function EditorClient() {
  const { locale, t } = useI18n();
  const auth = useAuth();
  const copy = t.editor;
  const [articles, setArticles] = useState<EditorArticleSummary[]>([]);
  const [articleTab, setArticleTab] = useState<"drafts" | "published">("drafts");
  const [isAdmin, setIsAdmin] = useState(false);
  const [article, setArticle] = useState<EditorArticle>(() => blankArticle(locale));
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    articleFingerprint(blankArticle(locale))
  );
  const [tagsText, setTagsText] = useState("");
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuArticle, setMenuArticle] = useState<EditorArticleSummary | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<EditorArticleSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditorArticleSummary | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const selectArticle = useCallback(async (
    next: EditorArticle | EditorArticleSummary
  ) => {
    if ("content" in next) {
      setArticle({ ...next });
      setSavedFingerprint(articleFingerprint(next));
      setTagsText(next.tags.join(", "));
      setMessage(null);
      return true;
    }

    const query = new URLSearchParams(
      next.pendingId
        ? { pendingId: next.pendingId }
        : { postId: next.postId ?? "" }
    );
    setBusy(true);
    setMessage(null);
    try {
      const { content } = await api<{ content: string }>(
        `/api/editor/articles/content?${query.toString()}`
      );
      const loaded = { ...next, content };
      setArticle(loaded);
      setSavedFingerprint(articleFingerprint(loaded));
      setTagsText(next.tags.join(", "));
      return true;
    } catch (error) {
      setMessage({
        severity: "error",
        text: error instanceof Error ? error.message : copy.loadFailed,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }, [copy.loadFailed]);

  const loadArticles = useCallback(async () => {
    const data = await api<{ articles: EditorArticleSummary[]; isAdmin: boolean }>("/api/editor/articles");
    setArticles(data.articles);
    setIsAdmin(data.isAdmin);
    const searchParams = new URLSearchParams(window.location.search);
    const requestedPendingId = searchParams.get("pending");
    const requestedLocale = searchParams.get("locale");
    const requestedSlug = searchParams.get("slug");
    const requestedArticle = requestedPendingId
      ? data.articles.find((item) => item.pendingId === requestedPendingId)
      : data.articles.find(
          (item) =>
            item.locale === requestedLocale &&
            item.slug === requestedSlug &&
            item.pendingId !== null
        ) ?? data.articles.find(
          (item) => item.locale === requestedLocale && item.slug === requestedSlug
        );
    if (requestedArticle) {
      setArticleTab(requestedArticle.pendingId ? "drafts" : "published");
      await selectArticle(requestedArticle);
    }
  }, [selectArticle]);

  const refreshArticles = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await loadArticles();
    } catch (error) {
      setMessage({
        severity: "error",
        text: error instanceof Error ? error.message : copy.loadFailed,
      });
    } finally {
      setBusy(false);
    }
  }, [copy.loadFailed, loadArticles]);

  useEffect(() => {
    if (auth.status === "uninitialized" || auth.status === "refreshing") return;
    if (auth.status !== "authenticated") {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      void loadArticles()
        .catch((error) => setMessage({
          severity: "error",
          text: error instanceof Error ? error.message : copy.loginFailed,
        }))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [auth.status, copy.loginFailed, loadArticles]);

  const normalizedTags = useMemo(
    () => [...new Set(tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))],
    [tagsText]
  );
  const isDirty = useMemo(
    () => articleFingerprint(article, normalizedTags) !== savedFingerprint,
    [article, normalizedTags, savedFingerprint]
  );
  useUnsavedChanges(isDirty, copy.unsavedChanges);
  const draftArticles = useMemo(
    () => articles.filter((item) => item.pendingId !== null),
    [articles]
  );
  const publishedArticles = useMemo(
    () => articles.filter((item) => item.pendingId === null),
    [articles]
  );
  const publishedGroups = useMemo(() => {
    const groups = new Map<string, EditorArticleSummary[]>();
    for (const item of publishedArticles) {
      const group = groups.get(item.slug) ?? [];
      group.push(item);
      groups.set(item.slug, group);
    }
    return [...groups.entries()].map(([slug, groupedArticles]) => ({
      slug,
      articles: groupedArticles.sort((left, right) => right.locale.localeCompare(left.locale)),
      missingLocales: (["zh", "en"] as const).filter(
        (locale) => !groupedArticles.some((item) => item.locale === locale)
      ),
    }));
  }, [publishedArticles]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{ pendingId: string }>("/api/editor/articles", {
        method: "POST",
        body: JSON.stringify({ ...article, tags: normalizedTags }),
      });
      const next = {
        ...article,
        pendingId: result.pendingId,
        published: false,
        tags: normalizedTags,
      };
      setArticle(next);
      setSavedFingerprint(articleFingerprint(next));
      setArticleTab("drafts");
      setMessage({
        severity: "success",
        text: isAdmin ? copy.savedAdmin : copy.submitted,
      });
      await loadArticles();
      return result.pendingId;
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : copy.saveFailed });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const pendingId = await save();
    if (!pendingId) return;
    setBusy(true);
    try {
      const result = await api<{
        postId: string;
        locale: string;
        slug: string;
        notificationSent: boolean;
      }>("/api/editor/publish", {
        method: "POST",
        body: JSON.stringify({ pendingId, message: approvalMessage }),
      });
      const publishedArticle = {
        ...article,
        postId: result.postId,
        pendingId: null,
        published: true,
        tags: normalizedTags,
      };
      setArticle(publishedArticle);
      setSavedFingerprint(articleFingerprint(publishedArticle));
      setArticleTab("published");
      setApproveOpen(false);
      setApprovalMessage("");
      setMessage({
        severity: "success",
        text: result.notificationSent
          ? `${copy.publishedNotified}: /blog/${result.locale}/${result.slug}`
          : `${copy.publishedMailFailed}: /blog/${result.locale}/${result.slug}`,
      });
      await loadArticles();
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : copy.publishFailed });
    } finally {
      setBusy(false);
    }
  };

  const openArticleMenu = (event: MouseEvent<HTMLElement>, item: EditorArticleSummary) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuArticle(item);
  };

  const closeArticleMenu = () => {
    setMenuAnchor(null);
    setMenuArticle(null);
  };

  const forkArticle = async (target: EditorArticleSummary) => {
    const path = target.pendingId
      ? `/api/admin/pending/${encodeURIComponent(target.pendingId)}/fork`
      : `/api/admin/articles/${encodeURIComponent(target.postId ?? "")}/fork`;
    setBusy(true);
    setMessage(null);
    closeArticleMenu();
    try {
      const result = await api<{ pendingId: string }>(path, { method: "POST" });
      window.location.assign(`/editor?pending=${encodeURIComponent(result.pendingId)}`);
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : copy.forkFailed });
      setBusy(false);
    }
  };

  const deleteArticle = async () => {
    if (!deleteTarget || !deleteReason.trim()) return;
    const path = deleteTarget.pendingId
      ? `/api/admin/pending/${encodeURIComponent(deleteTarget.pendingId)}`
      : `/api/admin/articles/${encodeURIComponent(deleteTarget.postId ?? "")}`;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{ deleted: boolean; notificationSent: boolean | null }>(path, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason }),
      });
      const deletedPostId = deleteTarget.postId;
      const deletedPendingId = deleteTarget.pendingId;
      setDeleteTarget(null);
      setDeleteReason("");
      if (article.pendingId === deletedPendingId || (deletedPostId && article.postId === deletedPostId)) {
        void selectArticle(blankArticle(locale));
      }
      await loadArticles();
      setMessage({
        severity: "success",
        text: result.notificationSent === true
          ? copy.deletedNotified
          : result.notificationSent === false
            ? copy.deletedMailFailed
            : copy.deletedNoEmail,
      });
    } catch (error) {
      setMessage({ severity: "error", text: error instanceof Error ? error.message : copy.deleteFailed });
    } finally {
      setBusy(false);
    }
  };

  const articleListItem = (item: EditorArticleSummary, showSlug: boolean) => (
    <Box
      key={item.pendingId ?? item.postId}
      sx={{ display: "flex", alignItems: "center", minWidth: 0 }}
    >
      <ListItemButton
        selected={(article.pendingId ?? article.postId) === (item.pendingId ?? item.postId)}
        onClick={() => void selectArticle(item)}
        sx={{ borderRadius: 1, gap: 1, minWidth: 0, py: 0.75 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {showSlug && (
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {item.slug || copy.noSlug}
            </Typography>
          )}
          <Tooltip title={item.title || copy.untitled} placement="right" arrow>
            <Typography component="div" variant="caption" color="text.secondary" noWrap>
              {item.title || copy.untitled}
            </Typography>
          </Tooltip>
        </Box>
        <Chip
          label={item.locale.toUpperCase()}
          size="small"
          variant="outlined"
          sx={{ flexShrink: 0, height: 22 }}
        />
      </ListItemButton>
      <Tooltip title={copy.moreActions}>
        <IconButton size="small" onClick={(event) => openArticleMenu(event, item)}>
          <MoreVertRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  if (loading) {
    return <Box sx={{ display: "grid", placeItems: "center", flex: 1, py: 10 }}><CircularProgress /></Box>;
  }

  if (auth.status !== "authenticated") {
    return (
      <Paper sx={{ width: "min(420px, calc(100% - 32px))", mx: "auto", mt: 8, p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{copy.editor}</Typography>
          <Typography color="text.secondary">{copy.loginDescription}</Typography>
          {message && <Alert severity={message.severity}>{message.text}</Alert>}
          <Button
            component={Link}
            href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/editor" : `${window.location.pathname}${window.location.search}`)}`}
            variant="contained"
          >
            {copy.login}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" }, flex: 1, minHeight: 0 }}>
      <Paper square variant="outlined" sx={{ borderTop: 0, borderBottom: 0, p: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.articles}</Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={copy.refresh}>
              <IconButton
                size="small"
                disabled={busy}
                aria-label={copy.refresh}
                onClick={() => void refreshArticles()}
              >
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={() => {
                setArticleTab("drafts");
                void selectArticle(blankArticle(locale));
              }}
            >
              {copy.create}
            </Button>
          </Stack>
        </Stack>
        <Tabs
          value={articleTab}
          onChange={(_, value: "drafts" | "published") => setArticleTab(value)}
          variant="fullWidth"
          sx={{ mb: 1 }}
        >
          <Tab value="drafts" label={`${copy.drafts} (${draftArticles.length})`} />
          <Tab value="published" label={`${copy.publishedPosts} (${publishedArticles.length})`} />
        </Tabs>
        {articleTab === "drafts" ? (
          <List dense disablePadding>
            {draftArticles.map((item) => articleListItem(item, true))}
            {draftArticles.length === 0 && (
              <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 3 }}>
                {copy.noDrafts}
              </Typography>
            )}
          </List>
        ) : (
          <Box>
            {publishedGroups.map((group) => (
              <Accordion
                key={group.slug}
                disableGutters
                defaultExpanded={group.articles.some((item) => item.postId === article.postId)}
                elevation={0}
                sx={{
                  "&::before": { display: "none" },
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {group.slug}
                    </Typography>
                    {group.missingLocales.length > 0 && (
                      <Chip
                        color="warning"
                        size="small"
                        label={`${copy.missing} ${group.missingLocales.map((locale) => locale.toUpperCase()).join(" / ")}`}
                        sx={{ mt: 0.5, height: 21 }}
                      />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 0.5, pt: 0 }}>
                  <List dense disablePadding>
                    {group.articles.map((item) => articleListItem(item, false))}
                  </List>
                </AccordionDetails>
              </Accordion>
            ))}
            {publishedGroups.length === 0 && (
            <Typography color="text.secondary" variant="body2" sx={{ px: 2, py: 3 }}>
                {copy.noPublished}
            </Typography>
            )}
          </Box>
        )}
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeArticleMenu}>
          <MenuItem
            onClick={() => {
              if (menuArticle) void selectArticle(menuArticle);
              closeArticleMenu();
            }}
          >
            {copy.edit}
          </MenuItem>
          {menuArticle && (
            <MenuItem
              onClick={() => {
                setDetailsTarget(menuArticle);
                closeArticleMenu();
              }}
            >
              <InfoOutlinedIcon fontSize="small" sx={{ mr: 1 }} />{copy.details}
            </MenuItem>
          )}
          {isAdmin && menuArticle?.pendingId && (
            <MenuItem
              onClick={() => {
                const target = menuArticle;
                closeArticleMenu();
                void selectArticle(target).then((loaded) => {
                  if (loaded) setApproveOpen(true);
                });
              }}
            >
              <CheckCircleRoundedIcon fontSize="small" sx={{ mr: 1 }} />{copy.approvePublish}
            </MenuItem>
          )}
          {isAdmin && menuArticle && (
            <MenuItem onClick={() => void forkArticle(menuArticle)}>
              <ForkRightRoundedIcon fontSize="small" sx={{ mr: 1 }} />Fork
            </MenuItem>
          )}
          {isAdmin && menuArticle && (
            <MenuItem
              sx={{ color: "error.main" }}
              onClick={() => {
                setDeleteTarget(menuArticle);
                closeArticleMenu();
              }}
            >
              <DeleteForeverRoundedIcon fontSize="small" sx={{ mr: 1 }} />{copy.delete}
            </MenuItem>
          )}
        </Menu>
        <Divider sx={{ my: 2 }} />
        <Button color="inherit" size="small" onClick={auth.logout}>{copy.logout}</Button>
      </Paper>

      <Box sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1, mb: 2 }}
        >
          <Typography color="text.secondary" variant="body2">
            {copy.editorDescription}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{
              alignItems: "center",
              justifyContent: { xs: "flex-start", sm: "flex-end" },
              flexWrap: "wrap",
              "& .MuiButton-root": { whiteSpace: "nowrap" },
            }}
          >
            {article.published && <Chip color="success" label={copy.published} />}
            <Button
              color="inherit"
              startIcon={<VisibilityRoundedIcon />}
              onClick={() => setPreviewOpen(true)}
            >
              {copy.preview}
            </Button>
            <Button
              color="inherit"
              startIcon={<TuneRoundedIcon />}
              onClick={() => setPropertiesOpen(true)}
            >
              {copy.properties}
            </Button>
            <Button variant="outlined" startIcon={<SaveRoundedIcon />} disabled={busy} onClick={() => void save()}>
              {isAdmin ? copy.saveDraft : copy.submitReview}
            </Button>
            {isAdmin && article.pendingId && (
              <Button
                variant="contained"
                startIcon={<PublishRoundedIcon />}
                disabled={busy}
                onClick={() => setApproveOpen(true)}
              >
                {copy.approvePublish}
              </Button>
            )}
          </Stack>
        </Stack>
        {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

        <Dialog open={propertiesOpen} onClose={() => setPropertiesOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{copy.properties}</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "120px minmax(0, 1fr)" },
                gap: 2,
                pt: 1,
              }}
            >
              <TextField
                select
                label={copy.language}
                value={article.locale}
                onChange={(event) => setArticle({ ...article, locale: event.target.value as "en" | "zh" })}
              >
                <MenuItem value="zh">中文</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </TextField>
              <TextField
                label="Slug"
                value={article.slug}
                helperText={copy.slugHelp}
                onChange={(event) => setArticle({ ...article, slug: event.target.value.toLowerCase() })}
              />
              <TextField
                label={copy.title}
                value={article.title}
                onChange={(event) => setArticle({ ...article, title: event.target.value })}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
              <TextField
                label={copy.description}
                value={article.description}
                multiline
                minRows={3}
                onChange={(event) => setArticle({ ...article, description: event.target.value })}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
              <TextField
                label={copy.tags}
                value={tagsText}
                helperText={copy.tagsHelp}
                onChange={(event) => setTagsText(event.target.value)}
                sx={{ gridColumn: { sm: "1 / -1" } }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPropertiesOpen(false)}>{copy.done}</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(detailsTarget)}
          onClose={() => setDetailsTarget(null)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{copy.postDetails}</DialogTitle>
          <DialogContent>
            {detailsTarget && (
              <Stack spacing={2} sx={{ pt: 0.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{copy.title}</Typography>
                  <Typography>{detailsTarget.title || copy.untitled}</Typography>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.status}</Typography>
                    <Typography>{detailsTarget.pendingId ? copy.pendingDraft : copy.published}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.language}</Typography>
                    <Typography>{detailsTarget.locale.toUpperCase()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Slug</Typography>
                    <Typography sx={{ overflowWrap: "anywhere" }}>{detailsTarget.slug}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.lastUpdated}</Typography>
                    <Typography>{new Date(detailsTarget.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.author}</Typography>
                    <Typography>{detailsTarget.authorName ?? copy.noRecord}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.owner}</Typography>
                    <Typography>{detailsTarget.ownerName ?? (detailsTarget.pendingId ? copy.noRecord : "—")}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.lastEditor}</Typography>
                    <Typography>{detailsTarget.lastEditedUserName ?? "—"}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">{copy.source}</Typography>
                    <Typography sx={{ overflowWrap: "anywhere" }}>
                      {detailsTarget.forkedFromPendingId
                        ? `Fork: ${detailsTarget.forkedFromPendingId}`
                        : detailsTarget.postId
                          ? `Post: ${detailsTarget.postId}`
                          : copy.newArticle}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{copy.tags}</Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: "wrap" }}>
                    {detailsTarget.tags.length > 0
                      ? detailsTarget.tags.map((tag) => <Chip key={tag} size="small" label={tag} />)
                      : <Typography variant="body2">{copy.noTags}</Typography>}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{copy.contributors}</Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {detailsTarget.contributors.length > 0
                      ? detailsTarget.contributors.map((contributor) => (
                        <Stack
                          key={contributor.userId}
                          direction="row"
                          sx={{ justifyContent: "space-between", gap: 2 }}
                        >
                          <Typography variant="body2">{contributor.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contributor.contributionCount} {copy.contributions}
                          </Typography>
                        </Stack>
                      ))
                      : <Typography variant="body2">{copy.noContributions}</Typography>}
                  </Stack>
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsTarget(null)}>{copy.close}</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fullScreen
        >
          <DialogTitle>{copy.preview}</DialogTitle>
          <DialogContent dividers sx={{ bgcolor: "background.default", px: { xs: 1, sm: 4 } }}>
            <Box sx={{ width: "min(100%, 960px)", mx: "auto" }}>
              <ReadingProgressProvider>
                <MarkdownContent content={article.content} />
              </ReadingProgressProvider>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>{copy.close}</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={approveOpen}
          onClose={() => { if (!busy) setApproveOpen(false); }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{copy.approvePublish}</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              {copy.approvalNotice}
            </Alert>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              label={copy.messageAuthor}
              value={approvalMessage}
              onChange={(event) => setApprovalMessage(event.target.value)}
              helperText={`${approvalMessage.length}/2000`}
              error={approvalMessage.length > 2000}
            />
          </DialogContent>
          <DialogActions>
            <Button
              disabled={busy}
              onClick={() => {
                setApproveOpen(false);
                setApprovalMessage("");
              }}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="contained"
              disabled={busy || approvalMessage.length > 2000}
              onClick={() => void publish()}
            >
              {copy.confirmApprove}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteTarget)}
          onClose={() => { if (!busy) setDeleteTarget(null); }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>{deleteTarget?.pendingId ? copy.deletePending : copy.deletePublished}</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {copy.deleteNotice.replace("{title}", deleteTarget?.title ?? copy.untitled)}
            </Alert>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              label={copy.deleteReason}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              helperText={`${deleteReason.length}/2000`}
              error={deleteReason.length > 2000}
            />
          </DialogContent>
          <DialogActions>
            <Button
              disabled={busy}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteReason("");
              }}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy || !deleteReason.trim() || deleteReason.length > 2000}
              onClick={() => void deleteArticle()}
            >
              {copy.confirmDelete}
            </Button>
          </DialogActions>
        </Dialog>

        <VditorEditor
          value={article.content}
          locale={locale}
          onChange={(content) => setArticle((current) => ({ ...current, content }))}
        />
      </Box>
    </Box>
  );
}
