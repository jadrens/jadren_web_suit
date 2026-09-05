"use client";

import { RefObject, useEffect, useRef, useState } from "react";

/** Collapse a navigation row when its actual content no longer fits. */
export function useResponsiveNav(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
) {
  const [collapsed, setCollapsed] = useState(false);
  const requiredWidth = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const update = () => {
      requiredWidth.current = Math.max(requiredWidth.current, content.scrollWidth);
      setCollapsed(container.clientWidth < requiredWidth.current + 16);
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(content);
    document.fonts?.ready.then(update).catch(() => undefined);
    update();
    return () => observer.disconnect();
  }, [containerRef, contentRef]);

  return collapsed;
}
