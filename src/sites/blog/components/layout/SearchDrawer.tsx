"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  CircularProgress,
  alpha,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { useI18n } from "@blog/lib/i18n";
import { Locale } from "@blog/lib/posts";

interface SearchResult {
  slug: string;
  title: string;
  date: string;
  tags: string[];
}

interface SearchResponse {
  results: SearchResult[];
  tags: string[];
}

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}

export default function SearchDrawer({ open, onClose, locale }: SearchDrawerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`);
      const data: SearchResponse = await res.json();
      setResults(data.results);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleResultClick = (slug: string) => {
    router.push(`/blog/${locale}/${slug}`);
    setQuery("");
    onClose();
  };

  return (
    <Drawer
      anchor="top"
      open={open}
      onClose={onClose}
      sx={{ "& .MuiDrawer-paper": { height: "60vh", maxHeight: 500, px: 3, pt: 2 } }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {t.search.title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label="ESC"
            size="small"
            variant="outlined"
            onClick={onClose}
            sx={{ cursor: "pointer", fontSize: "0.7rem" }}
          />
          <Chip
            icon={<CloseIcon sx={{ fontSize: 16 }} />}
            size="small"
            variant="outlined"
            onClick={onClose}
            sx={{ cursor: "pointer" }}
          />
        </Box>
      </Box>

      <TextField
        autoFocus
        fullWidth
        size="medium"
        placeholder={t.search.placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {loading ? <CircularProgress size={20} /> : <SearchIcon />}
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ overflow: "auto", flex: 1 }}>
        {results.length === 0 && query.trim() ? (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            {t.search.noResults}
          </Typography>
        ) : (
          <List dense>
            {results.map((result) => (
              <ListItem key={result.slug} disablePadding>
                <ListItemButton onClick={() => handleResultClick(result.slug)}>
                  <ListItemText
                    primary={result.title}
                    secondary={
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mt: 0.5 }}>
                        <Chip
                          icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                          label={result.date}
                          size="small"
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                        {result.tags.slice(0, 3).map((tag) => (
                          <Chip
                            key={tag}
                            icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ height: 24, fontSize: "0.7rem" }}
                          />
                        ))}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}