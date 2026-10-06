import type { Anchor, TextQuote } from "../model/types";
import { fingerprint } from "../util/encoding";
import { blockOf } from "./describe";
import { approxFind } from "./fuzzy";
import { indexText, rangeFromOffsets, type TextIndex } from "./text";

export type AnchorState = "attached" | "moved" | "orphaned";

export interface Resolved {
  state: AnchorState;
  element: Element | null;
  range: Range | null;
}

export interface ResolveOptions {
  /** Try approximate matching when exact text isn't found. Default true. */
  fuzzy?: boolean;
}

const ORPHANED: Resolved = { state: "orphaned", element: null, range: null };
/** Pages with more text than this skip approximate search, which is O(text × quote). */
const FUZZY_TEXT_LIMIT = 50_000;
const FUZZY_QUOTE_LIMIT = 300;
/** Shorter quotes match only exactly: a near match of a short quote exists almost anywhere. */
const FUZZY_MIN_QUOTE = 12;
const SCOPE_PREFIX = ":scope > ";

export function findMarked(root: Element, id: string): Element | null {
  for (const el of root.querySelectorAll("[data-pipeup-id]")) {
    if (el.getAttribute("data-pipeup-id") === id) return el;
  }
  return null;
}

export function resolveAnchor(anchor: Anchor, root: Element, options: ResolveOptions = {}): Resolved {
  const base = anchor.id ? findMarked(root, anchor.id) : root;
  return anchor.quote
    ? resolveQuote(anchor, anchor.quote, base, root, options.fuzzy !== false)
    : resolveElement(anchor, base);
}

function resolveElement(anchor: Anchor, base: Element | null): Resolved {
  if (!base) return ORPHANED;
  let el: Element | null = base;
  if (anchor.path) {
    if (!anchor.path.startsWith(SCOPE_PREFIX)) return ORPHANED;
    try {
      el = base.querySelector(anchor.path);
    } catch {
      return ORPHANED;
    }
  }
  if (!el) return ORPHANED;
  const unchanged = fingerprint(el.textContent ?? "") === anchor.fingerprint;
  return { state: unchanged ? "attached" : "moved", element: el, range: null };
}

function resolveQuote(
  anchor: Anchor,
  q: TextQuote,
  base: Element | null,
  root: Element,
  fuzzy: boolean,
): Resolved {
  const scope = base ?? root;
  const index = indexText(scope);
  const at = bestExact(index.text, q);
  if (at >= 0) {
    const range = rangeFromOffsets(index, at, at + q.exact.length);
    if (range) {
      const block = blockOf(range.startContainer, root);
      const unchanged = base !== null && fingerprint(block.textContent ?? "") === anchor.fingerprint;
      return { state: unchanged ? "attached" : "moved", element: block, range };
    }
  }
  if (fuzzy) {
    const whole: TextIndex = scope === root ? index : indexText(root);
    if (
      whole.text.length <= FUZZY_TEXT_LIMIT &&
      q.exact.length >= FUZZY_MIN_QUOTE &&
      q.exact.length <= FUZZY_QUOTE_LIMIT
    ) {
      const hit = approxFind(whole.text, q.exact, Math.floor(q.exact.length / 4));
      const range = hit ? rangeFromOffsets(whole, hit.start, hit.end) : null;
      if (range) return { state: "moved", element: blockOf(range.startContainer, root), range };
    }
  }
  return ORPHANED;
}

/** The exact occurrence whose surrounding text best matches the stored context, or -1. */
function bestExact(text: string, q: TextQuote): number {
  if (!q.exact) return -1;
  let best = -1;
  let bestScore = -1;
  for (let i = text.indexOf(q.exact); i !== -1; i = text.indexOf(q.exact, i + 1)) {
    const before = text.slice(Math.max(0, i - q.prefix.length), i);
    const after = text.slice(i + q.exact.length, i + q.exact.length + q.suffix.length);
    const score = commonSuffix(before, q.prefix) + commonPrefix(after, q.suffix);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
