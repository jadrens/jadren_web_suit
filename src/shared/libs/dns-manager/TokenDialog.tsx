"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
} from "@mui/material";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { hasToken, setToken, checkHealth } from "./api";
import { alpha, useTheme } from "@mui/material";

interface Props {
  onAuthenticated: () => void;
}

export default function TokenDialog({ onAuthenticated }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show dialog only if no token is stored
    if (!hasToken()) {
      setOpen(true);
    }
  }, []);

  const handleSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Token cannot be empty");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Temporarily store token and test it with a health check
      setToken(trimmed);
      await checkHealth();
      setOpen(false);
      onAuthenticated();
    } catch {
      // Health check doesn't require auth, try stats instead
      try {
        const { getStats } = await import("./api");
        await getStats();
        setOpen(false);
        onAuthenticated();
      } catch {
        setError(
          "Unable to authenticate. Please check your token and ensure the server is reachable."
        );
        // Remove invalid token
        const { removeToken } = await import("./api");
        removeToken();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && token.trim() && !loading) {
      handleSave();
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(4px)" } },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pt: 3, pb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: "primary.main",
          }}
        >
          <VpnKeyIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            DNS Manager — Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your API token to access the DNS server
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        <TextField
          autoFocus
          fullWidth
          label="API Token"
          type="password"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your Bearer token..."
          slotProps={{
            input: {
              sx: {
                borderRadius: 2,
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: "0.9rem",
              },
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          The token is stored in your browser&apos;s localStorage and sent as a Bearer token with
          every request to <code>nshk.jadren.me</code>.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!token.trim() || loading}
          sx={{
            px: 4,
            py: 1.2,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          {loading ? "Verifying..." : "Save & Connect"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
