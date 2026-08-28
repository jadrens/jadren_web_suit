"use client";

import { useEffect, useRef } from "react";

export function useHeadingObserver(onHeadingChange: (id: string) => void) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headingsRef = useRef<Map<string, Element>>(new Map());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-heading-id");
            if (id) {
              onHeadingChange(id);
            }
          }
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0,
      }
    );

    const updateHeadings = () => {
      headingsRef.current.forEach((element) => {
        observerRef.current?.observe(element);
      });
    };

    setTimeout(updateHeadings, 100);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [onHeadingChange]);

  const registerHeading = (id: string, element: Element | null) => {
    if (element) {
      headingsRef.current.set(id, element);
      observerRef.current?.observe(element);
    }
  };

  return { registerHeading };
}