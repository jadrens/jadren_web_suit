interface PositionedHeading {
  getBoundingClientRect(): { top: number };
  getAttribute(name: string): string | null;
}

/** Article headings are in document order; only inspect logarithmically many. */
export function findActiveHeading(headings: readonly PositionedHeading[], triggerPoint: number): string | null {
  let start = 0;
  let end = headings.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (headings[middle].getBoundingClientRect().top <= triggerPoint) start = middle + 1;
    else end = middle;
  }
  return start > 0 ? headings[start - 1].getAttribute("data-heading-id") : null;
}
