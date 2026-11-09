import type { Anchor, AnchorKind } from "../model/types";
import { LIMITS } from "../model/ops";
import { normalizeText } from "../util/encoding";

/** Where to look for each kind of thing, so a look-alike search only visits elements that could match. */
const KINDS: [AnchorKind, string][] = [
  ["h", "h1,h2,h3,h4,h5,h6,[role=heading]"],
  ["img", "img,svg,picture,canvas,[role=img]"],
  ["button", "button,[role=button],input[type=button],input[type=submit],input[type=reset]"],
  ["link", "a[href],[role=link]"],
  ["field", "input,select,textarea,[contenteditable=true]"],
  ["media", "video,audio,iframe,object,embed"],
  ["p", "p,li,blockquote,pre,dd,dt,figcaption,td,th,caption,summary"],
];
const HEADINGS = "h1,h2,h3,h4,h5,h6";
/** The most elements a look-alike search scores, so a huge page stays quick. */
const MAX_CANDIDATES = 2000;

export function kindOf(el: Element): AnchorKind {
  for (const [kind, sel] of KINDS) if (el.matches(sel)) return kind;
  return "box";
}

/** Elements of one kind under `base`, in page order. A box can be anything that isn't one of the other kinds. */
export function candidates(base: Element, kind: AnchorKind): Element[] {
  const sel = KINDS.find(([k]) => k === kind)?.[1] ?? "*";
  const out: Element[] = [];
  for (const el of base.querySelectorAll(sel)) {
    if (kindOf(el) !== kind) continue;
    out.push(el);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

const clip = (s: string, n: number) => normalizeText(s).slice(0, n);

/** A file's name from an address: what a picture or video is called when nothing else names it. */
function fileName(src: string): string {
  const path = src.split(/[?#]/)[0] ?? "";
  return path.slice(path.lastIndexOf("/") + 1);
}

/** What the thing is called: its label, a picture's description or file name, a link's address. "" when nothing. */
export function nameOf(el: Element): string {
  const own =
    el.getAttribute("aria-label") ||
    el.getAttribute("alt") ||
    el.getAttribute("title") ||
    ((el as HTMLInputElement).labels?.[0]?.textContent ?? "");
  if (own.trim()) return clip(own, LIMITS.name);
  const src = el.getAttribute("src");
  if (src) return clip(fileName(src), LIMITS.name);
  const href = el.getAttribute("href");
  if (href && !href.startsWith("javascript:")) return clip(href.split("#")[0] ?? "", LIMITS.name);
  return "";
}

/** The headings `node` sits under, outermost first, from the page's outline before it. */
export function headsOf(node: Node, root: Element): string[] {
  const stack: { level: number; text: string }[] = [];
  for (const h of root.querySelectorAll(HEADINGS)) {
    if (h === node || h.contains(node)) break;
    if (!(h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    const level = Number(h.tagName[1]);
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    const text = clip(h.textContent ?? "", LIMITS.head);
    if (text) stack.push({ level, text });
  }
  return stack.slice(-LIMITS.heads).map((s) => s.text);
}

/** Where `el` is down `root`, 0 to 1; undefined when the page has no layout to measure. */
export function yOf(el: Element, root: Element): number | undefined {
  const r = root.getBoundingClientRect();
  if (!(r.height > 0)) return undefined;
  const top = (el.getBoundingClientRect().top - r.top) / r.height;
  return Math.round(Math.min(1, Math.max(0, top)) * 1000) / 1000;
}

/** The clues kept with a comment on `el`, so a look-alike can be found when the page changes. */
export function cluesOf(el: Element, root: Element): Pick<Anchor, "kind" | "name" | "heads" | "y"> {
  const name = nameOf(el);
  const heads = headsOf(el, root);
  const y = yOf(el, root);
  return {
    kind: kindOf(el),
    ...(name ? { name } : {}),
    ...(heads.length ? { heads } : {}),
    ...(y !== undefined ? { y } : {}),
  };
}

/** Three-letter pieces of normalised text, for comparing words that were reworded. */
function trigrams(s: string): Map<string, number> {
  const t = ` ${s.toLowerCase()} `;
  const out = new Map<string, number>();
  for (let i = 0; i + 3 <= t.length; i++) {
    const g = t.slice(i, i + 3);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** How alike two texts are, 0 to 1 (Dice's coefficient on trigrams). */
export function similarity(a: string, b: string): number {
  if (!a || !b) return a === b ? 1 : 0;
  const x = trigrams(a);
  const y = trigrams(b);
  let both = 0;
  let total = 0;
  for (const n of x.values()) total += n;
  for (const n of y.values()) total += n;
  for (const [g, n] of x) both += Math.min(n, y.get(g) ?? 0);
  return total ? (2 * both) / total : 0;
}

// A list, not an object: the build shortens some property names ("box" among them).
const KIND_WORDS = new Map<AnchorKind, string>([
  ["h", "a heading"],
  ["p", "a paragraph"],
  ["img", "a picture"],
  ["button", "a button"],
  ["link", "a link"],
  ["field", "a field"],
  ["media", "a video"],
  ["box", "a box"],
]);

/** What a comment was on, in words: "it was a box under Pricing › Business". "" when it has no clues. */
export const wasOn = (a: Anchor): string =>
  a.kind
    ? `it was ${a.quote ? "in " : ""}${KIND_WORDS.get(a.kind)}${a.heads?.length ? ` under ${a.heads.join(" › ")}` : ""}`
    : "";
