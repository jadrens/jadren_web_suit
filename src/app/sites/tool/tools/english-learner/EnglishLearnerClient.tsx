"use client";

import Link from "next/link";
import { alpha, Box, Card, CardActionArea, Typography, useTheme } from "@mui/material";
import SpellcheckRoundedIcon from "@mui/icons-material/SpellcheckRounded";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@shared/libs/i18n/tool";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";

export default function EnglishLearnerClient() {
  const { t } = useI18n(); const theme = useTheme(); const copy = t.tools.englishLearner;
  useDocumentTitle(copy.title);
  return <div className="page-below-navbar flex flex-col"><Box component="main" sx={{ flex: 1, px: 3, py: 8 }}><Box sx={{ maxWidth: 960, mx: "auto" }}>
    <Typography variant="h4" sx={{ fontWeight: 700, textAlign: "center" }}>{copy.title}</Typography><Typography color="text.secondary" sx={{ mt: 1, mb: 6, textAlign: "center" }}>{copy.description}</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 3 }}>
      <Card variant="outlined" sx={{ borderRadius: 2, "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)", boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, .12)}` }, transition: "all .2s" }}><CardActionArea component={Link} href="/tools/english-learner/grammar-checker" sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
        <Box sx={{ width: 56, height: 56, display: "grid", placeItems: "center", borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, .1), color: "primary.main" }}><SpellcheckRoundedIcon sx={{ fontSize: 32 }} /></Box>
        <Box><Typography variant="h6" sx={{ fontWeight: 600 }}>{copy.grammar.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{copy.grammar.cardDescription}</Typography></Box>
      </CardActionArea></Card>
    </Box>
  </Box></Box><Footer /></div>;
}
