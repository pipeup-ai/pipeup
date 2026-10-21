import { setting } from "./settings";
export interface Theme {
  font: string;
  accent: string;
  dark: boolean;
  /** The text colour that reads on the accent: white, or near black on a pale accent. */
  on: string;
}

const FALLBACK_ACCENT = "#534AB7";
const FALLBACK_ACCENT_DARK = "#9A94EE";
const DEFAULT_LINK = "rgb(0, 0, 238)";

export function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(value);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: alpha };
}

let pixel: CanvasRenderingContext2D | null | undefined;
/**
 * Any CSS colour as red, green, blue and alpha. Computed colours come back as written: rgb(), but also oklch(),
 * color(srgb …) and color-mix() results on modern pages, which a one-pixel canvas reads for us.
 */
export function parseColour(
  value: string,
  doc: Document,
): { r: number; g: number; b: number; a: number } | null {
  const c = parseRgb(value);
  if (c || !value || value === "transparent") return c;
  try {
    pixel ??= doc.createElement("canvas").getContext("2d", { willReadFrequently: true }) ?? null;
    if (!pixel) return null;
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = "#000";
    pixel.fillStyle = value;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
    return { r: r!, g: g!, b: b!, a: a! / 255 };
  } catch {
    return null;
  }
}

export function luminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast between two luminances. */
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export type Look = "light" | "dark";

/** The look the author asked for with data-pipeup-theme="light|dark" (anywhere a setting goes, or <body>), if any. */
export function authorLook(doc: Document): Look | null {
  const v =
    (doc === document
      ? setting("data-pipeup-theme")
      : doc.documentElement.getAttribute("data-pipeup-theme")) ?? doc.body?.getAttribute("data-pipeup-theme");
  return v === "light" || v === "dark" ? v : null;
}

/** Where the page's background is sampled: down the right (where the column and panel sit) and the middle. */
const PROBES: [number, number][] = [
  [0.92, 0.25],
  [0.92, 0.6],
  [0.5, 0.45],
];
/** Mean background luminance below this is a dark page, above LIGHT_ABOVE a light one; between, no change. */
const DARK_BELOW = 0.18;
const LIGHT_ABOVE = 0.32;
/** The share of the window an area must fill to speak for the page. */
const BIG = 0.25;

/**
 * The colour the page's canvas is painted: <html>'s background, or else <body>'s (a body background spreads to the
 * whole canvas); with neither, the colour scheme decides (white, or black for a dark scheme).
 */
export function canvasPaint(doc: Document): { r: number; g: number; b: number } {
  const win = doc.defaultView;
  const html = doc.documentElement;
  const scheme = win?.getComputedStyle(html).colorScheme || "";
  const dark =
    /dark/.test(scheme) &&
    (!/light/.test(scheme) || win?.matchMedia?.("(prefers-color-scheme: dark)").matches === true);
  let paint = win ? parseColour(win.getComputedStyle(html).backgroundColor, doc) : null;
  if (win && doc.body && (!paint || paint.a < 0.5))
    paint = parseColour(win.getComputedStyle(doc.body).backgroundColor, doc);
  return paint && paint.a >= 0.5 ? paint : dark ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

/**
 * Whether the page is dark behind Pipeup. It samples the background actually painted behind the column and
 * panel (the first non-transparent one down the stack at a few points), not just <body>'s, so a page that dresses a
 * wrapper (or switches theme with a class on one) is read correctly. With nothing painted it asks the page's
 * `color-scheme`. A mean in the dead band keeps `was`, so a mid-grey page doesn't flip back and forth.
 */
export function pageIsDark(doc: Document, was = false): boolean {
  const win = doc.defaultView;
  if (!win) return false;
  const html = doc.documentElement;
  const canvas = luminance(canvasPaint(doc));
  const stackAt = (x: number, y: number): Element[] => {
    try {
      if (doc.elementsFromPoint) return doc.elementsFromPoint(x, y);
    } catch {
      /* fall through to the body and root */
    }
    return doc.body ? [doc.body, html] : [html];
  };
  let total = 0;
  for (const [fx, fy] of PROBES) {
    let lum = canvas;
    for (const el of stackAt(win.innerWidth * fx, win.innerHeight * fy)) {
      if (el.closest("[data-pipeup-ignore]")) continue;
      // A small coloured widget (a chart bar, a badge) says nothing about the page: only areas that fill a good part
      // of the window count.
      const box = el.getBoundingClientRect();
      if (box.width * box.height < BIG * win.innerWidth * win.innerHeight) continue;
      const c = parseColour(win.getComputedStyle(el).backgroundColor, doc);
      if (c && c.a >= 0.5) {
        lum = luminance(c);
        break;
      }
    }
    total += lum;
  }
  const mean = total / PROBES.length;
  return mean < DARK_BELOW ? true : mean > LIGHT_ABOVE ? false : was;
}

/** The page's font and accent colour, for a given look, so Pipeup reads as part of the page. */
export function readTheme(root: Element, look: Look): Theme {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const dark = look === "dark";
  if (!win) return { font: "system-ui, sans-serif", accent: FALLBACK_ACCENT, dark, on: "#fff" };
  const html = doc.documentElement;
  const font = win.getComputedStyle(root).fontFamily || "system-ui, sans-serif";
  const custom = (
    win.getComputedStyle(html).getPropertyValue("--pipeup-accent") ||
    html.style.getPropertyValue("--pipeup-accent")
  ).trim();
  const link = root.querySelector("a[href]");
  const linkColor = link ? win.getComputedStyle(link).color : "";
  const want = custom || (linkColor !== DEFAULT_LINK && linkColor);
  // The author's accent, or else the page's link colour, only when words in it read at 4.5 to 1 on the softly tinted
  // surface Pipeup lays under them (the palest it puts behind accent words): otherwise Pipeup's own.
  const c = want ? parseColour(want, doc) : null;
  const [sr, sg, sb] = dark ? [27, 27, 25] : [255, 255, 255];
  const readable =
    c &&
    contrast(
      luminance(c),
      luminance({ r: 0.12 * c.r + 0.88 * sr!, g: 0.12 * c.g + 0.88 * sg!, b: 0.12 * c.b + 0.88 * sb! }),
    ) >= 4.5;
  const accent = readable ? (want as string) : dark ? FALLBACK_ACCENT_DARK : FALLBACK_ACCENT;
  // Words on the accent: whichever of white and near black reads better.
  const rgb = parseColour(accent, doc);
  const on = rgb && luminance(rgb) > 0.19 ? "#111" : "#fff";
  return { font, accent, dark, on };
}

export function applyTheme(layer: HTMLElement, theme: Theme): void {
  layer.style.setProperty("--pu-font", theme.font);
  layer.style.setProperty("--pu-accent", theme.accent);
  layer.style.setProperty("--pu-on", theme.on);
  layer.classList.toggle("dark", theme.dark);
}
