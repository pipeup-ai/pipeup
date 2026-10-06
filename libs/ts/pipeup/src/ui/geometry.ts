import type { Resolved } from "../anchor/resolve";
import type { Anchor } from "../model/types";
import type { AnchorPoint } from "./layout";

/** Where an element or pin comment's bubble sits (viewport coordinates). Text comments have no bubble. */
export function bubblePoint(a: Anchor, r: Resolved): { x: number; y: number } | null {
  if (r.state === "orphaned" || !r.element || a.quote) return null;
  const box = r.element.getBoundingClientRect();
  if (!box.width && !box.height) return null;
  if (a.point) return { x: box.left + a.point.x * box.width, y: box.top + a.point.y * box.height };
  const range = r.element.ownerDocument.createRange();
  range.selectNodeContents(r.element);
  const content = range.getBoundingClientRect();
  return {
    x: content.width ? Math.min(box.right - 8, content.right + 6) : box.right - 8,
    y: (content.height ? content.top : box.top) + 8,
  };
}

export function quoteRects(r: Resolved): DOMRect[] {
  return r.range ? [...r.range.getClientRects()] : [];
}

/** The top edge a column thread or draft aligns with (viewport y), or null when the content is gone. */
export function anchorTop(a: Anchor, r: Resolved): number | null {
  const first = quoteRects(r)[0];
  if (first) return first.top;
  if (r.state === "orphaned" || !r.element) return null;
  const box = r.element.getBoundingClientRect();
  return a.point ? box.top + a.point.y * box.height : box.top;
}

/** Where a preview or popover attaches: below the last quoted line, or beside the bubble or pin. */
export function popoverAnchor(a: Anchor, r: Resolved): AnchorPoint | null {
  const last = quoteRects(r).at(-1);
  if (last) return { x: last.left, y: last.bottom, below: true };
  const p = bubblePoint(a, r);
  return p ? { ...p, below: false } : null;
}

export function hit(
  x: number,
  y: number,
  rects: Iterable<{ left: number; top: number; right: number; bottom: number }>,
): boolean {
  for (const q of rects) if (x >= q.left && x <= q.right && y >= q.top && y <= q.bottom) return true;
  return false;
}
