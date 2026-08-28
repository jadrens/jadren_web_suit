export interface ContactEntry {
  enabled: boolean;
  /** Display name */
  name: string;
  /** Icon type key — resolved via CONTACT_ICON_REGISTRY */
  icon: string;
  /** Brand / accent color. Use { dark, light } for theme-aware colors, or a plain string for both. */
  color: string | { dark: string; light: string };
  url: string;
  username: string;
  actions?: (toast: (message: string) => void) => React.ReactNode | void;
}

/** Resolve a ContactEntry color to the active theme mode. */
export function resolveContactColor(
  color: ContactEntry["color"],
  isDark: boolean,
): string {
  if (typeof color === "string") return color;
  return isDark ? color.dark : color.light;
}

export type ContactConfigItem = ContactEntry;

export const CONTACT_CONFIG: Record<string, ContactConfigItem> = {
  github: {
    enabled: true,
    name: "GitHub",
    icon: "github",
    url: "https://github.com/jadrens",
    username: "jadrens",
    color: { dark: "#f0f6fc", light: "#181717" },
  },
  youtube: {
    enabled: false,
    name: "YouTube",
    icon: "youtube",
    url: "https://www.youtube.com/@LoongRens",
    username: "@LoongRens",
    color: "#FF0000",
  },
  bilibili: {
    enabled: false,
    name: "Bilibili",
    icon: "bilibili",
    url: "https://space.bilibili.com/435996008",
    username: "jadren",
    color: "#00A1D6",
  },
  telegram: {
    enabled: true,
    name: "Telegram",
    icon: "telegram",
    url: "https://t.me/jadrens",
    username: "@jadrens",
    color: "#26A5E4",
  },
  email: {
    enabled: true,
    name: "Email",
    icon: "email",
    url: "jaden@jadren.moe",
    username: "",
    color: { dark: "#D44638", light: "#B23121" },
  },
  discord: {
    enabled: false,
    name: "Discord",
    icon: "discord",
    url: "",
    username: "",
    color: "#5865F2",
  },
  x: {
    enabled: false,
    name: "X",
    icon: "x",
    url: "",
    username: "",
    color: { dark: "#ffffff", light: "#000000" },
  },
  twitch: {
    enabled: false,
    name: "Twitch",
    icon: "twitch",
    url: "",
    username: "",
    color: "#9146FF",
  },
  facebook: {
    enabled: false,
    name: "Facebook",
    icon: "facebook",
    url: "",
    username: "",
    color: "#1877F2",
  },
  instagram: {
    enabled: false,
    name: "Instagram",
    icon: "instagram",
    url: "",
    username: "",
    color: "#E4405F",
  },
  reddit: {
    enabled: false,
    name: "Reddit",
    icon: "reddit",
    url: "",
    username: "",
    color: "#FF4500",
  },
  gitlab: {
    enabled: false,
    name: "GitLab",
    icon: "gitlab",
    url: "",
    username: "",
    color: "#FC6D26",
  },
  whatsapp: {
    enabled: false,
    name: "WhatsApp",
    icon: "whatsapp",
    url: "",
    username: "",
    color: "#25D366",
  },
  qq: {
    enabled: true,
    name: "QQ",
    icon: "qq",
    url: "https://qm.qq.com/q/UsebOGxquY",
    username: "Caliconix",
    color: "#12B7F5",
  },
  wechat: {
    enabled: true,
    name: "WeChat",
    icon: "wechat",
    url: "#",
    actions: (toast) => {
      toast("id: JadRens");
    },
    username: "Caliconix",
    color: "#07C160",
  },
  dingtalk: {
    enabled: false,
    name: "DingTalk",
    icon: "dingtalk",
    url: "",
    username: "",
    color: "#0089FF",
  },
} as const;
