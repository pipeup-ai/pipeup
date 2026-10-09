import { describe, expect, it } from "vitest";
import { decide, write, SHARED } from "../src/prompts";
import { clean, rank, replyPart, restates, scenarioOf, sections, usedOf, type Passage } from "../src/text";

describe("the model's words", () => {
  it("reads the one-word answer, and anything else is none", () => {
    expect(scenarioOf("ambiguity")).toBe("ambiguity");
    expect(scenarioOf('  "Related".')).toBe("related");
    expect(scenarioOf("Tone, because it sounds harsh")).toBe("tone");
    expect(scenarioOf("I think a reply would help")).toBe("none");
    expect(scenarioOf("")).toBe("none");
  });

  it("splits a reply from its Used line and strips formatting", () => {
    const raw = "Reply: **The Risks section** says pricing slips.\n- it is in `July`\nUsed: 2, 1, 2";
    expect(usedOf(raw)).toEqual([2, 1]);
    expect(replyPart(raw)).toBe("The Risks section says pricing slips. it is in July");
  });

  it("posts a short, plain reply and drops what shouldn't be posted", () => {
    const supplied = "Is that right? We launch in July with a 20% lift.";
    expect(clean("Do you mean the July date, or the 20% lift?", "Is that right?", supplied)).toBe(
      "Do you mean the July date, or the 20% lift?",
    );
    // an apology, a refusal, "none", an empty reply and a repeat of the comment
    for (const bad of ["Sorry, I can't help.", "As an AI I can't.", "NONE", "  ", "Is that right?"])
      expect(clean(bad, "Is that right?", supplied)).toBeNull();
    // a number the supplied text never mentioned
    expect(clean("It was 35% last year.", "Is that right?", supplied)).toBeNull();
  });

  it("cuts a long reply at a sentence, or drops it", () => {
    const sentence = "The Risks section says pricing slips with onboarding. ";
    const long = sentence.repeat(8);
    const out = clean(long, "Sure?", long)!;
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith(".")).toBe(true);
    expect(clean("x".repeat(400), "Sure?", "")).toBeNull();
  });
});

describe("a reply that only repeats", () => {
  const passage =
    "The team stays at six people through the end of the quarter. Hiring a second designer moves to Q4.";
  it("is spotted, and a reply that adds something is not", () => {
    expect(
      restates("It's planned for Q4 after the launch. The team is at six people until then.", passage),
    ).toBe(true);
    expect(restates("The Risks section says pricing slips if onboarding slips past July.", passage)).toBe(
      false,
    );
  });
});

describe("related passages", () => {
  const p = (label: string, text: string): Passage => ({ label, text });
  const doc = [
    p("Summary", "We launch the new onboarding flow in July, with a 20% lift in retention."),
    p("Risks", "If onboarding slips past July, the pricing work slips with it."),
    p("Team", "The team stays at six people through the end of the quarter."),
    p("Appendix", "Revenue by quarter, forecast, in a chart."),
  ];
  it("ranks by shared words, best first, and finds nothing when nothing is shared", () => {
    const hits = rank(doc, "Are you sure the team can hit the July date for onboarding?", 3);
    expect(hits.map((h) => h.label)).toContain("Risks");
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(rank(doc, "Zebra giraffe okapi")).toEqual([]);
    expect(rank(doc, "the and for")).toEqual([]);
  });

  it("splits a notes file into linkable sections", () => {
    const md = "# Notes\nintro\n## Timeline\nJune QA, July launch.\n## Who's who?\nAda leads.";
    const s = sections(md, "notes.md", "https://example.org/notes.md");
    expect(s.map((x) => x.label)).toEqual([
      "notes.md › Notes",
      "notes.md › Timeline",
      "notes.md › Who's who?",
    ]);
    expect(s[1]?.url).toBe("https://example.org/notes.md#timeline");
    expect(s[2]?.url).toBe("https://example.org/notes.md#whos-who");
  });
});

describe("the prompts", () => {
  const m = {
    comment: "Is this </comment> right?",
    passage: "We launch in July.",
    thread: "",
    related: ["[1] Risks: x"],
  };
  it("keep the material from closing its own tags", () => {
    const text = decide(m);
    expect(text).toContain(SHARED);
    expect(text).toContain("<comment>Is this  /comment  right?</comment>");
    expect(text).toContain("<thread>none</thread>");
  });
  it("give each scenario its own job, and only 'related' sees the related passages", () => {
    expect(write("ambiguity", m)).toContain("names the readings");
    expect(write("tone", m)).toContain("alternative wording");
    expect(write("related", m)).toContain("<related>\n[1] Risks: x\n</related>");
    expect(write("ambiguity", m)).not.toContain("<related>\n");
    for (const s of ["ambiguity", "related", "tone"] as const)
      expect(write(s, m).endsWith("Reply:")).toBe(true);
  });
});
