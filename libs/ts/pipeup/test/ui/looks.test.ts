import { describe, expect, it } from "vitest";
import { STYLES } from "../../src/ui/styles";
import { luminance } from "../../src/ui/theme";

/** The colour tokens of a look, read from the stylesheet itself so the test can't drift from it. */
const tokens = (selector: string): Record<string, string> => {
  const i = STYLES.indexOf(`${selector}{`);
  const body = STYLES.slice(i, STYLES.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/--([a-z]+):(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1]!, m[2]!]));
};
const rgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("each look reads on its own surfaces", () => {
  const light = tokens(".layer");
  const dark = { ...light, ...tokens(".layer.dark") };
  for (const [name, t] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    // Text colours: main, muted, faint. Surfaces: cards and panels (su), soft areas (so), hover (ho).
    for (const text of ["k", "mu", "fa"])
      for (const surface of ["su", "so", "ho"])
        it(`${name}: --${text} on --${surface} is at least 4.5 to 1`, () => {
          expect(ratio(t[text]!, t[surface]!)).toBeGreaterThanOrEqual(4.5);
        });
  }
});
