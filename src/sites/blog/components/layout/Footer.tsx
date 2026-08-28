"use client";

import { Box, Typography, Chip, Avatar } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import LinkIcon from "@mui/icons-material/Link";
import GitHubIcon from "@mui/icons-material/GitHub";
import BouncingAvatar from "./BouncingAvatar";
import { SITE_CONFIG } from "@blog/var/config";
import { CONTACT_CONFIG } from "@blog/var/contact";
import { useSiteUrl } from "@shared/site-url";

export default function Footer() {
  const year = new Date().getFullYear();
  const mainUrl = useSiteUrl("main");

  return (
    <>
      <Box
        component="footer"
        sx={{
          mt: "auto",
          py: 3,
          px: { xs: 4, sm: 3 },
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Avatar
          src="/shared/avatar.svg"
          alt="jadren"
          className="footer-avatar"
          sx={{ width: 48, height: 48, transition: "transform 0.2s", "&:hover": { transform: "scale(1.2)" } }}
        />
        <Typography variant="body2" color="text.secondary">
          &copy; {year} jadren
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
          {CONTACT_CONFIG.email.enabled && (
            <Chip
              icon={<EmailIcon sx={{ fontSize: 14 }} />}
              label={CONTACT_CONFIG.email.url}
              component="a"
              href={`mailto:${CONTACT_CONFIG.email.url}`}
              clickable
              size="small"
              variant="outlined"
              sx={{ p: 1.5 }}
            />
          )}
          <Chip
            icon={<LinkIcon sx={{ fontSize: 14 }} />}
            label="Back to Nav"
            component="a"
            href={mainUrl}
            clickable
            size="small"
            variant="outlined"
            sx={{ p: 1.5 }}
          />
          {SITE_CONFIG.githubClipEnabled && (
            <Chip
              icon={<GitHubIcon sx={{ fontSize: 14 }} />}
              label="GitHub"
              component="a"
              href={SITE_CONFIG.githubRepo}
              clickable
            size="small"
            variant="outlined"
            target="_blank"
            rel="noopener"
            sx={{ p: 1.5 }}
          />
          )}
        </Box>
      </Box>
    </Box>
    <BouncingAvatar />
    </>
  );
}
