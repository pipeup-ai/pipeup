import { describe, expect, it } from "vitest";
import { COLOURS } from "../../src/model/animals";
import { STYLES } from "../../src/ui/styles";

/** sRGB channels (0..1) of an hsl() colour. */
function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
const luminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const pct = (name: string, css: string) => Number(new RegExp(`--${name}:(\\d+)%`).exec(css)![1]) / 100;

/** Each colour's hue and saturation, and the fill and drawing lightness, as the stylesheet sets them. */
function pairs(
  dark: boolean,
): { name: string; fill: [number, number, number]; ink: [number, number, number] }[] {
  const av = /\.av\{(--av-l[^}]*)\}/.exec(STYLES)![1]!;
  const darkAv = /\.dark \.av\{([^}]*)\}/.exec(STYLES)![1]!;
  const base = /--s:(\d+)%/.exec(av);
  const fillL = pct("av-l", dark ? darkAv : av);
  const inkL = pct("av-d", dark ? darkAv : av);
  return COLOURS.map((name, i) => {
    const rule = new RegExp(`\\.c${i}\\{([^}]*)\\}`).exec(STYLES);
    expect(rule, `.c${i} for ${name}`).not.toBeNull();
    const h = Number(/--h:(\d+)/.exec(rule![1]!)![1]);
    const s = /--s:(\d+)%/.exec(rule![1]!)?.[1] ?? base![1]!;
    return { name, fill: hsl(h, Number(s) / 100, fillL), ink: hsl(h, Number(s) / 100, inkL) };
  });
}

describe("avatar colours", () => {
  it("has a pair for each of the ten colours, and no more", () => {
    expect(pairs(false)).toHaveLength(10);
    expect(/\.c10\{/.test(STYLES)).toBe(false);
  });

  it("draws every light pair with at least 3:1 contrast against its tint", () => {
    for (const p of pairs(false)) expect(contrast(p.fill, p.ink), p.name).toBeGreaterThanOrEqual(3);
  });

  it("draws every dark-page pair with at least 3:1 contrast too", () => {
    for (const p of pairs(true)) expect(contrast(p.fill, p.ink), p.name).toBeGreaterThanOrEqual(3);
  });

  it("gives the ten colours ten different tints", () => {
    const tints = new Set(pairs(false).map((p) => p.fill.map((c) => Math.round(c * 255)).join(",")));
    expect(tints.size).toBe(10);
  });
});
