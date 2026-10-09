type Child = Node | string | null | undefined | false;

/** Creates an element. Children are nodes or plain text — strings are never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === "class") el.className = String(value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children)
    if (child !== null && child !== undefined && child !== false) el.append(child);
  return el;
}

/** Takes `el` out of (or back into) the keyboard's reach; focus never stays on something that goes inert. */
export function inert(el: HTMLElement, on: boolean): void {
  const active = (el.getRootNode() as Document | ShadowRoot).activeElement;
  if (on && active instanceof HTMLElement && el.contains(active)) active.blur();
  el.inert = on;
}

/** Puts `els` in this order before `ref` (at the end without one) in `parent`, moving only what is out of place and keeping focus; true when any moved. */
export function reorder(parent: Element, els: readonly Element[], ref: Node | null = null): boolean {
  const a = (parent.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
  let moved = false;
  for (let i = els.length; i--; ref = els[i]!)
    if (els[i]!.nextSibling !== ref) moved = !!parent.insertBefore(els[i]!, ref);
  if (moved && a && els.some((el) => el.contains(a))) a.focus({ preventScroll: true });
  return moved;
}

/** The page's selection when it holds words (not collapsed, not only spaces). */
export const selected = (): Selection | null => {
  const sel = window.getSelection();
  return sel && !sel.isCollapsed && sel.toString().trim() ? sel : null;
};

export function clip(text: string, n: number): string {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

/** Sizes a fixed overlay (outline, pulse, mark) to a box, with padding around it. */
export function fit(
  el: HTMLElement,
  r: { left: number; top: number; width: number; height: number },
  pad = 4,
): void {
  el.style.left = `${r.left - pad}px`;
  el.style.top = `${r.top - pad}px`;
  el.style.width = `${r.width + pad * 2}px`;
  el.style.height = `${r.height + pad * 2}px`;
}

const URLS = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING = ".,;:!?'\"]}";

/** Longest address considered; anything longer stays plain text. */
const MAX_URL = 2048;
/** Bidi controls can visually reorder an address, so an address containing one is not linked. */
const BIDI = /[\u202A-\u202E\u2066-\u2069]/;

/** Drops trailing punctuation, and a closing bracket the address didn't open, from a found address. One pass. */
function trimUrl(url: string): string {
  let open = 0;
  let close = 0;
  for (const c of url) {
    if (c === "(") open++;
    else if (c === ")") close++;
  }
  let end = url.length;
  while (end > 0) {
    const last = url[end - 1]!;
    if (last === ")" && close > open) close--;
    else if (TRAILING.includes(last)) {
      // A trailing bracket-like character is never "(" or ")", so the counts stay right.
    } else break;
    end--;
  }
  return url.slice(0, end);
}

/** The http(s) address of a reference line, or null (the same limits as any link). */
function address(raw: string): string | null {
  if (raw.length > MAX_URL || BIDI.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * An AI reply's words with its references: a line "[1]: https://..." names an address, and "[1]" in the words
 * becomes a link to it, so the reply stays short and shows no address. The reference lines themselves are not
 * shown. Only AI replies get this (a person's text only ever shows its addresses as they are).
 */
export function referenced(text: string): (Node | string)[] {
  const refs = new Map<string, string>();
  const body = text
    .split("\n")
    .filter((line) => {
      const m = /^\[(\d{1,2})\]:?\s+(\S+)$/.exec(line.trim());
      const href = m?.[2] ? address(m[2]) : null;
      if (m?.[1] && href) refs.set(m[1], href);
      return !(m?.[1] && href);
    })
    .join("\n")
    .trim();
  if (!refs.size) return linkify(text);
  const out: (Node | string)[] = [];
  body.split(/(\[\d{1,2}\])/).forEach((part) => {
    const href = refs.get(/^\[(\d{1,2})\]$/.exec(part)?.[1] ?? "");
    if (!href) return void out.push(...linkify(part));
    const a = h("a", { href, target: "_blank", rel: "noopener noreferrer", title: href }, part);
    a.addEventListener("click", (e) => e.stopPropagation());
    out.push(a);
  });
  return out;
}

/** Text with its http(s) addresses as links. Built from nodes: nothing is ever parsed as HTML. */
export function linkify(text: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  let from = 0;
  for (const m of text.matchAll(URLS)) {
    if (m[0].length > MAX_URL || BIDI.test(m[0])) continue;
    const url = trimUrl(m[0]);
    const at = m.index ?? 0;
    let href: string;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      href = u.href;
    } catch {
      continue;
    }
    if (at > from) out.push(text.slice(from, at));
    const a = h("a", { href, target: "_blank", rel: "noopener noreferrer" }, url);
    // A link opens the link only: it must not also open or close the thread, or reach the page's handlers.
    a.addEventListener("click", (e) => e.stopPropagation());
    out.push(a);
    from = at + url.length;
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}
