import { canvasPaint, luminance, parseColour } from "./theme";

const NAMES = ["pipeup-quote", "pipeup-on", "pipeup-done"] as const;
/**
 * Each highlight's colour (r, g, b, alpha): under dark words on a light ground, then under light words on a dark one
 * (those take the same name with "-d"). A pale tint would wash light words out, so theirs is a deep amber that keeps
 * them at 4.5 to 1 or better on a dark band or a coloured button. Which one a passage gets follows its own words and
 * what is behind them, never the page's look or Pipeup's.
 */
const COLOURS: Record<(typeof NAMES)[number], [number[], number[]]> = {
  "pipeup-quote": [
    [250, 227, 188, 0.75],
    [180, 120, 0, 0.35],
  ],
  "pipeup-on": [
    [247, 212, 154, 0.95],
    [180, 120, 0, 0.5],
  ],
  "pipeup-done": [
    [180, 178, 169, 0.22],
    [140, 138, 130, 0.2],
  ],
};
/** The highlight rules at strength `k` (0 unseen, 1 full): showing and hiding comments fades them. */
const paintRules = (k: number) =>
  NAMES.map((n) =>
    COLOURS[n]
      .map(
        ([r, g, b, a], d) =>
          `::highlight(${n}${d ? "-d" : ""}){background-color:rgba(${r},${g},${b},${+(a! * k).toFixed(3)})}`,
      )
      .join(""),
  ).join("");

/**
 * Whether the words a range starts in are lighter than what is behind them (the first opaque background up from them,
 * or the page's canvas). Over a picture, the words' own lightness decides.
 */
export function lightWords(r: Range): boolean {
  const n = r.startContainer;
  const el = n instanceof Element ? n : n.parentElement;
  const win = el?.ownerDocument.defaultView;
  if (!el || !win) return false;
  const doc = el.ownerDocument;
  const words = luminance(parseColour(win.getComputedStyle(el).color, doc) ?? { r: 0, g: 0, b: 0 });
  for (let e: Element | null = el; e; e = e.parentElement) {
    const s = win.getComputedStyle(e);
    if (s.backgroundImage !== "none") return words > 0.4;
    const c = parseColour(s.backgroundColor, doc);
    if (c && c.a >= 0.5) return words > luminance(c);
  }
  return words > luminance(canvasPaint(doc));
}

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
}

/**
 * The picking cursor: an arrow (hotspot at its tip) over a dashed box, as in an element picker. The rule skips
 * ignored areas altogether, so they keep the page's own cursors; Pipeup's UI resets its own inside its shadow root.
 */
const PICK_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect x='7' y='7' width='23' height='23' rx='4' fill='none' stroke='#534AB7' stroke-width='2' stroke-dasharray='4 3'/><path d='M3 2v15l4-3.5 3 6.5 2.5-1.2-3-6.3H15z' fill='#fff' stroke='#2C2C2A' stroke-width='1.2' stroke-linejoin='round'/></svg>";
const PICKING = `:not([data-pipeup-ignore],[data-pipeup-ignore] *){cursor:url("data:image/svg+xml,${encodeURIComponent(PICK_SVG)}") 3 2,crosshair!important}`;

export interface PageSheet {
  /** Shows the picking cursor over the page while comment mode is on. */
  picking(on: boolean): void;
  /** Publishes --pipeup-gutter in px, for pages that reserve a gutter; null publishes nothing. */
  gutter(px: number | null): void;
  /** How strongly highlights are painted, 0 to 1. */
  fade(k: number): void;
  /**
   * Makes room for the All comments panel: a right margin of `px` on the page, easing in and out unless
   * `still`; 0 takes it away (the page eases back, then the rule goes). The width is also published as
   * --pipeup-panel, so a page's fixed elements can move clear of the panel too.
   */
  room(px: number, still: boolean): void;
  remove(): void;
}

/**
 * Pipeup's only styles on the page itself: text highlights (painted by the browser, so the page's DOM is
 * never touched), the picking cursor in comment mode, room for the open All comments panel (a right margin on
 * the page) and, on pages that ask for it, the gutter width. They live in a constructed stylesheet
 * adopted by the document — no <style> element is added and no inline style is written.
 */
export function installPageSheet(doc: Document = document): PageSheet {
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (!Sheet || !("replaceSync" in Sheet.prototype) || !("adoptedStyleSheets" in doc)) {
    return { gutter() {}, picking() {}, fade() {}, room() {}, remove: () => clearHighlights() };
  }
  const sheet = new Sheet();
  let current: number | null = null;
  let pick = false;
  let k = 1;
  // The panel's room: its margin, and the easing that stays a moment after it closes so the page eases back.
  let margin = 0;
  let ease = "";
  let easing = 0;
  const write = () =>
    sheet.replaceSync(
      paintRules(k) +
        (current === null ? "" : `:root{--pipeup-gutter:${current}px}`) +
        (pick ? PICKING : "") +
        (margin || ease
          ? `html{--pipeup-panel:${margin}px;${margin ? `margin-right:${margin}px!important;` : ""}${ease}}`
          : ""),
    );
  write();
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  return {
    gutter(px) {
      if (px === current) return;
      current = px;
      write();
    },
    picking(on) {
      if (on === pick) return;
      pick = on;
      write();
    },
    fade(to) {
      k = to;
      write();
    },
    room(px, still) {
      if (px === margin) return;
      margin = px;
      // Important too, so a page's own important transition on html can't make the room snap.
      ease = still ? "" : "transition:margin-right .34s cubic-bezier(.4,0,.2,1)!important";
      clearTimeout(easing);
      if (!px && ease)
        easing = window.setTimeout(() => {
          ease = "";
          write();
        }, 400);
      write();
    },
    remove() {
      clearTimeout(easing);
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
      clearHighlights();
    },
  };
}

/** Paints each group of ranges; `light` says which are light words on a dark ground. */
export function paintHighlights(
  g: { quote: Range[]; on: Range[]; done: Range[] },
  light: (r: Range) => boolean,
): void {
  if (!highlightsSupported()) return;
  for (const n of NAMES) {
    const all = g[n.slice(7) as keyof typeof g];
    CSS.highlights.set(n, new Highlight(...all.filter((r) => !light(r))));
    CSS.highlights.set(`${n}-d`, new Highlight(...all.filter(light)));
  }
}

export function clearHighlights(): void {
  if (!highlightsSupported()) return;
  for (const name of NAMES) for (const d of ["", "-d"]) CSS.highlights.delete(name + d);
}
