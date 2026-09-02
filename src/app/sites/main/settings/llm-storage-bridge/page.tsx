"use client";

import { useEffect } from "react";
import { LLM_MODELS_STORAGE_KEY, LLM_PROFILES_STORAGE_KEY } from "@shared/libs/llm";

function baseHost(hostname: string) {
  const parts = hostname.split(".");
  return ["main", "blog", "tool"].includes(parts[0]) ? parts.slice(1).join(".") : hostname;
}

export default function LlmStorageBridgePage() {
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.type !== "jadren:llm-config-request" || !event.source) return;
      try {
        const sender = new URL(event.origin);
        if (sender.protocol !== window.location.protocol || baseHost(sender.hostname) !== baseHost(window.location.hostname)) return;
        const profiles = JSON.parse(localStorage.getItem(LLM_PROFILES_STORAGE_KEY) || "[]");
        const models = JSON.parse(localStorage.getItem(LLM_MODELS_STORAGE_KEY) || "[]");
        (event.source as Window).postMessage({ type: "jadren:llm-config-response", requestId: event.data.requestId, profiles, models }, event.origin);
      } catch { /* Reject malformed origins or local data. */ }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return null;
}
