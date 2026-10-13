import type { Anchor } from "../model/types";
import { isAnchor, LIMITS } from "../model/ops";
import { fingerprint, normalizeText } from "../util/encoding";
import { indexText, textOffset } from "./text";

const CONTEXT = 32;
const SNAPSHOT = 200;
const BLOCK = "p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,pre,figcaption,dt,dd,summary,caption";

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

export function markedAncestor(node: Node, root: Element): Element | null {
  for (let el = elementOf(node)?.closest("[data-pipeup-id]") ?? null; el;) {
    if (!root.contains(el)) return null;
    const id = el.getAttribute("data-pipeup-id") ?? "";
    if (id !== "" && id.length <= LIMITS.anchorId) return el;
    el = el.parentElement?.closest("[data-pipeup-id]") ?? null;
  }
  return null;
}

/** Slice, dropping a dangling surrogate half left at either end, so the string stays well-formed. */
function slice(s: string, from: number, to?: number): string {
  return s.slice(from, to).replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, "");
}

function pathTo(from: Element, to: Element): string {
  const path = cssPath(from, to);
  if (path.length > LIMITS.path)
    throw new Error(
      "pipeup: this element is nested too deeply to comment on — give a nearby container a data-pipeup-id",
    );
  return path;
}

function checked(anchor: Anchor): Anchor {
  if (!isAnchor(anchor)) throw new Error("pipeup: could not describe this place on the page");
  return anchor;
}

/** The paragraph-like block a node sits in; its text is what "has this changed?" is judged on. */
export function blockOf(node: Node, root: Element): Element {
  const el = elementOf(node);
  const found = el?.closest(BLOCK) ?? null;
  if (found && root.contains(found)) return found;
  return el && root.contains(el) ? el : root;
}

/** A CSS path from `from` to its descendant `to`, usable as from.querySelector(path). '' when they're equal. */
export function cssPath(from: Element, to: Element): string {
  if (from === to) return "";
  const parts: string[] = [];
  for (let el: Element | null = to; el && el !== from; el = el.parentElement) {
    let i = 1;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling)
      if (s.tagName === el.tagName) i++;
    parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${i})`);
  }
  return ":scope > " + parts.join(" > ");
}

export function describeRange(range: Range, root: Element, view?: Record<string, string>): Anchor {
  if (!root.contains(range.commonAncestorContainer))
    throw new Error("pipeup: the selection is outside the commentable area");
  const marked = markedAncestor(range.commonAncestorContainer, root);
  const base = marked ?? root;
  const { text } = indexText(base);
  const start = textOffset(base, range.startContainer, range.startOffset);
  const end = textOffset(base, range.endContainer, range.endOffset);
  const exact = text.slice(start, end);
  if (exact === "") throw new Error("pipeup: select some text to comment on");
  if (exact.length > LIMITS.quote)
    throw new Error(`pipeup: selections are limited to ${LIMITS.quote} characters`);
  const prefix = slice(text, Math.max(0, start - CONTEXT), start);
  const suffix = slice(text, end, end + CONTEXT);
  return checked({
    ...(marked ? { id: marked.getAttribute("data-pipeup-id") ?? "" } : {}),
    path: "",
    quote: { exact, prefix, suffix },
    ...(view ? { view } : {}),
    fingerprint: fingerprint(blockOf(range.startContainer, root).textContent ?? ""),
    snapshot: slice(normalizeText(prefix + exact + suffix), 0, SNAPSHOT),
  });
}

export function describeElement(
  el: Element,
  root: Element,
  point?: { x: number; y: number },
  view?: Record<string, string>,
): Anchor {
  const marked = markedAncestor(el, root);
  return checked({
    ...(marked ? { id: marked.getAttribute("data-pipeup-id") ?? "" } : {}),
    path: pathTo(marked ?? root, el),
    ...(point ? { point: { x: clamp01(point.x), y: clamp01(point.y) } } : {}),
    ...(view ? { view } : {}),
    fingerprint: fingerprint(el.textContent ?? ""),
    snapshot: slice(normalizeText(el.textContent ?? ""), 0, SNAPSHOT),
  });
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
