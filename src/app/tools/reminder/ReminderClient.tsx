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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddAlertRoundedIcon from "@mui/icons-material/AddAlertRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EditNotificationsRoundedIcon from "@mui/icons-material/EditNotificationsRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import Footer from "@components/ui/layout/Footer";
import { ShowNavbarLoginStatus } from "@components/ui/layout/NavbarLoginStatus";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useAutoRefresh } from "@hooks/app/useAutoRefresh";
import {
  ApiError,
  remindersApi,
  type EmailAudit,
  type Reminder,
  type ReminderScheduleType,
} from "@lib/client-api";
import { useAuth } from "@lib/client-api/use-auth";
import { useI18n } from "@lib/i18n/app";

const URGENT_WINDOW_MS = 30 * 60_000;
const MAX_REPEAT_INTERVAL_MINUTES = 525_600;
type RepeatIntervalUnit = "minutes" | "hours" | "days";

const INTERVAL_UNIT_MINUTES: Record<RepeatIntervalUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1_440,
};

function intervalParts(minutes: number): { value: string; unit: RepeatIntervalUnit } {
  if (minutes % 1_440 === 0) return { value: String(minutes / 1_440), unit: "days" };
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: "hours" };
  return { value: String(minutes), unit: "minutes" };
}

function intervalInMinutes(value: string, unit: RepeatIntervalUnit) {
  return Number(value) * INTERVAL_UNIT_MINUTES[unit];
}

function formatDate(value: string, locale: "en" | "zh") {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function statusColor(status: Reminder["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "default" as const;
}

function isDueSoon(reminder: Reminder, now: number) {
  return reminder.status === "active" &&
    reminder.nextRemindAt !== null &&
    new Date(reminder.nextRemindAt).getTime() - now < URGENT_WINDOW_MS;
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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
  const [scheduleType, setScheduleType] = useState<ReminderScheduleType>("one_time");
  const [repeatInterval, setRepeatInterval] = useState("30");
  const [repeatIntervalUnit, setRepeatIntervalUnit] = useState<RepeatIntervalUnit>("minutes");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [editingContent, setEditingContent] = useState<Reminder | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [contentSaving, setContentSaving] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Reminder | null>(null);
  const [editScheduleType, setEditScheduleType] = useState<ReminderScheduleType>("one_time");
  const [editRemindAt, setEditRemindAt] = useState("");
  const [editRepeatInterval, setEditRepeatInterval] = useState("30");
  const [editRepeatIntervalUnit, setEditRepeatIntervalUnit] = useState<RepeatIntervalUnit>("minutes");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReminders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await remindersApi.list();
      setReminders(response.reminders);
      setRefreshedAt(Date.now());
    } catch {
      setError(copy.loadFailed);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [copy.loadFailed]);

  const loadAudits = useCallback(async (showLoading = true) => {
    if (showLoading) setAuditLoading(true);
    try {
      const response = await remindersApi.audit();
      setAudits(response.audits);
    } catch {
      setError(copy.loadFailed);
    } finally {
      if (showLoading) setAuditLoading(false);
    }
  }, [copy.loadFailed]);

  useEffect(() => {
    if (status === "authenticated" && user?.status === 1) {
      const timer = window.setTimeout(() => void loadReminders(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isAuthenticated, loadReminders, status, user?.status, user?.userId]);

  useAutoRefresh(
    async () => {
      await Promise.all([
        loadReminders(false),
        auditOpen ? loadAudits(false) : Promise.resolve(),
      ]);
    },
    status === "authenticated" && user?.status === 1
  );

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalizedTitle = title.trim();
    const normalizedNote = note.trim();
    const date = scheduleType === "never" ? null : new Date(remindAt);
    const interval = intervalInMinutes(repeatInterval, repeatIntervalUnit);
    if (!normalizedTitle || normalizedTitle.length > 160) {
      setError(copy.invalidTitle);
      return;
    }
    if (!normalizedNote || normalizedNote.length > 5000) {
      setError(copy.invalidNote);
      return;
    }
    if (scheduleType !== "never" && (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now())) {
      setError(copy.invalidTime);
      return;
    }
    if (scheduleType === "repeat" && (!Number.isInteger(interval) || interval < 30 || interval > MAX_REPEAT_INTERVAL_MINUTES)) {
      setError(copy.invalidInterval);
      return;
    }

    setCreating(true);
    try {
      const response = await remindersApi.create({
        title: normalizedTitle,
        note: normalizedNote,
        remindAt: date?.toISOString() ?? null,
        scheduleType,
        repeatIntervalMinutes: scheduleType === "repeat" ? interval : null,
      });
      setReminders((current) => [response.reminder, ...current]);
      setTitle("");
      setNote("");
      setRemindAt("");
      setScheduleType("one_time");
      setRepeatInterval("30");
      setRepeatIntervalUnit("minutes");
      setCreateOpen(false);
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

  function openContentEditor(reminder: Reminder) {
    setError(null);
    setEditingContent(reminder);
    setEditTitle(reminder.title);
    setEditNote(reminder.note);
  }

  async function updateReminderContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingContent) return;
    const normalizedTitle = editTitle.trim();
    const normalizedNote = editNote.trim();
    if (!normalizedTitle || normalizedTitle.length > 160) {
      setError(copy.invalidTitle);
      return;
    }
    if (!normalizedNote || normalizedNote.length > 5000) {
      setError(copy.invalidNote);
      return;
    }

    setContentSaving(true);
    setError(null);
    try {
      const response = await remindersApi.updateContent(editingContent.reminderId, {
        title: normalizedTitle,
        note: normalizedNote,
      });
      setReminders((current) =>
        current.map((item) =>
          item.reminderId === response.reminder.reminderId
            ? response.reminder
            : item
        )
      );
      setEditingContent(null);
      setMessage(copy.contentUpdated);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.code === "invalid_title"
          ? copy.invalidTitle
          : requestError instanceof ApiError && requestError.code === "invalid_note"
            ? copy.invalidNote
            : copy.updateFailed
      );
    } finally {
      setContentSaving(false);
    }
  }

  function openScheduleEditor(reminder: Reminder) {
    setError(null);
    setEditingSchedule(reminder);
    setEditScheduleType(reminder.scheduleType);
    setEditRemindAt(toDateTimeLocal(reminder.nextRemindAt));
    const interval = intervalParts(reminder.repeatIntervalMinutes ?? 30);
    setEditRepeatInterval(interval.value);
    setEditRepeatIntervalUnit(interval.unit);
  }

  async function updateReminderSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSchedule) return;
    const date = editScheduleType === "never" ? null : new Date(editRemindAt);
    const interval = intervalInMinutes(editRepeatInterval, editRepeatIntervalUnit);
    if (editScheduleType !== "never" && (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now())) {
      setError(copy.invalidTime);
      return;
    }
    if (editScheduleType === "repeat" && (!Number.isInteger(interval) || interval < 30 || interval > MAX_REPEAT_INTERVAL_MINUTES)) {
      setError(copy.invalidInterval);
      return;
    }

    setScheduleSaving(true);
    setError(null);
    try {
      const response = await remindersApi.updateSchedule(editingSchedule.reminderId, {
        scheduleType: editScheduleType,
        remindAt: date?.toISOString() ?? null,
        repeatIntervalMinutes: editScheduleType === "repeat" ? interval : null,
      });
      setReminders((current) =>
        current.map((item) =>
          item.reminderId === response.reminder.reminderId
            ? response.reminder
            : item
        )
      );
      setEditingSchedule(null);
      setMessage(copy.scheduleUpdated);
    } catch {
      setError(copy.updateFailed);
    } finally {
      setScheduleSaving(false);
    }
  }

  async function toggleAudit() {
    const nextOpen = !auditOpen;
    setAuditOpen(nextOpen);
    if (!nextOpen) return;
    await loadAudits();
  }

  function repeatLabel(minutes: number) {
    const interval = intervalParts(minutes);
    if (interval.unit === "days") return copy.repeatingDays(Number(interval.value));
    if (interval.unit === "hours") return copy.repeatingHours(Number(interval.value));
    return copy.repeating(Number(interval.value));
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

            <Button startIcon={<AddAlertRoundedIcon />} variant="contained" onClick={() => { setError(null); setCreateOpen(true); }} sx={{ alignSelf: "flex-start" }}>{copy.addReminder}</Button>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{copy.listTitle}</Typography>
              {loading ? <Stack direction="row" spacing={1.5} sx={{ py: 3 }}><CircularProgress size={20} /><Typography variant="body2">{copy.loading}</Typography></Stack> : reminders.length === 0 ? <Alert severity="info">{copy.empty}</Alert> : (
                <Stack spacing={1.5}>
                  {reminders.map((reminder) => (
                    <Card key={reminder.reminderId} elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h6" sx={{ fontWeight: 700 }}>{reminder.title}</Typography>{reminder.scheduleType !== "never" ? <Chip size="small" color={statusColor(reminder.status)} label={copy[reminder.status]} /> : null}<Chip size="small" variant="outlined" label={reminder.scheduleType === "repeat" ? repeatLabel(reminder.repeatIntervalMinutes ?? 30) : reminder.scheduleType === "never" ? copy.never : copy.once} /></Stack>
                            <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reminder.note}</Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }} sx={{ mt: 1.5 }}>
                              {reminder.nextRemindAt ? <Typography variant="caption" color={isDueSoon(reminder, refreshedAt) ? "error.main" : "text.secondary"} sx={{ fontWeight: isDueSoon(reminder, refreshedAt) ? 700 : undefined }}>{copy.nextAt}: {formatDate(reminder.nextRemindAt, locale)}</Typography> : null}
                              <Typography variant="caption" color="text.secondary">{copy.lastSentAt}: {reminder.lastSentAt ? formatDate(reminder.lastSentAt, locale) : copy.neverSent}</Typography>
                            </Stack>
                            {isDueSoon(reminder, refreshedAt) ? <Typography variant="caption" color="error.main" sx={{ display: "block", fontWeight: 700, mt: 0.5 }}>{copy.dueSoon}</Typography> : null}
                            {reminder.lastDeliveryStatus === "rate_limited" ? <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>{copy.rateLimited}</Typography> : null}
                          </Box>
                          <Stack direction="row">
                            {reminder.scheduleType !== "never" && reminder.status !== "completed" ? <Tooltip title={reminder.status === "active" ? copy.pause : copy.resume}><IconButton onClick={() => void setReminderStatus(reminder)}>{reminder.status === "active" ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}</IconButton></Tooltip> : null}
                            <Tooltip title={copy.editContent}><IconButton onClick={() => openContentEditor(reminder)}><EditRoundedIcon /></IconButton></Tooltip>
                            <Tooltip title={copy.editSchedule}><IconButton color="primary" onClick={() => openScheduleEditor(reminder)}><EditNotificationsRoundedIcon /></IconButton></Tooltip>
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
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={createReminder} noValidate>
          <DialogTitle>{copy.createTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
              <TextField label={copy.reminderTitle} value={title} onChange={(event) => setTitle(event.target.value.slice(0, 160))} helperText={copy.titleHint} required autoFocus slotProps={{ htmlInput: { maxLength: 160 } }} />
              <TextField label={copy.note} value={note} onChange={(event) => setNote(event.target.value.slice(0, 5000))} helperText={copy.noteHint} required multiline minRows={4} slotProps={{ htmlInput: { maxLength: 5000 } }} />
              <FormControl fullWidth>
                <InputLabel>{copy.scheduleType}</InputLabel>
                <Select label={copy.scheduleType} value={scheduleType} onChange={(event) => setScheduleType(event.target.value as ReminderScheduleType)}>
                  <MenuItem value="one_time">{copy.once}</MenuItem>
                  <MenuItem value="repeat">{copy.repeat}</MenuItem>
                  <MenuItem value="never">{copy.never}</MenuItem>
                </Select>
              </FormControl>
              {scheduleType !== "never" ? <TextField label={copy.remindAt} type="datetime-local" value={remindAt} onChange={(event) => setRemindAt(event.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} /> : null}
              {scheduleType === "repeat" ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField label={copy.repeatEvery} type="number" value={repeatInterval} onChange={(event) => setRepeatInterval(event.target.value)} helperText={copy.repeatHint} required fullWidth slotProps={{ htmlInput: { min: repeatIntervalUnit === "minutes" ? 30 : 1, max: Math.floor(MAX_REPEAT_INTERVAL_MINUTES / INTERVAL_UNIT_MINUTES[repeatIntervalUnit]), step: 1 } }} />
                <FormControl sx={{ minWidth: { sm: 160 } }}>
                  <InputLabel>{copy.intervalUnit}</InputLabel>
                  <Select label={copy.intervalUnit} value={repeatIntervalUnit} onChange={(event) => setRepeatIntervalUnit(event.target.value as RepeatIntervalUnit)}>
                    <MenuItem value="minutes">{copy.minutes}</MenuItem>
                    <MenuItem value="hours">{copy.hours}</MenuItem>
                    <MenuItem value="days">{copy.days}</MenuItem>
                  </Select>
                </FormControl>
              </Stack> : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)} disabled={creating}>{copy.cancel}</Button>
            <Button type="submit" variant="contained" disabled={creating}>{creating ? copy.creating : copy.create}</Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={Boolean(editingContent)} onClose={() => !contentSaving && setEditingContent(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={updateReminderContent} noValidate>
          <DialogTitle>{copy.editContent}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
              <TextField label={copy.reminderTitle} value={editTitle} onChange={(event) => setEditTitle(event.target.value.slice(0, 160))} helperText={copy.titleHint} required autoFocus slotProps={{ htmlInput: { maxLength: 160 } }} />
              <TextField label={copy.note} value={editNote} onChange={(event) => setEditNote(event.target.value.slice(0, 5000))} helperText={copy.noteHint} required multiline minRows={5} slotProps={{ htmlInput: { maxLength: 5000 } }} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingContent(null)} disabled={contentSaving}>{copy.cancel}</Button>
            <Button type="submit" variant="contained" disabled={contentSaving}>{contentSaving ? copy.saving : copy.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog open={Boolean(editingSchedule)} onClose={() => !scheduleSaving && setEditingSchedule(null)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={updateReminderSchedule}>
          <DialogTitle>{copy.editSchedule}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">{copy.editScheduleDescription}</Typography>
              <FormControl fullWidth>
                <InputLabel>{copy.scheduleType}</InputLabel>
                <Select label={copy.scheduleType} value={editScheduleType} onChange={(event) => setEditScheduleType(event.target.value as ReminderScheduleType)}>
                  <MenuItem value="one_time">{copy.once}</MenuItem>
                  <MenuItem value="repeat">{copy.repeat}</MenuItem>
                  <MenuItem value="never">{copy.never}</MenuItem>
                </Select>
              </FormControl>
              {editScheduleType !== "never" ? <TextField label={copy.remindAt} type="datetime-local" value={editRemindAt} onChange={(event) => setEditRemindAt(event.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} /> : null}
              {editScheduleType === "repeat" ? <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField label={copy.repeatEvery} type="number" value={editRepeatInterval} onChange={(event) => setEditRepeatInterval(event.target.value)} helperText={copy.repeatHint} required fullWidth slotProps={{ htmlInput: { min: editRepeatIntervalUnit === "minutes" ? 30 : 1, max: Math.floor(MAX_REPEAT_INTERVAL_MINUTES / INTERVAL_UNIT_MINUTES[editRepeatIntervalUnit]), step: 1 } }} />
                <FormControl sx={{ minWidth: { sm: 150 } }}>
                  <InputLabel>{copy.intervalUnit}</InputLabel>
                  <Select label={copy.intervalUnit} value={editRepeatIntervalUnit} onChange={(event) => setEditRepeatIntervalUnit(event.target.value as RepeatIntervalUnit)}>
                    <MenuItem value="minutes">{copy.minutes}</MenuItem>
                    <MenuItem value="hours">{copy.hours}</MenuItem>
                    <MenuItem value="days">{copy.days}</MenuItem>
                  </Select>
                </FormControl>
              </Stack> : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditingSchedule(null)} disabled={scheduleSaving}>{copy.cancel}</Button>
            <Button type="submit" variant="contained" disabled={scheduleSaving}>{scheduleSaving ? copy.saving : copy.save}</Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Footer />
    </div>
  );
}
