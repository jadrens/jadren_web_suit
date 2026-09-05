interface BlogDeletionEmailInput {
  title: string;
  locale: "en" | "zh";
  slug: string;
  reason: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

export function blogDeletionEmail(input: BlogDeletionEmailInput) {
  const title = escapeHtml(input.title);
  const reason = escapeHtml(input.reason).replace(/\r?\n/g, "<br>");
  const path = `/blog/${input.locale}/${input.slug}`;
  return {
    subject: `文章已删除：${input.title}`,
    text: `你的文章已被管理员删除。\n\n文章：${input.title}\n原路径：${path}\n理由：${input.reason}`,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文章已删除</title></head><body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#17202a;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f4f6f8;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e6e9ed;border-radius:16px;overflow:hidden;"><tr><td style="padding:26px 32px;background:#991b1b;color:#fff;"><div style="font-size:13px;color:#fecaca;">jadren blog</div><h1 style="margin:8px 0 0;font-size:22px;">文章已删除</h1></td></tr><tr><td style="padding:30px 32px;"><p style="font-size:16px;line-height:1.8;">你的文章 <strong>${title}</strong> 已被管理员删除。</p><div style="margin:20px 0;padding:16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;"><div style="font-size:13px;color:#991b1b;font-weight:700;margin-bottom:8px;">删除理由</div><div style="line-height:1.8;">${reason}</div></div><div style="font-size:13px;color:#6b7280;">原文章路径：${escapeHtml(path)}</div></td></tr></table></td></tr></table></body></html>`,
  };
}
