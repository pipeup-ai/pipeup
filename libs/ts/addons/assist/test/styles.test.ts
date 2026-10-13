import { describe, expect, it } from "vitest";
import { CSS } from "../src/addon";

describe("the assist add-on's styles for core's parts", () => {
  it("use only the documented hooks, never core's class names", () => {
    const rules = CSS.split("\n").filter((l) => /data-pipeup-/.test(l));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/\.(av|ai|tx|ghost|it|rft)\b/);
  });

  it("stills the ring and the dots for reduced motion", () => {
    expect(CSS).toMatch(/prefers-reduced-motion:reduce\)\{[^}]*animation:none/);
  });
});
