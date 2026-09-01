"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { alpha } from "@mui/material";
import Footer from "@tool/components/layout/Footer";
import { useI18n } from "@shared/libs/i18n/tool";
import { useDocumentTitle } from "@tool/hooks/useDocumentTitle";
import QRCode from "qrcode";
import SITE_CONFIG from "@tool/var/config";

export default function QrcodeClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.tools.qrcode.title);

  const [text, setText] = useState(SITE_CONFIG.baseUrl as string);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "" });

  const handleGenerate = useCallback(async () => {
    const value = text.trim();

    if (!value) {
      setImageUrl("");
      setError(t.tools.qrcode.emptyHint);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const isDark = theme.palette.mode === "dark";
      const dark = isDark ? theme.palette.primary.main : "#111111";
      const light = isDark ? theme.palette.background.paper : "#ffffff";

      const url = await QRCode.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: {
          dark,
          light,
        },
      });
      setImageUrl(url);
    } catch {
      setError(t.tools.qrcode.generateFailed);
      setImageUrl("");
    } finally {
      setLoading(false);
    }
  }, [text, theme.palette.mode, t.tools.qrcode.emptyHint, t.tools.qrcode.generateFailed]);

  useEffect(() => {
    void handleGenerate();
  }, [handleGenerate]);

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "qrcode.png";
    link.click();
  };

  const handleCopyText = async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setToast({ open: true, message: t.tools.qrcode.copied });
    } catch {
      setToast({ open: true, message: t.tools.qrcode.copyFailed });
    }
  };

  const handleClear = () => {
    setText("");
    setImageUrl("");
    setError("");
  };

  return (
    <div className="page-below-navbar flex flex-col">
      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          px: 3,
          py: 8,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 960 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              mb: 1,
              fontFamily: "var(--font-inter)",
            }}
          >
            {t.tools.qrcode.title}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              textAlign: "center",
              color: "text.secondary",
              mb: 5,
            }}
          >
            {t.tools.qrcode.description}
          </Typography>

          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
              alignItems: "start",
            }}
          >
            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={2.5}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <QrCode2Icon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {t.tools.qrcode.input}
                    </Typography>
                  </Box>

                  <TextField
                    multiline
                    fullWidth
                    minRows={7}
                    maxRows={12}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t.tools.qrcode.placeholder}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.9rem",
                      },
                    }}
                  />

                  {error ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                      {error}
                    </Alert>
                  ) : null}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Button
                      variant="contained"
                      onClick={handleGenerate}
                      disabled={loading}
                      sx={{ px: 3, py: 1.2, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                    >
                      {loading ? t.tools.qrcode.generating : t.tools.qrcode.generate}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleClear}
                      sx={{ px: 3, py: 1.2, borderRadius: 2, textTransform: "none" }}
                    >
                      {t.tools.qrcode.clear}
                    </Button>
                    <Button
                      variant="text"
                      onClick={handleCopyText}
                      startIcon={<ContentCopyIcon />}
                      sx={{ px: 1.5, py: 1.2, borderRadius: 2, textTransform: "none" }}
                    >
                      {t.tools.qrcode.copyText}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {t.tools.qrcode.preview}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t.tools.qrcode.previewHint}
                </Typography>

                <Box
                  sx={{
                    minHeight: 340,
                    borderRadius: 3,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 3,
                  }}
                >
                  {imageUrl ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                      <img src={imageUrl} alt="QR code" style={{ width: 280, height: 280, borderRadius: 12 }} />
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
                        sx={{ px: 3, py: 1.1, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                      >
                        {t.tools.qrcode.download}
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 280 }}>
                      {t.tools.qrcode.emptyHint}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
      <Footer />

      <Snackbar
        open={toast.open}
        autoHideDuration={2000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
