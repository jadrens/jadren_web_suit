import { TranslationKeys } from "./en";
import { editorCopy } from "@shared/i18n/editor";

export const zh: TranslationKeys = {
  nav: {
    home: "首页",
    posts: "文章",
    about: "关于",
    menu: "菜单",
    search: "搜索",
    settings: "设置",
    account: "用户中心",
  },
  blog: {
    views: "浏览",
    backToPosts: "文章",
    characters: "字数",
    editPage: "编辑页面",
    prevPost: "上一篇",
    nextPost: "下一篇",
    timeAgo: {
      year: "年",
      month: "月",
      day: "天",
      hour: "时",
      minute: "分",
      second: "秒",
      years: "年",
      months: "月",
      days: "天",
      hours: "时",
      minutes: "分",
      seconds: "秒",
      ago: "前",
    },
  },
  theme: {
    toggle: "切换主题",
  },
  home: {
    title: "jadren",
    description: "欢迎来到我的博客",
  },
  footer: {
    copyright: "版权所有",
    beian: "豫ICP备2023022865号",
  },
  toc: {
    contents: "目录",
    noHeadings: "暂无标题",
  },
  sidebar: {
    toggle: "切换文章侧边栏",
    allPosts: "所有文章",
  },
  blogPage: {
    posts: "文章",
    noPosts: "暂无文章，请添加 markdown 文件到 content/posts/",
    search: "搜索文章...",
    sortDesc: "最新优先",
    sortAsc: "最旧优先",
    filterByTag: "按标签筛选",
    clearFilters: "清除筛选",
    done: "完成",
    outline: "目录",
  },
  search: {
    title: "搜索",
    placeholder: "搜索文章...",
    noResults: "未找到结果",
    hint: "搜索 (⌘K)",
  },
  notFound: {
    message: "抱歉，您访问的页面不存在",
    backHome: "返回首页",
  },
  error: {
    400: "请求格式有问题",
    401: "需要登录才能访问",
    403: "没有权限访问此资源",
    404: "抱歉，您访问的页面不存在",
    408: "请求超时",
    429: "请求太频繁，请稍后再试",
    500: "服务器出了点问题",
    backHome: "返回首页",
    retry: "重试",
  },
  codeBlock: {
    copy: "复制",
    copied: "已复制！",
  },
  editor: editorCopy.zh,
};
