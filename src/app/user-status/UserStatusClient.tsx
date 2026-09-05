"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Footer from "@components/ui/layout/Footer";
import { ShowNavbarLoginStatus } from "@components/ui/layout/NavbarLoginStatus";
import { useDocumentTitle } from "@hooks/app/useDocumentTitle";
import { useAuth } from "@lib/client-api/use-auth";
import { useI18n } from "@lib/i18n/app";

export default function UserStatusClient() {
  const { t, locale } = useI18n();
  const copy = t.auth.statusPage;
  const { status, isAuthenticated, user, logout } = useAuth();
  useDocumentTitle(copy.title);

  const loading = status === "uninitialized" || status === "refreshing";
  const statusLabel =
    user?.status === 0
      ? copy.statusUnverified
      : user?.status === 1
        ? copy.statusNormal
        : copy.statusUnavailable;
  const statusColor =
    user?.status === 1 ? "success" : user?.status === 0 ? "warning" : "error";

  return (
    <div className="page-below-navbar flex flex-col">
      <ShowNavbarLoginStatus />
      <Box
        component="main"
        sx={{ flex: 1, width: "100%", maxWidth: 620, mx: "auto", px: 2, py: 7 }}
      >
        <Stack spacing={0.75} sx={{ mb: 3, alignItems: "center", textAlign: "center" }}>
          <AccountCircleRoundedIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {copy.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.description}
          </Typography>
        </Stack>

        {loading ? (
          <Stack sx={{ py: 8, alignItems: "center" }}>
            <CircularProgress />
          </Stack>
        ) : isAuthenticated && user ? (
          <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{copy.nickname}</Typography>
                  <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{user.nickname}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{copy.email}</Typography>
                  <Typography sx={{ overflowWrap: "anywhere", textAlign: "right" }}>{user.email}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{copy.phone}</Typography>
                  <Typography>{user.phone ?? copy.noPhone}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{copy.registeredAt}</Typography>
                  <Typography>
                    {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(user.registeredAt))}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
                  <Typography color="text.secondary">{copy.accountStatus}</Typography>
                  <Chip size="small" label={statusLabel} color={statusColor} />
                </Box>
                <Divider />
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LogoutRoundedIcon />}
                  onClick={logout}
                >
                  {copy.logout}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2.5 }}>
            <CardContent sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {copy.loggedOutTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {copy.loggedOutDescription}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "center" }}>
                <Button
                  component={Link}
                  href="/login?next=%2Fuser-status"
                  variant="contained"
                >
                  {copy.login}
                </Button>
                <Button component={Link} href="/register" variant="outlined">{copy.register}</Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
      <Footer />
    </div>
  );
}
