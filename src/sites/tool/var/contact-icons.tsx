import { Box } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";
import RedditIcon from "@mui/icons-material/Reddit";
import {
  mdiYoutube,
  mdiTwitch,
  mdiInstagram,
  mdiFacebook,
  mdiQqchat,
  mdiWechat,
  mdiGitlab,
  mdiWhatsapp,
} from "@mdi/js";
import Icon from "@mdi/react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------

/**
 * CSS-mask-based icon loaded from `/icons/<name>-icon.svg`.
 * Uses `background-color: currentColor` so it inherits the parent's
 * CSS `color` — works correctly with theme-aware colors (dark/light).
 */
const SvgIcon = ({ name, size = 20 }: { name: string; size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      display: "block",
      backgroundColor: "currentColor",
      mask: `url(/shared/icons/${name}-icon.svg) no-repeat center / contain`,
      WebkitMask: `url(/shared/icons/${name}-icon.svg) no-repeat center / contain`,
    }}
  />
);

/** An `<img>`-based icon for multi-colour / gradient SVGs that can't be a mask. */
const ImgIcon = ({ name, size = 20 }: { name: string; size?: number }) => (
  <Box
    component="img"
    src={`/icons/${name}-icon.svg`}
    alt={name}
    sx={{ width: size, height: size, display: "block" }}
  />
);

/** An MDI icon rendered via `@mdi/react`. */
const MdiIcon = ({ path }: { path: string }) => <Icon path={path} size={1} />;

// ---------------------------------------------------------------------------
// Registry — maps icon type string → React component
// ---------------------------------------------------------------------------

export const CONTACT_ICON_REGISTRY: Record<string, () => ReactNode> = {
  email:    () => <EmailIcon sx={{ fontSize: 24 }} />,
  github:   () => <GitHubIcon sx={{ fontSize: 24 }} />,
  reddit:   () => <RedditIcon sx={{ fontSize: 24 }} />,

  // MDI icons
  youtube:   () => <MdiIcon path={mdiYoutube} />,
  twitch:    () => <MdiIcon path={mdiTwitch} />,
  facebook:  () => <MdiIcon path={mdiFacebook} />,
  instagram: () => <MdiIcon path={mdiInstagram} />,
  qq:        () => <MdiIcon path={mdiQqchat} />,
  wechat:    () => <MdiIcon path={mdiWechat} />,
  gitlab:    () => <MdiIcon path={mdiGitlab} />,
  whatsapp:  () => <MdiIcon path={mdiWhatsapp} />,

  // SVG-based icons (mask — inherits currentColor for theme support)
  discord:  () => <SvgIcon name="discord" />,
  telegram: () => <SvgIcon name="telegram" />,
  x:        () => <SvgIcon name="x" />,

  // SVG-based icons (img — keep original multi-colour / gradient)
  bilibili: () => <ImgIcon name="bilibili" />,
  dingtalk: () => <ImgIcon name="dingtalk" />,
};
