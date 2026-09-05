import { GITHUB_REPO_URL } from "@lib/github";

export const SITE_CONFIG = {
  baseUrl: "https://jadren.me",
  siteName: "jadren blog",
  description: "A blog with markdown and LaTeX support",
  githubRepo: GITHUB_REPO_URL,
  githubClipEnabled: true,
  articleEditEnabled: true,
} as const;
