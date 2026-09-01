"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@shared/theme/ThemeProvider";

interface VditorEditorProps {
  value: string;
  locale: "en" | "zh";
  onChange: (value: string) => void;
}

export default function VditorEditor({
  value,
  locale,
  onChange,
}: VditorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<import("vditor").default | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const { theme } = useTheme();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value, true);
    }
  }, [value]);

  useEffect(() => {
    let cancelled = false;

    void import("vditor").then(({ default: Vditor }) => {
      if (cancelled || !containerRef.current) return;
      const editor = new Vditor(containerRef.current, {
        value: valueRef.current,
        mode: "wysiwyg",
        height: "100%",
        minHeight: 480,
        lang: locale === "zh" ? "zh_CN" : "en_US",
        theme: theme === "dark" ? "dark" : "classic",
        cache: { enable: false },
        counter: { enable: true, type: "markdown" },
        resize: { enable: false },
        toolbarConfig: { pin: true },
        toolbar: [
          "headings",
          "bold",
          "italic",
          "strike",
          "|",
          "list",
          "ordered-list",
          "check",
          "quote",
          "code",
          "inline-code",
          "link",
          "table",
          "|",
          "undo",
          "redo",
          "|",
          "edit-mode",
          "fullscreen",
        ],
        preview: {
          mode: "editor",
          delay: 300,
          theme: { current: theme === "dark" ? "dark" : "light" },
        },
        input: (markdown) => {
          valueRef.current = markdown;
          onChangeRef.current(markdown);
        },
        after: () => {
          editorRef.current = editor;
          editor.setTheme(
            theme === "dark" ? "dark" : "classic",
            theme === "dark" ? "dark" : "light"
          );
        },
      });
    });

    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [locale, theme]);

  return (
    <Box
      ref={containerRef}
      sx={{
        height: { xs: 560, lg: "clamp(560px, calc(100dvh - 310px), 800px)" },
        minWidth: 0,
        "& .vditor": { height: "100% !important", borderColor: "divider" },
        "& .vditor-toolbar": { borderColor: "divider" },
        "html[data-theme='dark'] & .vditor-wysiwyg pre > code, html[data-theme='dark'] & .vditor-ir pre > code": {
          backgroundColor: "#161b22 !important",
          backgroundImage: "none !important",
          color: "#d4d4d4 !important",
          border: "1px solid #30363d",
        },
        "html[data-theme='dark'] & .vditor-wysiwyg__block, html[data-theme='dark'] & .vditor-ir__node--expand": {
          backgroundColor: "transparent !important",
        },
        "html[data-theme='dark'] & .hljs": {
          backgroundColor: "#161b22 !important",
          color: "#d4d4d4 !important",
        },
        "html[data-theme='dark'] & .hljs-keyword, html[data-theme='dark'] & .hljs-selector-tag, html[data-theme='dark'] & .hljs-literal": {
          color: "#569cd6 !important",
        },
        "html[data-theme='dark'] & .hljs-string, html[data-theme='dark'] & .hljs-attr, html[data-theme='dark'] & .hljs-template-variable": {
          color: "#ce9178 !important",
        },
        "html[data-theme='dark'] & .hljs-number, html[data-theme='dark'] & .hljs-symbol, html[data-theme='dark'] & .hljs-bullet": {
          color: "#b5cea8 !important",
        },
        "html[data-theme='dark'] & .hljs-comment, html[data-theme='dark'] & .hljs-quote": {
          color: "#6a9955 !important",
        },
        "html[data-theme='dark'] & .hljs-title, html[data-theme='dark'] & .hljs-section, html[data-theme='dark'] & .hljs-function": {
          color: "#dcdcaa !important",
        },
        "html[data-theme='dark'] & .hljs-variable, html[data-theme='dark'] & .hljs-property, html[data-theme='dark'] & .hljs-params": {
          color: "#9cdcfe !important",
        },
        "html[data-theme='dark'] & .hljs-built_in, html[data-theme='dark'] & .hljs-type, html[data-theme='dark'] & .hljs-class": {
          color: "#4ec9b0 !important",
        },
      }}
    />
  );
}
