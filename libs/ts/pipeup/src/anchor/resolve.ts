import type { Anchor, TextQuote } from "../model/types";
import { fingerprint } from "../util/encoding";
import { candidates, kindOf, nameOf, headsOf, similarity, yOf } from "./clues";
import { blockOf } from "./describe";
import { approxFind } from "./fuzzy";
import { indexText, rangeFromOffsets, type TextIndex } from "./text";

export type AnchorState = "attached" | "moved" | "orphaned";

export interface Resolved {
  state: AnchorState;
  element: Element | null;
  range: Range | null;
  /** Found by looking alike rather than by its words or its place: someone should say whether it's right. */
  alike?: boolean;
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
  if (anchor.lost) return ORPHANED;
  const base = anchor.id ? findMarked(root, anchor.id) : root;
  return anchor.quote
    ? resolveQuote(anchor, anchor.quote, base, root, options.fuzzy !== false)
    : resolveElement(anchor, base, root, options.fuzzy !== false);
}

/** The element at the anchor's path, or null. */
function atPath(anchor: Anchor, base: Element): Element | null {
  if (!anchor.path) return base;
  if (!anchor.path.startsWith(SCOPE_PREFIX)) return null;
  try {
    return base.querySelector(anchor.path);
  } catch {
    return null;
  }
}

function resolveElement(anchor: Anchor, base: Element | null, root: Element, search: boolean): Resolved {
  if (!base) return ORPHANED;
  const el = atPath(anchor, base);
  if (el && fingerprint(el.textContent ?? "") === anchor.fingerprint)
    return { state: "attached", element: el, range: null };
  // The thing marked by the author, or the whole area: nothing to look for beyond it.
  if (!anchor.path) return el ? { state: "moved", element: el, range: null } : ORPHANED;
  const kind = anchor.kind ?? (el ? kindOf(el) : null);
  // The look-alike search waits for the quieter second pass; until then the comment is pending, not shown as lost.
  if (!kind || !search) return ORPHANED;
  const { best, sure } = lookAlike(anchor, kind, base, root, el);
  // Nothing is clearly best, but the thing at the old place still matches best of all: it was edited, as before.
  const found = sure ? best : best && best === el ? el : null;
  if (!found) return ORPHANED;
  return found === el
    ? { state: "moved", element: el, range: null }
    : { state: "moved", element: found, range: null, alike: true };
}

/** A best match must score at least this, and beat the next best by the margin, or nothing is guessed. */
const SURE = 0.6;
const MARGIN = 0.15;
/** How far up or down the page (as a share of it) a look-alike may be and still count as in the same place. */
const NEAR = 0.15;

/**
 * The one element of the anchor's kind that matches its clues clearly best: its words, its name, the headings it sits
 * under and where it was. The element at the old path is just one candidate. `sure` when it is clearly best.
 */
function lookAlike(
  anchor: Anchor,
  kind: NonNullable<Anchor["kind"]>,
  base: Element,
  root: Element,
  old: Element | null,
): { best: Element | null; sure: boolean } {
  let best: Element | null = null;
  let top = -1;
  let next = -1;
  for (const el of candidates(base, kind)) {
    const score = alike(anchor, el, root, old);
    if (score > top) [best, top, next] = [el, score, top];
    else if (score > next) next = score;
  }
  return { best, sure: !!best && top >= SURE && top - next >= MARGIN };
}

/** How well `el` matches the anchor's clues, 0 to 1; clues the anchor doesn't have don't count either way. */
function alike(anchor: Anchor, el: Element, root: Element, old: Element | null): number {
  const text = el.textContent ?? "";
  const parts: [number, number][] = [
    // Squared, so siblings that share most of their words (prices, "a month") fall well behind the real match.
    [0.45, fingerprint(text) === anchor.fingerprint ? 1 : similarity(normalize(text), anchor.snapshot) ** 2],
  ];
  if (anchor.name !== undefined) parts.push([0.25, same(nameOf(el), anchor.name) ? 1 : 0]);
  if (anchor.heads?.length) parts.push([0.2, headsMatch(anchor.heads, headsOf(el, root))]);
  const y = anchor.y === undefined ? undefined : yOf(el, root);
  if (anchor.y !== undefined && y !== undefined)
    parts.push([0.1, Math.max(0, 1 - Math.abs(y - anchor.y) / NEAR)]);
  else if (anchor.y === undefined) parts.push([0.1, el === old ? 1 : 0]);
  let sum = 0;
  let weight = 0;
  for (const [w, v] of parts) {
    sum += w * v;
    weight += w;
  }
  return weight ? sum / weight : 0;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 200);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** 1 when the headings are the same, 0.6 when only the nearest one is, else 0. */
function headsMatch(was: string[], now: string[]): number {
  if (was.length === now.length && was.every((h, i) => same(h, now[i]!))) return 1;
  return now.length && same(was[was.length - 1]!, now[now.length - 1]!) ? 0.6 : 0;
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
