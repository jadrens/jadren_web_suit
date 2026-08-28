import React from "react";
import { tokenizeShell, type ShellTokenType } from "./tokenizers/shell";

interface ShellHighlighterProps {
  code: string;
  isDark: boolean;
}

const colors: Record<ShellTokenType, { light: string; dark: string }> = {
  comment: { light: "#6a737d", dark: "#6a9955" },
  string: { light: "#032f62", dark: "#ce9178" },
  variable: { light: "#e36209", dark: "#9cdcfe" },
  option: { light: "#6f42c1", dark: "#c586c0" },
  command: { light: "#005cc5", dark: "#dcdcaa" },
  keyword: { light: "#d73a49", dark: "#569cd6" },
  operator: { light: "#d73a49", dark: "#d4d4d4" },
  number: { light: "#005cc5", dark: "#b5cea8" },
  permission: { light: "#22863a", dark: "#4ec9b0" },
  timestamp: { light: "#6f42c1", dark: "#c586c0" },
  date: { light: "#6f42c1", dark: "#c586c0" },
  path: { light: "#032f62", dark: "#ce9178" },
  prompt: { light: "#22863a", dark: "#4ec9b0" },
  status: { light: "#b31d28", dark: "#f44747" },
  plain: { light: "#24292e", dark: "#d4d4d4" },
};

export default function ShellHighlighter({ code, isDark }: ShellHighlighterProps) {
  return (
    <>
      {tokenizeShell(code).map((token, index) => (
        <span key={index} style={{ color: colors[token.type][isDark ? "dark" : "light"] }}>
          {token.text}
        </span>
      ))}
    </>
  );
}
