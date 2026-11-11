"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { alpha } from "@mui/material";
import Footer from "@components/ui/layout/Footer";
import { Snackbar } from "@components/ui/feedback/toast";
import { useI18n } from "@lib/i18n/app";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import QRCode from "qrcode";
import SITE_CONFIG from "@config/app/config";

export default function QrcodeClient() {
  const { t } = useI18n();
  const theme = useTheme();
  useDocumentTitle(t.tools.qrcode.title);

  const [text, setText] = useState(SITE_CONFIG.baseUrl as string);
  const [toast, setToast] = useState({ open: false, message: "" });
  const [generated, setGenerated] = useState({ key: "", url: "", failed: false });

  const value = text.trim();
  const isDark = theme.palette.mode === "dark";
  const dark = isDark ? theme.palette.primary.main : "#111111";
  const light = isDark ? theme.palette.background.paper : "#ffffff";
  // The code is regenerated whenever the text or the colours change.
  const key = value ? JSON.stringify([value, dark, light]) : "";
  const current = generated.key === key;
  const imageUrl = value && current ? generated.url : "";
  // While the next code renders, keep showing the previous one (dimmed) instead of the empty hint.
  const previewUrl = value ? imageUrl || generated.url : "";
  const failed = Boolean(value) && current && generated.failed;
  // An empty field is a normal state, shown in the preview; only a failure is an error.
  const error = failed ? t.tools.qrcode.generateFailed : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 320, color: { dark, light } })
      .then((url) => ({ key, url, failed: false }))
      .catch(() => ({ key, url: "", failed: true }))
      .then((result) => {
        if (!cancelled) setGenerated(result);
      });
    return () => {
      cancelled = true;
    };
  }, [key, value, dark, light]);

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
                  {previewUrl && !failed ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                      <Box
                        component="img"
                        src={previewUrl}
                        alt="QR code"
                        sx={{ width: 280, height: 280, borderRadius: 3, opacity: imageUrl ? 1 : 0.5, transition: "opacity .15s" }}
                      />
                      <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownload}
                        disabled={!imageUrl}
                        sx={{ px: 3, py: 1.1, borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                      >
                        {t.tools.qrcode.download}
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="body2" color={failed ? "error" : "text.secondary"} sx={{ textAlign: "center", maxWidth: 280 }}>
                      {failed ? t.tools.qrcode.generateFailed : t.tools.qrcode.emptyHint}
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
