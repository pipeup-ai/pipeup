import type { Anchor } from "../model/types";
import { normalizeText } from "../util/encoding";
import type { Resolved } from "./resolve";

export interface Location {
  /** "Slide 3 "Title" › Q4 bar", "Section "Pricing" › Link · Start free trial", or why it's missing. */
  where: string;
  element: string | null;
  id: string | null;
  quote: string | null;
  pin: string | null;
}

const KIND: Record<string, string> = {
  A: "Link",
  BUTTON: "Button",
  P: "Paragraph",
  LI: "List item",
  IMG: "Image",
  TABLE: "Table",
  TD: "Cell",
  TH: "Cell",
  FIGURE: "Figure",
  SVG: "Graphic",
  CANVAS: "Graphic",
  LABEL: "Label",
  INPUT: "Field",
  SELECT: "Field",
  TEXTAREA: "Field",
  SUMMARY: "Question",
  BLOCKQUOTE: "Quote",
  SECTION: "Section",
  H1: "Heading",
  H2: "Heading",
  H3: "Heading",
  H4: "Heading",
  H5: "Heading",
  H6: "Heading",
};
/** Most characters of an element's own words in its label; longer words are cut short with an ellipsis. */
const SHORT = 40;

/** What kind of block `el` is ("Paragraph", "Heading", else "Block"), or the author's own name for it. */
export function kindOf(el: Element): string {
  return el.getAttribute("data-pipeup-label") || KIND[el.tagName.toUpperCase()] || "Block";
}

/** Its own words, cut short. innerText, where there is layout, keeps separate blocks apart ("Offline first Everything…"). */
export function wordsOf(el: Element): string {
  return clip(
    normalizeText(
      el.getAttribute("aria-label") ??
        el.getAttribute("alt") ??
        (el as HTMLElement).innerText ??
        el.textContent ??
        "",
    ),
    SHORT,
  );
}

/** "Paragraph · We will launch…": its kind and its own words, or the author's own name for it. */
export function labelOf(el: Element): string {
  const own = el.getAttribute("data-pipeup-label");
  if (own) return own;
  const text = wordsOf(el);
  return text ? `${kindOf(el)} · ${text}` : kindOf(el);
}

export function locate(anchor: Anchor, resolved: Resolved, root: Element): Location {
  const id = anchor.id ?? null;
  const quote = anchor.quote?.exact ?? null;
  const pin = anchor.point
    ? `${Math.round(anchor.point.x * 100)}% across, ${Math.round(anchor.point.y * 100)}% down the element`
    : null;
  const el = resolved.element;
  if (resolved.state === "orphaned" || !el) {
    return {
      where: `No longer on the page (it read: "${anchor.snapshot}")`,
      element: null,
      id,
      quote,
      pin,
    };
  }
  const parts: string[] = [];
  const slide = anchor.view?.slide;
  if (slide) {
    const title = el.closest("[data-pipeup-slide]")?.querySelector("h1,h2,h3")?.textContent;
    parts.push(`Slide ${slide}` + (title ? ` "${clip(normalizeText(title))}"` : ""));
  } else {
    // A view the page reported (a tab, a route) comes first, by its readable name.
    const view = viewName(anchor.view);
    if (view) parts.push(view);
    const heading = headingBefore(el, root);
    if (heading) parts.push(`Section "${clip(normalizeText(heading.textContent ?? ""))}"`);
  }
  const label = labelOf(el);
  parts.push(label);
  return { where: parts.join(" › "), element: label, id, quote, pin };
}

/** A view's readable name: its label, else its values joined with " · " (the slide left out); "" for none. */
export function viewName(view: Record<string, string> | undefined): string {
  if (!view) return "";
  return (
    view.label ||
    Object.entries(view)
      .filter(([k, v]) => v && k !== "slide")
      .map(([, v]) => v)
      .join(" · ")
  );
}

/** The last h1–h3 that comes before `el` in the page (not `el` itself or one containing it). */
function headingBefore(el: Element, root: Element): Element | null {
  let found: Element | null = null;
  for (const h of root.querySelectorAll("h1,h2,h3")) {
    if (h === el || h.contains(el)) break;
    if (h.compareDocumentPosition(el) & 4 /* FOLLOWING */) found = h;
    else break;
  }
  return found;
}

function clip(text: string, n = 60): string {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}
