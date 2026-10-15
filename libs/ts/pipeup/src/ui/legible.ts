import { canvasPaint, luminance, type Look } from "./theme";

/** Pipeup's own words and surface in each look, as in the stylesheet (a test keeps the two equal). */
export const PAIRS: Record<Look, [string, string]> = {
  light: ["#2C2C2A", "#FFFFFF"],
  dark: ["#ECEBE6", "#1B1B19"],
};

/** Below this, words are too hard to read. */
const MIN_RATIO = 3;
/** What a page can do to everything under <html>, Pipeup included, that Pipeup can't undo from inside. */
const EFFECTS: [string, string][] = [
  ["opacity", "1"],
  ["filter", "none"],
  ["backdrop-filter", "none"],
  ["mix-blend-mode", "normal"],
  ["transform", "none"],
  ["clip-path", "none"],
  ["mask-image", "none"],
  ["zoom", "1"],
];

export interface Appearance {
  /** The look Pipeup is showing. */
  look: Look;
  /** Who chose it: the reviewer (the Theme row), the author (data-pipeup-theme) or what the page shows. */
  source: "reviewer" | "author" | "page";
  /** Contrast of Pipeup's words on its own surface, as the page's styles leave it; 3 is the least that reads. */
  ratio: number;
  /** The page's styles on <html> that change everything under it, as "property: value". */
  effects: string[];
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ratioOf = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * How well Pipeup's words read in `look` when the page fades <html> to `opacity` over its canvas: both the words
 * and their surface are blended toward the canvas, which is what the eye gets.
 */
export function reading(look: Look, opacity: number, canvas: number[]): number {
  const [text, surface] = PAIRS[look].map((c) => {
    const [r, g, b] = hex(c).map((v, i) => opacity * v + (1 - opacity) * canvas[i]!);
    return luminance({ r: r!, g: g!, b: b! });
  });
  return ratioOf(text!, surface!);
}

/**
 * Looks at what the page's own styles on <html> do to Pipeup, which sits under it: how well Pipeup's words still read
 * when the page fades <html> over its canvas, and every other effect (filters, blending, transforms, zoom). Pipeup
 * can't undo any of them from inside, so it reports them; switching look wouldn't help, since fading costs both looks
 * about the same.
 */
export function inspect(doc: Document, look: Look, source: Appearance["source"]): Appearance {
  const css = doc.defaultView?.getComputedStyle(doc.documentElement);
  const effects = EFFECTS.flatMap(([prop, plain]) => {
    const v = css?.getPropertyValue(prop).trim();
    return v && v !== plain ? [`${prop}: ${v}`] : [];
  });
  const opacity = Math.min(1, Math.max(0, parseFloat(css?.opacity ?? "1") || 1));
  const { r, g, b } = canvasPaint(doc);
  return { look, source, ratio: reading(look, opacity, [r, g, b]), effects };
}

/** The line for the console when the page's styles change how Pipeup looks, or null when they don't. */
export function warning(a: Appearance): string | null {
  if (!a.effects.length && a.ratio >= MIN_RATIO) return null;
  return (
    `pipeup: the page's styles on <html> (${a.effects.join("; ") || "none"}) change how everything on the page looks, ` +
    `Pipeup included, and can't be undone from inside it. ` +
    (a.ratio < MIN_RATIO ? `Pipeup's words may be hard to read. ` : "") +
    `Move those styles to <body> or a wrapper.`
  );
}
