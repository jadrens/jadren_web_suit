interface ReminderEmailInput {
  title: string;
  note: string;
  scheduledFor: Date;
  quotaResetsAt: Date | null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function reminderEmail(input: ReminderEmailInput) {
  const safeTitle = escapeHtml(input.title);
  const safeNote = escapeHtml(input.note).replace(/\r?\n/g, "<br>");
  const scheduled = input.scheduledFor.toISOString();
  const reset = input.quotaResetsAt?.toISOString();
  const quotaText = reset
    ? `\n\nYou have reached 25 reminder emails in the current UTC hour. Further reminders will be suppressed until ${reset}.\n当前 UTC 小时已发送 25 封提醒邮件，后续提醒将暂停至 ${reset}。`
    : "";
  const quotaHtml = reset
    ? `<div style="margin-top:24px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.7;">You have reached 25 reminder emails in the current UTC hour. Further reminders will be suppressed until <strong>${reset}</strong>.<br>当前 UTC 小时已发送 25 封提醒邮件，后续提醒将暂停至 <strong>${reset}</strong>。</div>`
    : "";

  return {
    subject: `[Reminder] ${input.title}`,
    text: `${input.note}\n\nScheduled for: ${scheduled}${quotaText}`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#17202a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f6f8;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e6e9ed;border-radius:16px;overflow:hidden;"><tr><td style="padding:26px 32px;background:#111827;color:#fff;"><div style="font-size:13px;color:#cbd5e1;">jadren tools reminder</div><h1 style="margin:8px 0 0;font-size:22px;line-height:1.4;">${safeTitle}</h1></td></tr><tr><td style="padding:30px 32px;"><div style="font-size:16px;line-height:1.8;">${safeNote}</div>${quotaHtml}<div style="margin-top:26px;padding-top:16px;border-top:1px solid #eef0f2;font-size:12px;color:#9ca3af;">Scheduled for ${scheduled}<br>This is an automated message from jadren tools.</div></td></tr></table></td></tr></table></body></html>`,
  };
}
