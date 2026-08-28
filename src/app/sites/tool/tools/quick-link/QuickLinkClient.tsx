"use client";

import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddLinkRoundedIcon from "@mui/icons-material/AddLinkRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import Footer from "@tool/components/layout/Footer";
import { ShowNavbarLoginStatus } from "@tool/components/layout/NavbarLoginStatus";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import { useAuth } from "@tool/lib/client-api/use-auth";
import { ApiError, quickLinksApi, type QuickLink } from "@tool/lib/client-api";
import { useI18n } from "@tool/lib/i18n";

const QUICK_LINK_BASE_URL = "https://koi.ci/s/";
const SHORT_NAME_PATTERN = /^[A-Za-z0-9]{1,64}$/;

function formatDate(value: string, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function validTargetUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

interface EditDraft {
  link: QuickLink;
  targetUrl: string;
  note: string;
  expiresAt: string;
}

export default function QuickLinkClient() {
  const { t, locale } = useI18n();
  const copy = t.tools.quickLink;
  const { status, isAuthenticated, user } = useAuth();
  useDocumentTitle(copy.title);

  const [links, setLinks] = useState<QuickLink[]>([]);
  const [shortName, setShortName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedLink, setSelectedLink] = useState<QuickLink | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      if (!isAuthenticated) setLinks([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    quickLinksApi
      .list()
      .then((response) => {
        if (active) setLinks(response.links);
      })
      .catch(() => {
        if (active) setError(copy.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [copy.loadFailed, isAuthenticated, status, user?.userId]);

  function replaceLink(updated: QuickLink) {
    setLinks((current) =>
      current.map((linkItem) =>
        linkItem.shortName === updated.shortName ? updated : linkItem
      )
    );
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = shortName.trim();
    setError(null);

    if (!SHORT_NAME_PATTERN.test(normalizedName)) {
      setError(copy.invalidShortName);
      return;
    }
    if (!validTargetUrl(targetUrl)) {
      setError(copy.invalidTargetUrl);
      return;
    }
    if (note.length > 255) {
      setError(copy.invalidNote);
      return;
    }

    const expiration = new Date(expiresAt);
    if (
      !expiresAt ||
      !Number.isFinite(expiration.getTime()) ||
      expiration.getTime() <= Date.now()
    ) {
      setError(copy.invalidExpiration);
      return;
    }

    setCreating(true);
    try {
      const response = await quickLinksApi.create({
        shortName: normalizedName,
        targetUrl: targetUrl.trim(),
        note: note.trim() || null,
        expiresAt: expiration.toISOString(),
      });
      setLinks((current) => [response.link, ...current]);
      setShortName("");
      setTargetUrl("");
      setNote("");
      setExpiresAt("");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.code === "quick_link_exists"
          ? copy.nameExists
          : requestError instanceof ApiError && requestError.code === "invalid_short_name"
            ? copy.invalidShortName
            : requestError instanceof ApiError && requestError.code === "invalid_target_url"
              ? copy.invalidTargetUrl
              : copy.createFailed
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(shortNameToCopy: string) {
    try {
      await navigator.clipboard.writeText(`${QUICK_LINK_BASE_URL}${shortNameToCopy}`);
      setToast(copy.copied);
    } catch {
      setToast(copy.copyFailed);
    }
  }

  function openMenu(event: MouseEvent<HTMLElement>, linkItem: QuickLink) {
    setMenuAnchor(event.currentTarget);
    setSelectedLink(linkItem);
  }

  function closeMenu() {
    setMenuAnchor(null);
  }

  function openEditor() {
    if (!selectedLink) return;
    setEditDraft({
      link: selectedLink,
      targetUrl: selectedLink.targetUrl,
      note: selectedLink.note ?? "",
      expiresAt: toDateTimeLocal(selectedLink.expiresAt),
    });
    setEditError(null);
    closeMenu();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDraft) return;
    setEditError(null);

    if (!validTargetUrl(editDraft.targetUrl)) {
      setEditError(copy.invalidTargetUrl);
      return;
    }
    if (editDraft.note.length > 255) {
      setEditError(copy.invalidNote);
      return;
    }

    let nextExpiration: string | undefined;
    const originalExpiration = toDateTimeLocal(editDraft.link.expiresAt);
    if (editDraft.expiresAt !== originalExpiration) {
      const parsed = new Date(editDraft.expiresAt);
      if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.getTime() <= new Date(editDraft.link.expiresAt).getTime() ||
        parsed.getTime() <= Date.now()
      ) {
        setEditError(copy.extensionInvalid);
        return;
      }
      nextExpiration = parsed.toISOString();
    }

    setSaving(true);
    try {
      const response = await quickLinksApi.update(editDraft.link.shortName, {
        targetUrl: editDraft.targetUrl.trim(),
        note: editDraft.note.trim() || null,
        ...(nextExpiration ? { expiresAt: nextExpiration } : {}),
      });
      replaceLink(response.link);
      setEditDraft(null);
      setToast(copy.updated);
    } catch (requestError) {
      setEditError(
        requestError instanceof ApiError && requestError.code === "invalid_target_url"
          ? copy.invalidTargetUrl
          : requestError instanceof ApiError && requestError.code === "expiration_not_extended"
            ? copy.extensionInvalid
            : copy.updateFailed
      );
    } finally {
      setSaving(false);
    }
  }

  async function disableSelected() {
    const linkItem = selectedLink;
    closeMenu();
    if (!linkItem || !window.confirm(copy.disableConfirm)) return;
    setError(null);
    try {
      const response = await quickLinksApi.update(linkItem.shortName, {
        disable: true,
      });
      replaceLink(response.link);
      setToast(copy.disabled);
    } catch {
      setError(copy.updateFailed);
    }
  }

  async function deleteSelected() {
    const linkItem = selectedLink;
    closeMenu();
    if (!linkItem || !window.confirm(copy.deleteConfirm)) return;
    setError(null);
    try {
      await quickLinksApi.delete(linkItem.shortName);
      setLinks((current) =>
        current.filter((item) => item.shortName !== linkItem.shortName)
      );
      setToast(copy.deleted);
    } catch {
      setError(copy.deleteFailed);
    }
  }

  const authIsLoading = status === "uninitialized" || status === "refreshing";

  return (
    <div className="page-below-navbar flex flex-col">
      <ShowNavbarLoginStatus />
      <Box
        component="main"
        sx={{ flex: 1, width: "100%", maxWidth: 920, mx: "auto", px: 2, py: 6 }}
      >
        <Stack spacing={0.5} sx={{ mb: 3, alignItems: "center", textAlign: "center" }}>
          <LinkRoundedIcon color="primary" sx={{ fontSize: 34 }} />
          <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            {copy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.description}
          </Typography>
        </Stack>

        {authIsLoading ? (
          <Stack spacing={2} sx={{ py: 8, alignItems: "center" }}>
            <CircularProgress />
            <Typography color="text.secondary">{copy.loading}</Typography>
          </Stack>
        ) : !isAuthenticated ? (
          <Card elevation={0} sx={{ maxWidth: 560, mx: "auto", border: 1, borderColor: "divider", borderRadius: 2.5 }}>
            <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: "center" }}>
              <LoginRoundedIcon color="primary" sx={{ fontSize: 40, mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {copy.loginTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {copy.loginDescription}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "center" }}>
                <Button
                  component={Link}
                  href="/login?next=%2Ftools%2Fquick-link"
                  variant="contained"
                >
                  {copy.login}
                </Button>
                <Button component={Link} href="/register" variant="outlined">{copy.register}</Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2.5}>
            {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack component="form" spacing={2} onSubmit={createLink} noValidate>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <AddLinkRoundedIcon color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{copy.createTitle}</Typography>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "0.75fr 1.25fr" }, gap: 1.5 }}>
                    <TextField
                      size="small"
                      label={copy.shortName}
                      value={shortName}
                      onChange={(event) => setShortName(event.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 64))}
                      helperText={copy.shortNameHint}
                      required
                      slotProps={{ htmlInput: { maxLength: 64, pattern: "[A-Za-z0-9]{1,64}" } }}
                    />
                    <TextField
                      size="small"
                      label={copy.targetUrl}
                      placeholder={copy.targetPlaceholder}
                      value={targetUrl}
                      onChange={(event) => setTargetUrl(event.target.value)}
                      required
                    />
                    <TextField
                      size="small"
                      label={copy.note}
                      value={note}
                      onChange={(event) => setNote(event.target.value.slice(0, 255))}
                      helperText={copy.noteHint}
                      slotProps={{ htmlInput: { maxLength: 255 } }}
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        size="small"
                        label={copy.expiration}
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                        required
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <Button type="submit" variant="contained" disabled={creating} sx={{ minWidth: 108, height: 40 }}>
                        {creating ? <CircularProgress size={20} color="inherit" /> : copy.create}
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{copy.listTitle}</Typography>
              {loading ? (
                <Stack direction="row" spacing={1.5} sx={{ py: 3, alignItems: "center" }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">{copy.loading}</Typography>
                </Stack>
              ) : links.length === 0 ? (
                <Alert severity="info">{copy.empty}</Alert>
              ) : (
                <TableContainer component={Card} elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
                  <Table size="small" sx={{ minWidth: 760, tableLayout: "fixed" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 190 }}>{copy.shortName}</TableCell>
                        <TableCell>{copy.targetUrl} / {copy.note}</TableCell>
                        <TableCell align="right" sx={{ width: 72 }}>{copy.visits}</TableCell>
                        <TableCell sx={{ width: 160 }}>{copy.expiresAt}</TableCell>
                        <TableCell align="right" sx={{ width: 92 }}>{copy.actions}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {links.map((quickLink) => {
                        const url = `${QUICK_LINK_BASE_URL}${quickLink.shortName}`;
                        const expired = new Date(quickLink.expiresAt).getTime() <= Date.now();
                        return (
                          <TableRow key={quickLink.shortName} hover>
                            <TableCell>
                              <MuiLink href={url} target="_blank" rel="noopener noreferrer" sx={{ display: "block", overflow: "hidden", fontWeight: 700, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {quickLink.shortName}
                              </MuiLink>
                              <Typography variant="caption" color="text.secondary">{formatDate(quickLink.createdAt, locale)}</Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 0 }}>
                              <MuiLink href={quickLink.targetUrl} target="_blank" rel="noopener noreferrer" color="text.primary" sx={{ display: "block", overflow: "hidden", fontSize: "0.8125rem", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {quickLink.targetUrl}
                              </MuiLink>
                              <Typography variant="caption" color="text.secondary" title={quickLink.note ?? undefined} sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {quickLink.note || copy.noNote}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>{quickLink.clickCount}</TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ display: "block" }}>{formatDate(quickLink.expiresAt, locale)}</Typography>
                              <Chip size="small" label={expired ? copy.expired : copy.active} color={expired ? "default" : "success"} sx={{ height: 20, mt: 0.25 }} />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title={copy.copy}>
                                <IconButton size="small" onClick={() => void copyLink(quickLink.shortName)} aria-label={copy.copy}>
                                  <ContentCopyRoundedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <IconButton size="small" onClick={(event) => openMenu(event, quickLink)} aria-label={copy.actions}>
                                <MoreVertRoundedIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Stack>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={openEditor}><EditRoundedIcon fontSize="small" sx={{ mr: 1 }} />{copy.edit}</MenuItem>
        <MenuItem onClick={() => void disableSelected()}><BlockRoundedIcon fontSize="small" sx={{ mr: 1 }} />{copy.disable}</MenuItem>
        <MenuItem onClick={() => void deleteSelected()} sx={{ color: "error.main" }}><DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />{copy.delete}</MenuItem>
      </Menu>

      <Dialog open={Boolean(editDraft)} onClose={() => !saving && setEditDraft(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={saveEdit}>
          <DialogTitle>{copy.editTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {editError ? <Alert severity="error">{editError}</Alert> : null}
              <TextField
                label={copy.targetUrl}
                value={editDraft?.targetUrl ?? ""}
                onChange={(event) =>
                  setEditDraft((current) =>
                    current ? { ...current, targetUrl: event.target.value } : current
                  )
                }
                required
                fullWidth
              />
              <TextField
                label={copy.note}
                value={editDraft?.note ?? ""}
                onChange={(event) =>
                  setEditDraft((current) =>
                    current
                      ? { ...current, note: event.target.value.slice(0, 255) }
                      : current
                  )
                }
                helperText={copy.noteHint}
                slotProps={{ htmlInput: { maxLength: 255 } }}
                fullWidth
              />
              <TextField
                label={copy.extendExpiration}
                type="datetime-local"
                value={editDraft?.expiresAt ?? ""}
                onChange={(event) =>
                  setEditDraft((current) =>
                    current ? { ...current, expiresAt: event.target.value } : current
                  )
                }
                helperText={copy.extendHint}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDraft(null)} disabled={saving}>{copy.cancel}</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? copy.saving : copy.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Footer />
      <Snackbar open={Boolean(toast)} autoHideDuration={2200} onClose={() => setToast("")} message={toast} />
    </div>
  );
}
