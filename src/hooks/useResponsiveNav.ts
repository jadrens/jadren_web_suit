"use client";

import { RefObject, useLayoutEffect, useState } from "react";

/** Collapse a navigation row when its actual content no longer fits. */
export function useResponsiveNav(
  containerRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  leadingRef: RefObject<HTMLElement | null>,
) {
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const leading = leadingRef.current;
    if (!container || !content || !leading) return;
    let disposed = false;

    const update = () => {
      if (disposed) return;
      const style = getComputedStyle(container);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 0;
      // The desktop row stays mounted at its natural width, even while hidden.
      // Measure its siblings too, rather than remembering a past viewport width.
      const requiredWidth = content.scrollWidth + leading.getBoundingClientRect().width + gap + padding;
      setCollapsed(container.clientWidth < Math.ceil(requiredWidth));
    };

    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(content);
    observer.observe(leading);
    document.fonts?.ready.then(update).catch(() => undefined);
    update();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [containerRef, contentRef, leadingRef]);

  return collapsed;
}
