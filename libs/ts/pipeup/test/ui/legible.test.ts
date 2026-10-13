// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PAIRS, inspect, reading, warning } from "../../src/ui/legible";
import { STYLES } from "../../src/ui/styles";

const token = (selector: string, name: string) => {
  const i = STYLES.indexOf(`${selector}{`);
  return new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`).exec(STYLES.slice(i, STYLES.indexOf("}", i)))![1]!;
};

describe("the colours the self-check uses", () => {
  it("are the stylesheet's own words and surface in each look", () => {
    expect(PAIRS.light).toEqual([token(".layer", "k"), token(".layer", "su")]);
    expect(PAIRS.dark).toEqual([token(".layer.dark", "k"), token(".layer.dark", "su")]);
  });
});

describe("reading", () => {
  it("is the ordinary contrast when nothing fades the page", () => {
    expect(reading("light", 1, [255, 255, 255])).toBeGreaterThan(12);
    expect(reading("dark", 1, [0, 0, 0])).toBeGreaterThan(12);
  });

  it("drops as the page fades <html>, to about the same for either look", () => {
    expect(reading("light", 0.35, [255, 255, 255])).toBeLessThan(3);
    expect(reading("dark", 0.35, [0, 0, 0])).toBeLessThan(3);
    expect(Math.abs(reading("light", 0.35, [0, 0, 0]) - reading("dark", 0.35, [0, 0, 0]))).toBeLessThan(0.5);
  });
});

describe("inspect", () => {
  it("has nothing to say about a page that leaves <html> alone", () => {
    document.documentElement.removeAttribute("style");
    const a = inspect(document, "light", "page");
    expect(a).toMatchObject({ look: "light", effects: [] });
    expect(warning(a)).toBeNull();
  });

  it("lists a faded <html> and warns that Pipeup's words may be hard to read", () => {
    document.documentElement.style.opacity = "0.35";
    const a = inspect(document, "light", "author");
    expect(a.effects).toEqual(["opacity: 0.35"]);
    expect(a.ratio).toBeLessThan(3);
    expect(warning(a)).toContain("may be hard to read");
    document.documentElement.removeAttribute("style");
  });
});
