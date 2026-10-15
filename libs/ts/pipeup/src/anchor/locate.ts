import type { Anchor } from "../model/types";
import { normalizeText } from "../util/encoding";
import type { Resolved } from "./resolve";

export interface Location {
  /** "Slide 3 "Title" › Q4 bar", "Section "Pricing" › Link · Start free trial", or why it's missing. */
  where: string;
  element: string | null;
  /** The data-pipeup-id of the element, or of the marked element it is in (`within`). */
  id: string | null;
  /** `id` names a marked element around this one (a slide, say), not this one. */
  within?: boolean;
  quote: string | null;
  pin: string | null;
}

/**
 * Kinds of block by tag (upper case), and by role or a field's type (lower case), which say better what a control is:
 * "Switch", not "Button".
 */
const KIND: Record<string, string> = {
  A: "Link",
  BUTTON: "Button",
  P: "Paragraph",
  LI: "List item",
  UL: "List",
  OL: "List",
  IMG: "Image",
  TABLE: "Table",
  TD: "Cell",
  TH: "Cell",
  FIGURE: "Figure",
  SVG: "Graphic",
  CANVAS: "Graphic",
  LABEL: "Label",
  INPUT: "Field",
  SELECT: "Dropdown",
  TEXTAREA: "Field",
  SUMMARY: "Disclosure",
  BLOCKQUOTE: "Quote",
  SECTION: "Section",
  ARTICLE: "Article",
  H1: "Heading",
  H2: "Heading",
  H3: "Heading",
  H4: "Heading",
  H5: "Heading",
  H6: "Heading",
  switch: "Switch",
  tab: "Tab",
  checkbox: "Checkbox",
  radio: "Radio button",
  button: "Button",
  submit: "Button",
  link: "Link",
};
/** Most characters of an element's own words in its label; longer words are cut short with an ellipsis. */
const SHORT = 40;

/**
 * What kind of block `el` is ("Paragraph", "Checkbox", "Switch"), or the author's own name for it. With no kind and
 * no words, a long thin shape is a "Bar" (a chart's, say) and any other a "Shape"; else it is a "Block".
 */
export function kindOf(el: Element): string {
  // A role is the page's own word: only the ones listed count (never "constructor" and the like).
  const role = el.getAttribute("role") ?? (el.tagName === "INPUT" ? (el as HTMLInputElement).type : "");
  const known =
    el.getAttribute("data-pipeup-label") ||
    (Object.hasOwn(KIND, role) && KIND[role]) ||
    KIND[el.tagName.toUpperCase()];
  if (known) return known;
  if (wordsOf(el)) return "Block";
  const r = el.getBoundingClientRect();
  const k = r.width / r.height;
  return k > 1.4 || k < 0.7 ? "Bar" : "Shape";
}

/** The words an element shows: innerText keeps separate blocks apart; content the page hides has only textContent. */
const shownText = (el: Element) => (el as HTMLElement).innerText || el.textContent || "";

/**
 * Its own words, cut short: its accessible name where it has one (a field's label, a dropdown's chosen option), else
 * what it shows ("Offline first Everything…"), the same whether or not the page is showing it.
 */
export function wordsOf(el: Element): string {
  const field = el as HTMLSelectElement & HTMLInputElement;
  const label = field.labels?.[0];
  return clip(
    normalizeText(
      el.getAttribute("aria-label") ??
        el.getAttribute("alt") ??
        (label && shownText(label)) ??
        (el.tagName === "SELECT" ? field.selectedOptions[0]?.text : null) ??
        (field.placeholder || shownText(el)),
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
    const title = el
      .closest("[data-pipeup-slide],.reveal .slides section")
      ?.querySelector(HEADINGS)?.textContent;
    parts.push(`Slide ${slide}` + (title ? ` "${clip(normalizeText(title))}"` : ""));
  } else {
    // A view the page reported (a tab, a route) comes first, by its readable name.
    const view = viewName(anchor.view);
    if (view) parts.push(view);
    const heading = headingOf(el, root);
    if (heading) parts.push(`Section "${clip(normalizeText(heading.textContent ?? ""))}"`);
  }
  const label = labelOf(el);
  parts.push(label);
  return {
    where: parts.join(" › "),
    element: label,
    id,
    within: !!id && el.getAttribute("data-pipeup-id") !== id,
    quote,
    pin,
  };
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

const HEADINGS = "h1,h2,h3";

/**
 * The heading of the section `el` is in: the nearest h1–h3 among the earlier siblings of `el` and of each block around
 * it, where the sibling is the heading or holds only it. Never a heading inside another card or tab panel, and never
 * a hidden one while `el` shows (one hidden with it still names its section).
 */
function headingOf(el: Element, root: Element): Element | null {
  const shows = (x: Element) => x.checkVisibility?.() !== false;
  const seen = shows(el);
  const words = (x: Element) => normalizeText(x.textContent ?? "");
  for (let n: Element | null = el; n && n !== root; n = n.parentElement)
    for (let s = n.previousElementSibling; s; s = s.previousElementSibling) {
      const h = s.matches(HEADINGS) ? s : [...s.querySelectorAll(HEADINGS)].pop();
      if (h && words(s) === words(h) && (!seen || shows(h))) return h;
    }
  return null;
}

function clip(text: string, n = 60): string {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}
