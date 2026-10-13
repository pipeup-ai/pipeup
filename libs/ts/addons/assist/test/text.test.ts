import { describe, expect, it } from "vitest";
import { decide, gist, verify, write, SHARED } from "../src/prompts";
import {
  clean,
  foundIn,
  gistOf,
  hashOf,
  parts,
  rank,
  replyPart,
  restates,
  scenarioOf,
  sections,
  type Passage,
} from "../src/text";

describe("the model's words", () => {
  it("reads the one-word answer, and anything else is none", () => {
    expect(scenarioOf("ambiguity")).toBe("ambiguity");
    expect(scenarioOf('  "Related".')).toBe("related");
    expect(scenarioOf("Tone, because it sounds harsh")).toBe("tone");
    expect(scenarioOf("I think a reply would help")).toBe("none");
    expect(scenarioOf("")).toBe("none");
  });

  it("strips the lead and the formatting from a reply", () => {
    const raw = "Reply: **The Risks section** says pricing slips.\n- it is in `July`";
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
  };
  it("keep the material from closing its own tags", () => {
    const text = decide(m);
    expect(text).toContain(SHARED);
    expect(text).toContain("<comment>Is this  /comment  right?</comment>");
    expect(text).toContain("<thread>none</thread>");
  });
  it("give each written reply its own job", () => {
    expect(write("ambiguity", m)).toContain("names the readings");
    expect(write("tone", m)).toContain("alternative wording");
    for (const s of ["ambiguity", "tone"] as const) expect(write(s, m).endsWith("Reply:")).toBe(true);
  });
});

describe("reading the whole page", () => {
  it("cuts long text into parts at sentence ends, and loses nothing", () => {
    const text = "The first goal is churn. ".repeat(200).trim();
    const out = parts(text, 500);
    expect(out.length).toBeGreaterThan(5);
    for (const part of out) expect(part.length).toBeLessThanOrEqual(500);
    expect(out.join(" ").replace(/\s+/g, " ")).toBe(text);
    expect(parts("Hold churn under 3%.")).toEqual(["Hold churn under 3%."]);
  });

  it("fingerprints words, so only changed sections are read again", () => {
    expect(hashOf("Goals\nHold churn under 3%.")).toBe(hashOf("Goals\nHold churn under 3%."));
    expect(hashOf("Goals\nHold churn under 4%.")).not.toBe(hashOf("Goals\nHold churn under 3%."));
  });

  it("keeps a gist short and plain", () => {
    expect(gistOf("Gist: **Next quarter's goals.**\nFacts: churn under 3%; ship onboarding")).toBe(
      "Next quarter's goals. churn under 3%; ship onboarding",
    );
    expect(gistOf("x".repeat(500))).toHaveLength(300);
  });

  it("accepts a sentence only when the section really holds it", () => {
    const section = "Ship onboarding. Hold churn under 3%. Review pricing in August.";
    expect(foundIn(section, "Hold churn under 3%.")).toBe("Hold churn under 3%.");
    expect(foundIn(section, 'Sentence: "Hold churn under 3%."\nbecause it matters')).toBe(
      "Hold churn under 3%.",
    );
    expect(foundIn(section, "Hold churn under 1% by June.")).toBeNull();
    expect(foundIn(section, "NONE")).toBeNull();
    expect(foundIn(section, "3%")).toBeNull();
  });

  it("finds a short line on a slide through its gist and facts, and matches word endings", () => {
    const slide: Passage = {
      label: "Slide 6",
      text: "Hold churn under 3%.",
      extra: "Goals for next quarter",
    };
    const other: Passage = { label: "Slide 1", text: "Revenue grew in every region." };
    expect(rank([other, slide], "Do we have a risk of churning customers?", 8)[0]).toBe(slide);
    expect(rank([other, slide], "what are the goals?", 8)[0]).toBe(slide);
  });

  it("asks for a gist of a section, and for one sentence from it", () => {
    expect(gist("Goals", "Hold churn.")).toContain("<section>Goals: Hold churn.</section>");
    const m = { comment: "Risk?", passage: "p", thread: "", related: [] };
    const v = verify(m, "Hold churn under 3%.");
    expect(v).toContain("<section>Hold churn under 3%.</section>");
    expect(v.endsWith("Sentence:")).toBe(true);
  });
});
