import { describe, expect, it } from "vitest";
import { approxFind, levenshtein } from "../src/anchor/fuzzy";

describe("fuzzy search", () => {
  it("computes edit distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("finds the closest substring within the allowed distance", () => {
    const text = "We plan to target a 25% lift in week-one retention next quarter.";
    const hit = approxFind(text, "targeting a 20% lift in week-one retention", 10);
    expect(hit).not.toBeNull();
    expect(text.slice(hit!.start, hit!.end)).toBe("target a 25% lift in week-one retention");
    expect(hit!.distance).toBeLessThanOrEqual(10);
  });

  it("returns null when nothing is close enough", () => {
    expect(approxFind("completely different words", "targeting a 20% lift", 3)).toBeNull();
    expect(approxFind("anything", "", 3)).toBeNull();
  });
});
