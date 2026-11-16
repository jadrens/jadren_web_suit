import { GITHUB_REPO_URL } from "@lib/github";

export const SITE_CONFIG = {
  baseUrl: "https://jadren.cn",
  siteName: "jadren",
  description: "A blog with markdown and LaTeX support",
  githubRepo: GITHUB_REPO_URL,
  githubClipEnabled: true,
  articleEditEnabled: true,
  // CN: posts carrying this tag are published on jadren.me only. jadren.cn shares the
  // same database, so every public read (page, list, search, sitemap) filters them out.
  hiddenPostTag: "global-only",
} as const;
