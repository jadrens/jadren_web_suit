import { editorCopy } from "@shared/i18n/editor";

export const en = {
  nav: {
    home: "Home",
    posts: "Posts",
    tools: "Tools",
    about: "About",
    menu: "Menu",
    search: "Search",
    settings: "Settings",
    account: "User center",
  },
  blog: {
    views: "views",
    backToPosts: "Posts",
    characters: "chars",
    editPage: "Edit page",
    prevPost: "Previous",
    nextPost: "Next",
    timeAgo: {
      year: "year",
      month: "month",
      day: "day",
      hour: "hour",
      minute: "minute",
      second: "second",
      years: "years",
      months: "months",
      days: "days",
      hours: "hours",
      minutes: "minutes",
      seconds: "seconds",
      ago: "ago",
    },
  },
  theme: {
    toggle: "Toggle theme",
  },
  home: {
    title: "jadren",
    description: "Welcome to my blog",
  },
  footer: {
    copyright: "All rights reserved",
    beian: "豫ICP备2023022865号",
  },
  toc: {
    contents: "Contents",
    noHeadings: "No headings found",
  },
  sidebar: {
    toggle: "Toggle posts sidebar",
    allPosts: "All Posts",
  },
  blogPage: {
    posts: "Posts",
    noPosts: "No posts yet. Add markdown files to content/posts/",
    search: "Search posts...",
    sortDesc: "Newest first",
    sortAsc: "Oldest first",
    filterByTag: "Filter by tag",
    clearFilters: "Clear filters",
    done: "Done",
    outline: "Outline",
  },
  search: {
    title: "Search",
    placeholder: "Search posts...",
    noResults: "No results found",
    hint: "Search (⌘K)",
  },
  notFound: {
    message: "Sorry, this page does not exist",
    backHome: "Back to home",
  },
  error: {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Sorry, this page does not exist",
    408: "Request Timeout",
    429: "Too Many Requests",
    500: "Internal Server Error",
    backHome: "Back to home",
    retry: "Retry",
  },
  codeBlock: {
    copy: "Copy",
    copied: "Copied!",
  },
  editor: editorCopy.en,
};

export type TranslationKeys = typeof en;
