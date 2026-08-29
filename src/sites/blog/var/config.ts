import { GITHUB_REPO_BRANCH, GITHUB_REPO_URL } from "@shared/github";

export const SITE_CONFIG = {
  baseUrl: "https://blog.jadren.me",
  siteName: "jadren blog",
  description: "A blog with markdown and LaTeX support",
  githubRepo: GITHUB_REPO_URL,
  githubBranch: GITHUB_REPO_BRANCH,
  githubClipEnabled: true,
  githubEditEnabled: true,
} as const;
