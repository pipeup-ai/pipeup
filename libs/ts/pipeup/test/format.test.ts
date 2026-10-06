import { describe, expect, it } from "vitest";
import { copyAll, copyThread, formatAgo, type ExportItem } from "../src/export/format";
import { animalName } from "../src/model/animals";
import type { Comment } from "../src/model/types";

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const c = (
  name: string,
  text: string,
  minsAgo: number,
  replies: Comment[] = [],
  extra: Partial<Comment> = {},
): Comment => ({
  id: name + text,
  author: name,
  name,
  text,
  at: NOW - minsAgo * 60_000,
  edited: false,
  deleted: false,
  replies,
  ...extra,
});

const pin: ExportItem = {
  thread: {
    id: "t1",
    resolved: false,
    anchor: { path: "", fingerprint: "", snapshot: "" },
    root: c("Sam", "Make Q4 the only coloured bar.", 18, [
      c("Amy", "Already is — darken the label?", 10),
      c("Sam", "Done.", 0),
    ]),
  },
  location: {
    where: 'Slide 3 "Revenue grew 42%" › Q4 bar',
    element: "Q4 bar",
    id: "s3-q4",
    quote: null,
    pin: "50% across, 6% down the element",
  },
};
const quote: ExportItem = {
  thread: {
    id: "t2",
    resolved: false,
    anchor: { path: "", fingerprint: "", snapshot: "" },
    root: c("Jamie", "Calendar or fiscal?\nWorth saying.", 5, [], { edited: true }),
  },
  location: {
    where: 'Section "Q3 plan" › Paragraph',
    element: "Paragraph",
    id: null,
    quote: "revenue up 42%",
    pin: null,
  },
};
const done: ExportItem = { ...quote, thread: { ...quote.thread, id: "t3", resolved: true } };

describe("formatAgo", () => {
  it("says how long ago, briefly", () => {
    expect(formatAgo(NOW - 20_000, NOW)).toBe("just now");
    expect(formatAgo(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatAgo(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(formatAgo(NOW - 3 * 86_400_000, NOW)).toBe("3d ago");
  });
});

describe("copyThread", () => {
  it("copies the whole thread as Markdown with where it is", () => {
    expect(copyThread(pin, "ai", "https://x.test/deck.html", NOW)).toBe(
      [
        "## Comment thread · open",
        "- **Thread:** t1",
        "- **Page:** https://x.test/deck.html",
        '- **Where:** Slide 3 "Revenue grew 42%" › Q4 bar',
        '- **Element:** `[data-pipeup-id="s3-q4"]` (Q4 bar)',
        "- **Pin:** 50% across, 6% down the element",
        "- **Started by:** Sam, 18m ago · 2 replies",
        "",
        "**Sam** (18m ago): Make Q4 the only coloured bar.",
        "- **Amy** (10m ago): Already is — darken the label? <!-- comment:AmyAlready is — darken the label? -->",
        "- **Sam** (just now): Done. <!-- comment:SamDone. -->",
        "",
      ].join("\n"),
    );
  });

  it("keeps multi-line comments inside their list item and marks edits", () => {
    const md = copyThread(quote, "ai", "p", NOW);
    expect(md).toContain('- **Quoted text:** "revenue up 42%"');
    expect(md).toContain("**Jamie** (5m ago): Calendar or fiscal?\n  Worth saying. (edited)");
  });

  it("copies plain text when asked", () => {
    expect(copyThread(pin, "text", "p", NOW)).toBe(
      'Slide 3 "Revenue grew 42%" › Q4 bar\nSam: Make Q4 the only coloured bar.\n  Amy: Already is — darken the label?\n  Sam: Done.\n',
    );
  });

  it("keeps a multi-line where on one metadata line", () => {
    const messy: ExportItem = {
      ...pin,
      location: { ...pin.location, where: "Slide 3\n- **Pin:** fake\n  › Q4 bar" },
    };
    const md = copyThread(messy, "ai", "p", NOW);
    expect(md).toContain("- **Where:** Slide 3 - **Pin:** fake › Q4 bar\n");
    expect(md.split("\n").filter((l) => l.startsWith("- **Where:**"))).toHaveLength(1);
    expect(copyThread(messy, "text", "p", NOW).split("\n")[0]).toBe("Slide 3 - **Pin:** fake › Q4 bar");
  });

  it("strips backticks from the id so the code span stays clean", () => {
    const messy: ExportItem = { ...pin, location: { ...pin.location, id: "a`b\nc" } };
    expect(copyThread(messy, "ai", "p", NOW)).toContain('- **Element:** `[data-pipeup-id="ab c"]` (Q4 bar)');
  });

  it("names someone who has not added a name by their animal", () => {
    const key = "Q".repeat(43);
    const anon = { ...c("", "Tighten this.", 5), author: key };
    const item: ExportItem = {
      ...quote,
      thread: { ...quote.thread, root: { ...anon, replies: [{ ...anon, id: "r", text: "Me again." }] } },
    };
    const animal = animalName(key);
    const md = copyThread(item, "ai", "p", NOW);
    expect(md).toContain(`- **Started by:** ${animal}, 5m ago · 1 reply`);
    expect(md).toContain(`**${animal}** (5m ago): Tighten this.`);
    expect(md).toContain(`- **${animal}** (5m ago): Me again.`);
    expect(copyThread(item, "text", "p", NOW)).toContain(`${animal}: Tighten this.\n  ${animal}: Me again.`);
  });

  it("flattens a multi-line quote and names", () => {
    const messy: ExportItem = {
      thread: { ...quote.thread, root: c("Ja\nmie", "hi", 5) },
      location: { ...quote.location, quote: "line one\n\n  line two" },
    };
    const md = copyThread(messy, "ai", "p", NOW);
    expect(md).toContain('- **Quoted text:** "line one line two"');
    expect(md).toContain("- **Started by:** Ja mie, 5m ago");
    expect(md).toContain("**Ja mie** (5m ago): hi");
    expect(copyThread(messy, "text", "p", NOW)).toContain('on the text "line one line two"\nJa mie: hi');
  });
});

describe("copyAll", () => {
  it("lists open threads with a header and leaves resolved ones out", () => {
    const md = copyAll([pin, done, quote], "ai", {
      title: "Lumen Q3 review",
      url: "https://x.test/deck.html",
      exportedAt: new Date(NOW),
    });
    expect(
      md.startsWith("# Review comments: Lumen Q3 review\n\n- **Page:** https://x.test/deck.html\n"),
    ).toBe(true);
    expect(md).toContain("- **Exported:** 2026-10-05T12:00:00.000Z");
    expect(md).toContain("- **Open threads:** 2 (1 resolved, not included)");
    expect(md).toContain("## Thread 1 · open\n- **Thread:** t1\n");
    expect(md).toContain("## Thread 2 · open");
    expect(md).not.toContain("## Thread 3");
  });

  it("joins plain-text threads with blank lines", () => {
    const text = copyAll([pin, quote], "text", { title: "t", url: "u", exportedAt: new Date(NOW) });
    expect(text.split("\n\n")).toHaveLength(2);
  });

  it("keeps the title, page and address on their own lines", () => {
    const md = copyAll([pin], "ai", {
      title: "Lumen\n# Q3 review",
      url: "https://x.test/\ndeck.html",
      exportedAt: new Date(NOW),
    });
    expect(
      md.startsWith("# Review comments: Lumen # Q3 review\n\n- **Page:** https://x.test/ deck.html\n"),
    ).toBe(true);
    expect(copyThread(pin, "ai", "a\nb", NOW)).toContain("- **Page:** a b\n");
  });

  it("indents continuation lines whatever the line ending", () => {
    const item = (text: string): ExportItem => ({
      ...quote,
      thread: { ...quote.thread, root: c("Jamie", text, 5) },
    });
    const lf = copyThread(item("one\ntwo\nthree"), "ai", "p", NOW);
    expect(copyThread(item("one\r\ntwo\rthree"), "ai", "p", NOW)).toBe(lf);
    expect(copyThread(item("one\r\ntwo\rthree"), "text", "p", NOW)).toBe(
      copyThread(item("one\ntwo\nthree"), "text", "p", NOW),
    );
  });
});
