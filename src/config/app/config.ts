import { GITHUB_REPO_BRANCH, GITHUB_REPO_URL } from "@lib/github";

const SITE_CONFIG = {
  baseUrl: "https://jadren.cn",
  siteName: "jadren tools",
  description: "Useful online tools",
  githubRepo: GITHUB_REPO_URL,
  githubBranch: GITHUB_REPO_BRANCH,
  githubClipEnabled: true,
  githubEditEnabled: false,
  /** ICP filing number, shown in the footer as required for sites hosted in mainland China. */
  icpLicense: "豫ICP备2023022865号-4",
} as const;

export default SITE_CONFIG;
