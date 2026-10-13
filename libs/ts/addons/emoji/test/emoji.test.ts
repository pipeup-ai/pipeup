// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ALL, drawn, GROUP_NAMES, nameOf, search, TONES, withTone } from "../src/emoji";

describe("the emoji", () => {
  it("come in the groups phones use, with names", () => {
    expect(GROUP_NAMES).toEqual([
      "Smileys & emotion",
      "People & body",
      "Animals & nature",
      "Food & drink",
      "Travel & places",
      "Activities",
      "Objects",
      "Symbols",
      "Flags",
    ]);
    expect(ALL.length).toBeGreaterThan(1500);
    expect(ALL[0]).toMatchObject({ emoji: "😀", name: "grinning face", group: 0 });
  });

  it("are found by every word typed, in the name or the search words", () => {
    expect(search("rocket").map((e) => e.emoji)).toContain("🚀");
    expect(search("thumbs up").map((e) => e.emoji)).toContain("👍");
    expect(search("  ")).toEqual([]);
    expect(search("zzzzqq")).toEqual([]);
    // Every word must match.
    expect(search("rocket zzzzqq")).toEqual([]);
    expect(search("new zealand").map((e) => e.emoji)).toContain("🇳🇿");
  });

  it("take a skin tone only where one applies, right after the pictograph", () => {
    const wave = ALL.find((e) => e.name === "waving hand")!;
    expect(wave.tone).toBe(true);
    expect(withTone(wave, 0)).toBe(wave.emoji);
    expect(withTone(wave, 3)).toBe(`👋${TONES[3]}`);
    const heart = ALL.find((e) => e.emoji === "❤️")!;
    expect(heart.tone).toBe(false);
    expect(withTone(heart, 3)).toBe(heart.emoji);
  });

  it("are named for screen readers, with the skin tone said", () => {
    expect(nameOf("🚀")).toBe("rocket");
    expect(nameOf("❤️")).toBe("red heart");
    expect(nameOf(`👋${TONES[2]}`)).toBe("waving hand, medium-light skin tone");
    expect(nameOf("not an emoji")).toBeUndefined();
  });

  it("are all offered when there is nothing to measure with", () => {
    expect(drawn("👨‍👩‍👧‍👦")).toBe(true);
  });
});
