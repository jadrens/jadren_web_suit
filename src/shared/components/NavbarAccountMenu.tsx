"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, Box, Button, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import { motion } from "framer-motion";
import { useAuth } from "@shared/libs/client-api/use-auth";

interface Props { homeHref: string; settingsHref: string; accountHref: string; homeLabel: string; settingsLabel: string; accountLabel: string }

export default function NavbarAccountMenu(props: Props) {
  const { isAuthenticated, user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const close = () => setAnchorEl(null);
  const trigger = { onClick: (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget), "aria-label": "Account menu", "aria-haspopup": "menu" as const, "aria-expanded": open };

  return <>
    {isAuthenticated && user ? <Button {...trigger} size="small" variant="outlined" title={user.nickname} sx={{ maxWidth: 140, minWidth: 40, height: 36, px: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "none" }}>{user.nickname}</Button> : <IconButton {...trigger} sx={{ width: 40, height: 40 }}><MoreHorizRoundedIcon /></IconButton>}
    <Menu anchorEl={anchorEl} open={open} onClose={close} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }} slotProps={{ paper: { sx: { mt: 0.75, minWidth: 185, borderRadius: 2.5, overflow: "hidden" } } }}>
      <motion.div initial={{ opacity: 0, y: -12, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 22 }}>
        <MenuItem component={Link} href={props.homeHref} onClick={close} sx={{ gap: 1.5, py: 1.25 }}><Avatar src="/shared/avatar.svg" alt="jadren" sx={{ width: 28, height: 28 }} /><Typography variant="body2" fontWeight={600}>{props.homeLabel}</Typography></MenuItem>
        <MenuItem component={Link} href={props.settingsHref} onClick={close} sx={{ gap: 1.5, py: 1.25 }}><SettingsRoundedIcon color="primary" sx={{ fontSize: 25, mx: 0.2 }} /><Typography variant="body2" fontWeight={600}>{props.settingsLabel}</Typography></MenuItem>
        {isAuthenticated && user && <MenuItem component={Link} href={props.accountHref} onClick={close} sx={{ gap: 1.5, py: 1.25 }}><ManageAccountsRoundedIcon color="primary" sx={{ fontSize: 25, mx: 0.2 }} /><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={600}>{props.accountLabel}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{user.nickname}</Typography></Box></MenuItem>}
      </motion.div>
    </Menu>
  </>;
}
