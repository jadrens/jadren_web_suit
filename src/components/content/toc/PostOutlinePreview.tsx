"use client";

import { useMemo } from "react";
import Link from "next/link";
import { List, ListItem, ListItemButton, ListItemText, Typography } from "@mui/material";
import { extractHeadings, type Heading } from "../reading/headings";
import { useI18n } from "@lib/i18n/content";
import type { Locale } from "@lib/publishing/posts";

function TocPreviewItem({ heading, locale, slug }: { heading: Heading; locale: Locale; slug: string }) {
  return <>
    <ListItem disablePadding>
      <ListItemButton component={Link} href={`/blog/${locale}/${slug}#${encodeURIComponent(heading.id)}`} sx={{ py: 0.5, pl: 1 + (heading.level - 1) * 1.5 }}>
        <ListItemText primary={<Typography variant={heading.level === 1 ? "body2" : "caption"} noWrap>{heading.text}</Typography>} />
      </ListItemButton>
    </ListItem>
    {heading.children.map((child) => <TocPreviewItem key={child.id} heading={child} locale={locale} slug={slug} />)}
  </>;
}

export default function PostOutlinePreview({ content, locale, slug }: { content: string; locale: Locale; slug: string }) {
  const { t } = useI18n();
  const headings = useMemo(() => extractHeadings(content), [content]);
  return headings.length === 0
    ? <Typography variant="body2" color="text.secondary">{t.toc.noHeadings}</Typography>
    : <List dense disablePadding>{headings.map((heading) => <TocPreviewItem key={heading.id} heading={heading} locale={locale} slug={slug} />)}</List>;
}
