import { GITHUB_REPO_BRANCH, GITHUB_REPO_URL } from "@shared/github";

const SITE_CONFIG = {
  baseUrl: "https://jadren.me",
  siteName: "jadren tools",
  description: "Useful online tools",
  githubRepo: GITHUB_REPO_URL,
  githubBranch: GITHUB_REPO_BRANCH,
  githubClipEnabled: true,
  githubEditEnabled: false,
} as const;

export default SITE_CONFIG;
