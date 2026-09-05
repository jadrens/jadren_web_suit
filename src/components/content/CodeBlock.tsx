"use client";

import React, { useState, useMemo } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useI18n } from "@lib/i18n/content";
import { mdiLanguageTypescript
, mdiLanguagePython
, mdiLanguageRust
, mdiLanguageGo
, mdiLanguageJava
, mdiLanguageC
, mdiLanguageCpp
, mdiLanguageJavascript
, mdiCodeTags,
mdiBash,
mdiLanguageHtml5,
mdiLanguageCss3,
mdiCodeJson,
 } from "@mdi/js"
import {Icon} from "@mdi/react"
import ShellHighlighter from "./ShellHighlighter";
import { useTheme } from "@theme/ThemeProvider";

interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
}

const languageColorsLight: Record<string, string> = {
  javascript: "#c49c08",
  js: "#c49c08",
  typescript: "#2565ae",
  ts: "#2565ae",
  python: "#2e6dad",
  py: "#2e6dad",
  bash: "#2e8c1c",
  sh: "#2e8c1c",
  shell: "#2e8c1c",
  zsh: "#2e8c1c",
  console: "#2e8c1c",
  terminal: "#2e8c1c",
  html: "#c23d1e",
  css: "#3d2666",
  json: "#444444",
  rust: "#b85c32",
  go: "#0095c2",
  java: "#8a4b1c",
  cpp: "#c93068",
  c: "#444444",
  nginx: "#2e8c1c",
  conf: "#2e8c1c",
};
const languageColorsDark: Record<string, string> = {
  javascript: "#f7df1e",
  js: "#f7df1e",
  typescript: "#3178c6",
  ts: "#3178c6",
  python: "#3572A5",
  py: "#3572A5",
  bash: "#4EAA25",
  sh: "#4EAA25",
  shell: "#4EAA25",
  zsh: "#4EAA25",
  console: "#4EAA25",
  terminal: "#4EAA25",
  html: "#e34c26",
  css: "#563d7c",
  json: "#bbbbbb",
  rust: "#dea584",
  go: "#00ADD8",
  java: "#b07219",
  cpp: "#f34b7d",
  c: "#cccccc",
  nginx: "#4EAA25",
  conf: "#4EAA25",
};

const languageIcons: Record<string, string> = {
  javascript: mdiLanguageJavascript,
  js: mdiLanguageJavascript,
  typescript: mdiLanguageTypescript,
  ts: mdiLanguageTypescript,
  python: mdiLanguagePython,
  py: mdiLanguagePython,
  bash: mdiBash,
  sh: mdiBash,
  shell: mdiBash,
  zsh: mdiBash,
  console: mdiBash,
  terminal: mdiBash,
  html: mdiLanguageHtml5,
  css: mdiLanguageCss3,
  json: mdiCodeJson,
  rust: mdiLanguageRust,
  go: mdiLanguageGo,
  java: mdiLanguageJava,
  cpp: mdiLanguageCpp,
  c: mdiLanguageC,
};

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { t } = useI18n();
  const language = className?.match(/(?:^|\s)language-([\w-]+)/)?.[1] || "";
  const iconColor = (isDark ? languageColorsDark[language] : languageColorsLight[language]) || (isDark ? "#808080" : "#6d6d6d");
  const isNginx = language === "nginx" || language === "conf";
  const LanguageIcon = isNginx ? (
    <Box
      component="img"
      src="/icons/nginx-icon.svg"
      alt="nginx"
      sx={{ width: "0.9rem", height: "0.9rem", display: "block" }}
    />
  ) : (
    <Icon
      path={languageIcons[language] || mdiCodeTags}
      size={0.6}
      color={iconColor}
      style={{ fontSize: "0.9rem" }}
    />
  );


  const codeText = useMemo(() => extractText(children), [children]);

  const highlightedChildren = useMemo(() => {
    const isShell = ["bash", "sh", "shell", "zsh", "console", "terminal"].includes(language);
    if (!isShell && language !== "nginx" && language !== "conf") return children;

    return React.Children.map(children, (child) => {
      if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === "code") {
        if (isShell) {
          return React.cloneElement(child, {
            children: <ShellHighlighter code={codeText} isDark={isDark} />,
          });
        }

        const tokens = tokenizeNginx(codeText);
          return React.cloneElement(child, {
            children: tokens.map((token, i) => (
            <span
              key={i}
              className={`code-token code-token-${token.type}`}
              style={{ color: getNginxTokenColor(token.type, isDark) }}
            >
              {token.text}
            </span>
          )),
        });
      }
      return child;
    });
  }, [children, language, codeText, isDark]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        "--code-bg": "#ffffff",
        "--code-header-bg": "#ebebeb",
        "--code-border": "#e0e0e0",
        "--code-muted": "#6d6d6d",
        "--code-text": "#24292e",
        "--code-keyword": "#d73a49",
        "--code-string": "#032f62",
        "--code-number": "#005cc5",
        "--code-comment": "#6a737d",
        "--code-function": "#6f42c1",
        "--code-class": "#22863a",
        "--code-variable": "#e36209",
        "--code-operator": "#005cc5",
        "--code-property": "#005cc5",
        "--code-builtin": "#22863a",
        "html[data-theme='dark'] &": {
          "--code-bg": "#1e1e1e",
          "--code-header-bg": "#252526",
          "--code-border": "#3c3c3c",
          "--code-muted": "#9a9a9a",
          "--code-text": "#d4d4d4",
          "--code-keyword": "#569cd6",
          "--code-string": "#ce9178",
          "--code-number": "#b5cea8",
          "--code-comment": "#6a9955",
          "--code-function": "#dcdcaa",
          "--code-class": "#4ec9b0",
          "--code-variable": "#9cdcfe",
          "--code-operator": "#d4d4d4",
          "--code-property": "#9cdcfe",
          "--code-builtin": "#4ec9b0",
        },
        mb: 2,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "var(--code-bg)",
        border: 1,
        borderColor: "var(--code-border)",
        "& .code-token": { color: "var(--code-text) !important" },
        "& .code-token-comment": { color: "var(--code-comment) !important" },
        "& .code-token-string, & .code-token-path": { color: "var(--code-string) !important" },
        "& .code-token-variable": { color: "var(--code-variable) !important" },
        "& .code-token-option": { color: "var(--code-function) !important" },
        "& .code-token-command": { color: "var(--code-function) !important" },
        "& .code-token-keyword": { color: "var(--code-keyword) !important" },
        "& .code-token-operator": { color: "var(--code-operator) !important" },
        "& .code-token-number": { color: "var(--code-number) !important" },
        "& .code-token-permission, & .code-token-prompt, & .code-token-directive": {
          color: "var(--code-builtin) !important",
        },
        "& .code-token-timestamp, & .code-token-date, & .code-token-block": {
          color: "var(--code-function) !important",
        },
        "& .code-token-status, & .code-token-boolean": { color: "var(--code-keyword) !important" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 1.5,
          py: 0.5,
          bgcolor: "var(--code-header-bg)",
          borderBottom: 1,
          borderColor: "var(--code-border)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {LanguageIcon}
          <Typography
            variant="caption"
            sx={{
              color: "var(--code-muted)",
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: "0.7rem",
            }}
          >
            {language || "code"}
          </Typography>
        </Box>
        <Tooltip title={copied ? t.codeBlock.copied : t.codeBlock.copy}>
          <IconButton
            onClick={handleCopy}
            size="small"
            sx={{
              color: "var(--code-muted)",
              p: 0.5,
              "&:hover": {
                color: isDark ? "#fff" : "#000",
                bgcolor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
              },
            }}
          >
            {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Tooltip>
      </Box>



      {/* code */}
      <Box
        sx={{
          display: "flex",
          overflow: "auto",
          maxHeight: "500px"
        }}
      >
        {/* line numbers */}
        {/* <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            textAlign: "right",
            userSelect: "none",
            bgcolor: isDark ? "#252526" : "#ebebeb",
            borderRight: 1,
            borderColor: isDark ? "#3c3c3c" : "#d5d5d5",
            py: 1.5,
            pr: 1.5,
            pl: 1.5,
            "& .line-number": {
              width: "0.6ch",
              p: 0,
              fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              color: isDark ? "#5a5a5a" : "#959595",
              minWidth: "0.8ch",
            },
          }}
        >
          {lines.map((_, i) => (
            <Box key={i} className="line-number">
              {i + 1}
            </Box>
          ))}
        </Box> */}

        {/* code */}
        <Box
          sx={{
            flex: 1,
            p: 1.5,
            pl: 2,
            py: 1.5,
            overflowX: "auto",
            "& .hljs": {
              m: 0,
              p: 0,
              bgcolor: "transparent",
              fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              color: "var(--code-text)",
              "& .hljs-keyword": { color: "var(--code-keyword)" },
              "& .hljs-string": { color: "var(--code-string)" },
              "& .hljs-number": { color: "var(--code-number)" },
              "& .hljs-comment": { color: "var(--code-comment)" },
              "& .hljs-function": { color: "var(--code-function)" },
              "& .hljs-class": { color: "var(--code-class)" },
              "& .hljs-variable": { color: "var(--code-variable)" },
              "& .hljs-operator": { color: "var(--code-operator)" },
              "& .hljs-punctuation": { color: "var(--code-text)" },
              "& .hljs-property": { color: "var(--code-property)" },
              "& .hljs-params": { color: "var(--code-text)" },
              "& .hljs-built_in": { color: "var(--code-builtin)" },
            },
          }}
        >
          {highlightedChildren}
        </Box>
      </Box>
    </Box>
  );
}

interface NginxToken {
  type: "comment" | "string" | "number" | "block" | "directive" | "variable" | "boolean" | "operator" | "plain";
  text: string;
}

function tokenizeNginx(code: string): NginxToken[] {
  const blockKeywords = new Set([
    "http", "server", "events", "stream", "location", "upstream",
    "mail", "types", "geo", "map", "limit_except", "if",
  ]);
  const directives = new Set([
    "listen", "server_name", "root", "index", "proxy_pass", "return",
    "rewrite", "ssl_certificate", "ssl_certificate_key", "include",
    "access_log", "error_log", "proxy_set_header", "proxy_redirect",
    "proxy_buffering", "proxy_read_timeout", "proxy_send_timeout",
    "resolver", "ssl_protocols", "ssl_ciphers", "ssl_prefer_server_ciphers",
    "proxy_ssl_server_name", "proxy_ssl_name", "proxy_ssl_protocols",
    "sub_filter", "sub_filter_once", "sub_filter_types", "proxy_cookie_domain",
    "proxy_buffer_size", "proxy_buffers", "proxy_busy_buffers_size",
    "proxy_http_version", "proxy_ssl_session_reuse", "resolver_timeout",
    "ssl_session_timeout", "ssl_session_cache", "add_header", "try_files",
    "fastcgi_pass", "uwsgi_pass", "gzip", "expires", "charset",
    "client_max_body_size", "worker_processes", "worker_connections",
    "sendfile", "tcp_nopush", "tcp_nodelay", "keepalive_timeout",
    "types_hash_max_size", "default_type", "log_format", "deny", "allow",
    "alias", "valid_referers", "break", "last", "permanent", "redirect",
  ]);
  const booleans = new Set(["on", "off"]);

  const tokens: NginxToken[] = [];
  let i = 0;

  while (i < code.length) {
    // 行注释
    if (code[i] === "#") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = code.length;
      tokens.push({ type: "comment", text: code.slice(i, end) });
      i = end;
      continue;
    }

    // 字符串
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j++;
        j++;
      }
      if (j < code.length) j++;
      tokens.push({ type: "string", text: code.slice(i, j) });
      i = j;
      continue;
    }

    // 数字
    if (/\d/.test(code[i])) {
      let j = i;
      while (j < code.length && /[\d.]/.test(code[j])) j++;
      tokens.push({ type: "number", text: code.slice(i, j) });
      i = j;
      continue;
    }

    // 变量
    if (code[i] === "$") {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      tokens.push({ type: "variable", text: code.slice(i, j) });
      i = j;
      continue;
    }

    // 标识符
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (blockKeywords.has(word)) {
        tokens.push({ type: "block", text: word });
      } else if (directives.has(word)) {
        tokens.push({ type: "directive", text: word });
      } else if (booleans.has(word)) {
        tokens.push({ type: "boolean", text: word });
      } else {
        tokens.push({ type: "plain", text: word });
      }
      i = j;
      continue;
    }

    // 操作符
    if (code[i] === "{" || code[i] === "}" || code[i] === ";") {
      tokens.push({ type: "operator", text: code[i] });
      i++;
      continue;
    }

    // 空白和其他字符作为 plain
    tokens.push({ type: "plain", text: code[i] });
    i++;
  }

  return tokens;
}

function getNginxTokenColor(type: NginxToken["type"], isDark: boolean): string {
  const colors: Record<NginxToken["type"], { light: string; dark: string }> = {
    comment: { light: "#6a737d", dark: "#6a9955" },
    string: { light: "#032f62", dark: "#ce9178" },
    number: { light: "#005cc5", dark: "#b5cea8" },
    block: { light: "#22863a", dark: "#4ec9b0" },
    directive: { light: "#d73a49", dark: "#569cd6" },
    variable: { light: "#e36209", dark: "#9cdcfe" },
    boolean: { light: "#6f42c1", dark: "#c586c0" },
    operator: { light: "#24292e", dark: "#d4d4d4" },
    plain: { light: "#24292e", dark: "#d4d4d4" },
  };
  return colors[type][isDark ? "dark" : "light"];
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children: React.ReactNode } }).props.children);
  }
  return "";
}
