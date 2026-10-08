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

export function luminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** WCAG contrast between two luminances. */
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The page's font, accent colour and light/dark appearance, so Pipeup reads as part of the page. */
export function readTheme(root: Element): Theme {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return { font: "system-ui, sans-serif", accent: FALLBACK_ACCENT, dark: false, on: "#fff" };
  const html = doc.documentElement;
  const font = win.getComputedStyle(root).fontFamily || "system-ui, sans-serif";
  const custom = (
    win.getComputedStyle(html).getPropertyValue("--pipeup-accent") ||
    html.style.getPropertyValue("--pipeup-accent")
  ).trim();
  const link = root.querySelector("a[href]");
  const linkColor = link ? win.getComputedStyle(link).color : "";
  let bg = parseRgb(win.getComputedStyle(doc.body).backgroundColor);
  if (!bg || bg.a === 0) bg = parseRgb(win.getComputedStyle(html).backgroundColor);
  const dark = Boolean(
    bg && bg.a > 0
      ? luminance(bg) < 0.2
      : win.matchMedia?.("(prefers-color-scheme: dark)").matches === true &&
          /dark/.test(win.getComputedStyle(html).colorScheme || ""),
  );
  // A link colour that can't be seen on Pipeup's own surface (the pale links of a dark page, say) is not used.
  const fromLink = linkColor && linkColor !== DEFAULT_LINK ? parseRgb(linkColor) : null;
  const seen = fromLink && contrast(luminance(fromLink), dark ? 0.011 : 1) >= 3;
  const accent = custom || (seen ? linkColor : dark ? FALLBACK_ACCENT_DARK : FALLBACK_ACCENT);
  const rgb = parseRgb(accent);
  const on = rgb && contrast(luminance(rgb), 1) < 3 ? "#111" : "#fff";
  return { font, accent, dark, on };
}

export function applyTheme(layer: HTMLElement, theme: Theme): void {
  layer.style.setProperty("--pu-font", theme.font);
  layer.style.setProperty("--pu-accent", theme.accent);
  layer.style.setProperty("--pu-on", theme.on);
  layer.classList.toggle("dark", theme.dark);
}
