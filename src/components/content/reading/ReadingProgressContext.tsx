"use client";

import { createContext, useContext, useState, useMemo, useEffect, ReactNode } from "react";

import type { Heading } from "./headings";
export type { Heading } from "./headings";

interface ReadingHeadingsState {
  headings: Heading[];
  activeHeadingId: string | null;
}

interface ReadingProgressActions {
  setHeadings: (headings: Heading[]) => void;
  setActiveHeadingId: (id: string | null) => void;
  setReadingProgress: (progress: number) => void;
}

const ReadingHeadingsContext = createContext<ReadingHeadingsState | undefined>(undefined);
const ReadingProgressValueContext = createContext<number | undefined>(undefined);
const ReadingProgressActionsContext = createContext<ReadingProgressActions | undefined>(undefined);

export function ReadingProgressProvider({ children }: { children: ReactNode }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    if (activeHeadingId) {
      const newUrl = `${window.location.pathname}${window.location.search}#${encodeURIComponent(activeHeadingId)}`;
      window.history.replaceState(window.history.state, "", newUrl);
    }
  }, [activeHeadingId]);

  const headingState = useMemo(() => ({ headings, activeHeadingId }), [headings, activeHeadingId]);
  // Keep write-only consumers (the article and its scroll listener) independent
  // of progress updates so scrolling never reparses the Markdown tree.
  const actions = useMemo(() => ({ setHeadings, setActiveHeadingId, setReadingProgress }), []);

  return (
    <ReadingProgressActionsContext.Provider value={actions}>
      <ReadingHeadingsContext.Provider value={headingState}>
        <ReadingProgressValueContext.Provider value={readingProgress}>
          {children}
        </ReadingProgressValueContext.Provider>
      </ReadingHeadingsContext.Provider>
    </ReadingProgressActionsContext.Provider>
  );
}

function requireContext<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Reading progress hooks must be used within ReadingProgressProvider");
  }
  return value;
}

export function useReadingHeadings() {
  return requireContext(useContext(ReadingHeadingsContext));
}

export function useReadingProgressActions() {
  return requireContext(useContext(ReadingProgressActionsContext));
}

export function useReadingProgressValue() {
  return requireContext(useContext(ReadingProgressValueContext));
}

// Compatibility for consumers that intentionally need the entire state.
export function useReadingProgress() {
  return {
    ...useReadingHeadings(),
    ...useReadingProgressActions(),
    readingProgress: useReadingProgressValue(),
  };
}
