"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Breadcrumbs, Button, Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import MarkdownContent from "@components/content/MarkdownContent";
import TableOfContents from "@components/content/toc/TableOfContents";
import TableOfContentsDrawer from "@components/content/toc/TableOfContentsDrawer";
import FloatingTOCButton from "@components/content/toc/FloatingTOCButton";
import ReadingProgressBar from "@components/content/reading/ReadingProgressBar";
import BackToTopButton from "@components/content/reading/BackToTopButton";
import { ReadingProgressProvider } from "@components/content/reading/ReadingProgressContext";
import Footer from "@components/ui/layout/Footer";
import { useScrollProgress } from "@hooks/reading/useScrollProgress";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useI18n } from "@lib/i18n/app";

type Localized = { zh: string; en: string };
interface DocMeta { slug: string; title: Localized; description: Localized; toolHref: string; toolLabel: Localized }
interface Doc extends DocMeta { content: Localized }

export function DocsIndex({ entries }: { entries: DocMeta[] }) {
  const { locale } = useI18n(); const zh = locale === "zh";
  useDocumentTitle(zh ? "开发文档" : "Documentation");
  return <div className="page-below-navbar flex min-h-screen flex-col"><Box component="main" sx={{ flex: 1, width: "100%", maxWidth: 1000, mx: "auto", px: 3, py: 7 }}>
    <Typography component="h1" variant="h3" sx={{ fontWeight: 750, mb: 2 }}>{zh ? "开发文档" : "Documentation"}</Typography>
    <Typography color="text.secondary" sx={{ mb: 4 }}>{zh ? "接口参考、请求示例与使用说明。" : "API references, request examples, and usage guides."}</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>{entries.map(entry => <Card key={entry.slug} variant="outlined" sx={{ borderRadius: 3 }}><CardActionArea component={Link} href={`/docs/${entry.slug}`}><CardContent sx={{ p: 3 }}><Chip size="small" label="API" sx={{ mb: 2 }} /><Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>{entry.title[locale]}</Typography><Typography color="text.secondary">{entry.description[locale]}</Typography></CardContent></CardActionArea></Card>)}</Box>
  </Box><Footer /></div>;
}

function DocArticle({ doc }: { doc: Doc }) {
  const { locale } = useI18n(); const [drawerOpen, setDrawerOpen] = useState(false);
  useScrollProgress(); useDocumentTitle(doc.title[locale]);
  return <div className="page-below-navbar flex min-h-screen flex-col">
    <ReadingProgressBar /><BackToTopButton /><FloatingTOCButton onClick={() => setDrawerOpen(true)} /><TableOfContentsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    <Box sx={{ width: "100%", maxWidth: 1320, mx: "auto", px: { xs: 2.5, md: 4 }, py: 6, flex: 1, display: { xs: "block", sm: "grid" }, gridTemplateColumns: "minmax(0, 1fr) 250px", gap: 4, alignItems: "start" }}>
      <Box component="main" sx={{ minWidth: 0 }}>
        <Breadcrumbs sx={{ mb: 3 }}><Link href="/docs">{locale === "zh" ? "开发文档" : "Documentation"}</Link><Typography color="text.primary">{doc.title[locale]}</Typography></Breadcrumbs>
        <Box component="article"><Stack direction="row" spacing={1} sx={{ mb: 2 }}><Chip size="small" label="API" /><Chip size="small" variant="outlined" label={locale === "zh" ? "公开接口 · 无需登录" : "Public · No authentication"} /></Stack>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 750, mb: 2 }}>{doc.title[locale]}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{doc.description[locale]}</Typography>
          <Button component={Link} href={doc.toolHref} variant="outlined" size="small" sx={{ mb: 4 }}>{doc.toolLabel[locale]}</Button>
          <MarkdownContent key={locale} content={doc.content[locale]} />
        </Box>
      </Box>
      <TableOfContents />
    </Box><Footer />
  </div>;
}

export default function DocsClient({ doc }: { doc: Doc }) {
  return <ReadingProgressProvider><DocArticle doc={doc} /></ReadingProgressProvider>;
}
