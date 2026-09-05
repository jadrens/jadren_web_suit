"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Button,
} from "@mui/material";
import LaunchIcon from "@mui/icons-material/Launch";
import { motion } from "framer-motion";

export interface PortalCardProps {
  href: string;
  delay: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  visitLabel: string;
}

export default function PortalCard({
  href,
  delay,
  icon,
  title,
  description,
  features,
  visitLabel,
}: PortalCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      style={{ width: "100%" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Card
        component={Link}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          width: "100%",
          textDecoration: "none",
          borderRadius: 3,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          transition: "transform 0.3s ease, box-shadow 0.3s ease",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          boxShadow: hovered
            ? "0 12px 40px rgba(0,0,0,0.15)"
            : "0 2px 8px rgba(0,0,0,0.06)",
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {icon}
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
              {title}
            </Typography>
            <LaunchIcon
              sx={{
                fontSize: 18,
                color: "text.secondary",
                ml: "auto",
                transition: "transform 0.2s ease",
                transform: hovered ? "translate(2px, -2px)" : "none",
              }}
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {description}
          </Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {features.map((feat) => (
              <Chip
                key={feat}
                label={feat}
                size="small"
                sx={{
                  fontSize: "0.75rem",
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  borderRadius: 1,
                }}
              />
            ))}
          </Box>

          <Button
            variant="outlined"
            size="small"
            endIcon={<LaunchIcon />}
            sx={{
              mt: 0.5,
              alignSelf: "flex-start",
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            {visitLabel}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
