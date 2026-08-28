"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddAlertRoundedIcon from "@mui/icons-material/AddAlertRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import Footer from "@tool/components/layout/Footer";
import { ShowNavbarLoginStatus } from "@tool/components/layout/NavbarLoginStatus";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import {
  ApiError,
  remindersApi,
  type EmailAudit,
  type Reminder,
} from "@tool/lib/client-api";
import { useAuth } from "@tool/lib/client-api/use-auth";
import { useI18n } from "@tool/lib/i18n";

function formatDate(value: string, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(new Date(value));
}

function statusColor(status: Reminder["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "default" as const;
}

export default function ReminderClient() {
  const { t, locale } = useI18n();
  const copy = t.tools.reminder;
  const { status, isAuthenticated, user } = useAuth();
  useDocumentTitle(copy.title);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [audits, setAudits] = useState<EmailAudit[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [repeats, setRepeats] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState("30");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await remindersApi.list();
      setReminders(response.reminders);
    } catch {
      setError(copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed]);

  useEffect(() => {
    if (status === "authenticated" && user?.status === 1) {
      const timer = window.setTimeout(() => void loadReminders(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isAuthenticated, loadReminders, status, user?.status, user?.userId]);

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedTitle = title.trim();
    const normalizedNote = note.trim();
    const date = new Date(remindAt);
    const interval = Number(repeatInterval);
    if (!normalizedTitle || normalizedTitle.length > 160) {
      setError(copy.invalidTitle);
      return;
    }
    if (!normalizedNote || normalizedNote.length > 5000) {
      setError(copy.invalidNote);
      return;
    }
    if (!remindAt || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      setError(copy.invalidTime);
      return;
    }
    if (repeats && (!Number.isInteger(interval) || interval < 30)) {
      setError(copy.invalidInterval);
      return;
    }

    setCreating(true);
    try {
      const response = await remindersApi.create({
        title: normalizedTitle,
        note: normalizedNote,
        remindAt: date.toISOString(),
        repeats,
        repeatIntervalMinutes: repeats ? interval : null,
      });
      setReminders((current) => [response.reminder, ...current]);
      setTitle("");
      setNote("");
      setRemindAt("");
      setRepeats(false);
      setRepeatInterval("30");
      setMessage(copy.created);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.code === "invalid_repeat_interval"
          ? copy.invalidInterval
          : requestError instanceof ApiError && requestError.code === "remind_at_not_future"
            ? copy.invalidTime
            : copy.createFailed
      );
    } finally {
      setCreating(false);
    }
  }

  async function setReminderStatus(reminder: Reminder) {
    const nextStatus = reminder.status === "active" ? "paused" : "active";
    setError(null);
    try {
      const response = await remindersApi.setStatus(reminder.reminderId, nextStatus);
      setReminders((current) =>
        current.map((item) =>
          item.reminderId === reminder.reminderId ? response.reminder : item
        )
      );
      setMessage(copy.updated);
    } catch {
      setError(copy.updateFailed);
    }
  }

  async function deleteReminder(reminder: Reminder) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setError(null);
    try {
      await remindersApi.delete(reminder.reminderId);
      setReminders((current) =>
        current.filter((item) => item.reminderId !== reminder.reminderId)
      );
      setMessage(copy.deleted);
    } catch {
      setError(copy.deleteFailed);
    }
  }

  async function toggleAudit() {
    const nextOpen = !auditOpen;
    setAuditOpen(nextOpen);
    if (!nextOpen) return;
    setAuditLoading(true);
    try {
      const response = await remindersApi.audit();
      setAudits(response.audits);
    } catch {
      setError(copy.loadFailed);
    } finally {
      setAuditLoading(false);
    }
  }

  const authLoading = status === "uninitialized" || status === "refreshing";

  return (
    <div className="page-below-navbar flex flex-col">
      <ShowNavbarLoginStatus />
      <Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 920, mx: "auto", px: 2, py: 6 }}>
        <Stack spacing={0.5} sx={{ mb: 3, alignItems: "center", textAlign: "center" }}>
          <NotificationsActiveRoundedIcon color="primary" sx={{ fontSize: 38 }} />
          <Typography variant="h4" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>{copy.title}</Typography>
          <Typography variant="body2" color="text.secondary">{copy.description}</Typography>
        </Stack>

        {authLoading ? (
          <Stack spacing={2} sx={{ py: 8, alignItems: "center" }}><CircularProgress /><Typography color="text.secondary">{copy.loading}</Typography></Stack>
        ) : !isAuthenticated ? (
          <Card elevation={0} sx={{ maxWidth: 560, mx: "auto", border: 1, borderColor: "divider", borderRadius: 2.5 }}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <LoginRoundedIcon color="primary" sx={{ fontSize: 42, mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{copy.loginTitle}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>{copy.loginDescription}</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "center" }}>
                <Button component={Link} href="/login?next=%2Ftools%2Freminder" variant="contained">{copy.login}</Button>
                <Button component={Link} href="/register" variant="outlined">{copy.register}</Button>
              </Stack>
            </CardContent>
          </Card>
        ) : user?.status !== 1 ? (
          <Alert severity="warning">{copy.verifyRequired}</Alert>
        ) : (
          <Stack spacing={2.5}>
            {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
            {message ? <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert> : null}
            <Alert severity="info">{copy.quotaInfo}</Alert>

            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack component="form" spacing={2} onSubmit={createReminder} noValidate>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><AddAlertRoundedIcon color="primary" /><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{copy.createTitle}</Typography></Stack>
                  <TextField label={copy.reminderTitle} value={title} onChange={(event) => setTitle(event.target.value.slice(0, 160))} helperText={copy.titleHint} required slotProps={{ htmlInput: { maxLength: 160 } }} />
                  <TextField label={copy.note} value={note} onChange={(event) => setNote(event.target.value.slice(0, 5000))} helperText={copy.noteHint} required multiline minRows={4} slotProps={{ htmlInput: { maxLength: 5000 } }} />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "flex-start" } }}>
                    <TextField label={copy.remindAt} type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                    <FormControlLabel control={<Switch checked={repeats} onChange={(event) => setRepeats(event.target.checked)} />} label={copy.repeats} sx={{ minWidth: 210 }} />
                  </Stack>
                  <Collapse in={repeats} unmountOnExit>
                    <TextField label={copy.repeatEvery} type="number" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} helperText={copy.repeatHint} required fullWidth slotProps={{ htmlInput: { min: 30, max: 525600, step: 1 } }} />
                  </Collapse>
                  <Button type="submit" variant="contained" disabled={creating} sx={{ alignSelf: "flex-start", minWidth: 150 }}>{creating ? <CircularProgress size={20} color="inherit" /> : copy.create}</Button>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{copy.listTitle}</Typography>
              {loading ? <Stack direction="row" spacing={1.5} sx={{ py: 3 }}><CircularProgress size={20} /><Typography variant="body2">{copy.loading}</Typography></Stack> : reminders.length === 0 ? <Alert severity="info">{copy.empty}</Alert> : (
                <Stack spacing={1.5}>
                  {reminders.map((reminder) => (
                    <Card key={reminder.reminderId} elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{reminder.title}</Typography><Chip size="small" color={statusColor(reminder.status)} label={copy[reminder.status]} /><Chip size="small" variant="outlined" label={reminder.repeats ? copy.repeating(reminder.repeatIntervalMinutes ?? 30) : copy.once} /></Stack>
                            <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reminder.note}</Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }} sx={{ mt: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">{copy.nextAt}: {formatDate(reminder.nextRemindAt, locale)}</Typography>
                              <Typography variant="caption" color="text.secondary">{copy.lastSentAt}: {reminder.lastSentAt ? formatDate(reminder.lastSentAt, locale) : copy.neverSent}</Typography>
                            </Stack>
                            {reminder.lastDeliveryStatus === "rate_limited" ? <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>{copy.rateLimited}</Typography> : null}
                          </Box>
                          <Stack direction="row">
                            {reminder.status !== "completed" ? <Tooltip title={reminder.status === "active" ? copy.pause : copy.resume}><IconButton onClick={() => void setReminderStatus(reminder)}>{reminder.status === "active" ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}</IconButton></Tooltip> : null}
                            <Tooltip title={copy.delete}><IconButton color="error" onClick={() => void deleteReminder(reminder)}><DeleteOutlineRoundedIcon /></IconButton></Tooltip>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />
            <Box>
              <Button startIcon={<HistoryRoundedIcon />} onClick={() => void toggleAudit()}>{auditOpen ? copy.hideAudit : copy.showAudit}</Button>
              <Collapse in={auditOpen} unmountOnExit>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  <Box><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{copy.auditTitle}</Typography><Typography variant="body2" color="text.secondary">{copy.auditDescription}</Typography></Box>
                  {auditLoading ? <CircularProgress size={22} /> : audits.length === 0 ? <Alert severity="info">{copy.auditEmpty}</Alert> : audits.map((audit) => (
                    <Card key={audit.auditId} elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}><CardContent sx={{ p: 2 }}>
                      <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}><Typography sx={{ fontWeight: 700 }}>{audit.subject}</Typography><Chip size="small" color={audit.status === "sent" ? "success" : audit.status === "failed" ? "error" : "warning"} label={audit.status === "sent" ? copy.auditSent : audit.status === "failed" ? copy.auditFailed : copy.auditPending} /></Stack>
                      <Typography variant="caption" color="text.secondary">{copy.auditRecipient}: {audit.recipientEmail} · {copy.auditCreated}: {formatDate(audit.createdAt, locale)}</Typography>
                      <Typography variant="body2" sx={{ mt: 1.25, p: 1.5, bgcolor: "action.hover", borderRadius: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{audit.bodyText}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, overflowWrap: "anywhere" }}>{copy.auditHash}: {audit.contentSha256}</Typography>
                      {audit.failureMessage ? <Alert severity="error" sx={{ mt: 1 }}>{audit.failureMessage}</Alert> : null}
                    </CardContent></Card>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          </Stack>
        )}
      </Box>
      <Footer />
    </div>
  );
}
