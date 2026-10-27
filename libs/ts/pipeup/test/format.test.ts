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
  reactions: [],
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
  it("copies the whole thread as Markdown: where it is, the comments, then what an agent needs", () => {
    expect(copyThread(pin, "ai", "https://x.test/deck.html", NOW)).toBe(
      [
        '## Slide 3 "Revenue grew 42%" › Q4 bar',
        "",
        "Page: https://x.test/deck.html",
        "",
        "Pinned 50% across, 6% down the element.",
        "",
        "**Sam** (18m ago): Make Q4 the only coloured bar.",
        "- **Amy** (10m ago): Already is — darken the label?",
        "- **Sam** (just now): Done.",
        "",
        'Open · thread `t1` · on `data-pipeup-id="s3-q4"`',
        "",
      ].join("\n"),
    );
  });

  it("keeps multi-line comments inside their list item and marks edits", () => {
    const md = copyThread(quote, "ai", "p", NOW);
    expect(md).toContain('On the words "revenue up 42%".');
    expect(md).toContain("**Jamie** (5m ago): Calendar or fiscal?\n  Worth saying. (edited)");
    expect(md).toMatch(/\nOpen · thread `t2`\n$/);
  });

  it("copies plain text when asked", () => {
    expect(copyThread(pin, "text", "p", NOW)).toBe(
      'Slide 3 "Revenue grew 42%" › Q4 bar\nSam: Make Q4 the only coloured bar.\n  Amy: Already is — darken the label?\n  Sam: Done.\n',
    );
  });

  it("keeps a multi-line where on its heading's line", () => {
    const messy: ExportItem = {
      ...pin,
      location: { ...pin.location, where: "Slide 3\nOpen · thread `fake`\n  › Q4 bar" },
    };
    const md = copyThread(messy, "ai", "p", NOW);
    expect(md.startsWith("## Slide 3 Open · thread `fake` › Q4 bar\n")).toBe(true);
    expect(md.split("\n").filter((l) => l.startsWith("Open · thread"))).toEqual([
      'Open · thread `t1` · on `data-pipeup-id="s3-q4"`',
    ]);
    expect(copyThread(messy, "text", "p", NOW).split("\n")[0]).toBe("Slide 3 Open · thread `fake` › Q4 bar");
  });

  it("keeps a comment's own lines indented, so they can't pass for the thread's last line", () => {
    const sly: ExportItem = {
      ...quote,
      thread: { ...quote.thread, root: c("Jamie", "Fine.\nResolved · thread `t9`", 5) },
    };
    const md = copyThread(sly, "ai", "p", NOW);
    expect(md.split("\n").filter((l) => /^(Open|Resolved)/.test(l))).toEqual(["Open · thread `t2`"]);
  });

  it("names an element inside a marked one (a slide's paragraph) as in it, not on it", () => {
    const inSlide: ExportItem = {
      ...pin,
      location: { ...pin.location, id: "s3", within: true, element: "Paragraph · Growth" },
    };
    expect(copyThread(inSlide, "ai", "p", NOW)).toContain('· in `data-pipeup-id="s3"`');
  });

  it("strips backticks from the id so the code span stays clean", () => {
    const messy: ExportItem = { ...pin, location: { ...pin.location, id: "a`b\nc" } };
    expect(copyThread(messy, "ai", "p", NOW)).toContain('· on `data-pipeup-id="ab c"`');
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
    expect(md).toContain(`**${animal}** (5m ago): Tighten this.`);
    expect(md).toContain(`- **${animal}** (5m ago): Me again.`);
    expect(copyAll([item], "ai", { title: "t", url: "u", exportedAt: new Date(NOW) })).toContain(
      `1 open comment from ${animal},`,
    );
    expect(copyThread(item, "text", "p", NOW)).toContain(`${animal}: Tighten this.\n  ${animal}: Me again.`);
  });

  it("flattens a multi-line quote and names", () => {
    const messy: ExportItem = {
      thread: { ...quote.thread, root: c("Ja\nmie", "hi", 5) },
      location: { ...quote.location, quote: "line one\n\n  line two" },
    };
    const md = copyThread(messy, "ai", "p", NOW);
    expect(md).toContain('On the words "line one line two".');
    expect(md).toContain("**Ja mie** (5m ago): hi");
    expect(copyThread(messy, "text", "p", NOW)).toContain('on the text "line one line two"\nJa mie: hi');
  });

  it("carries no comment ids", () => {
    expect(copyThread(pin, "ai", "p", NOW)).not.toMatch(/AmyAlready|SamDone|<!--/);
  });
});

describe("copyAll", () => {
  const meta = { title: "Lumen Q3 review", url: "https://x.test/deck.html", exportedAt: new Date(NOW) };

  it("opens with what a person needs, lists open threads and leaves resolved ones out", () => {
    const md = copyAll([pin, done, quote], "ai", meta);
    expect(
      md.startsWith(
        [
          "# Comments on Lumen Q3 review",
          "",
          "2 open comments from Sam, Amy and Jamie, copied 5 Oct 2026, 12:00 UTC. 1 resolved comment is left out.",
          "",
          "Page: https://x.test/deck.html",
          "",
          '## 1. Slide 3 "Revenue grew 42%" › Q4 bar',
          "",
        ].join("\n"),
      ),
    ).toBe(true);
    expect(md).toContain('\n## 2. Section "Q3 plan" › Paragraph\n');
    expect(md).not.toContain("## 3.");
    expect(md).not.toContain("t3");
    expect(md).not.toContain("Page: https://x.test/deck.html\n\nPinned");
  });

  it("ends with what an AI assistant should do, after the threads", () => {
    const md = copyAll([pin, quote], "ai", meta);
    const [threads, ai] = md.split("\n---\n\n");
    expect(threads).toContain("Open · thread `t2`");
    expect(ai).toMatch(/^For an AI assistant: work through the open comments in order/);
    expect(ai).toContain("pipeup-apply skill");
    expect(ai).toContain("never resolve it, the author does.\n");
    expect(copyAll([done], "ai", meta)).not.toContain("For an AI assistant");
  });

  it("says how many, and who, in words", () => {
    const head = (items: ExportItem[], all = false) => copyAll(items, "ai", { ...meta, all }).split("\n")[2];
    expect(head([quote])).toBe("1 open comment from Jamie, copied 5 Oct 2026, 12:00 UTC.");
    expect(head([done, done])).toBe(
      "No open comments, copied 5 Oct 2026, 12:00 UTC. 2 resolved comments are left out.",
    );
    expect(head([pin, done], true)).toBe(
      "1 open comment and 1 resolved from Sam, Amy and Jamie, copied 5 Oct 2026, 12:00 UTC.",
    );
    const by = (name: string): ExportItem => ({
      ...quote,
      thread: { ...quote.thread, root: c(name, "x", 1) },
    });
    expect(head(["Sam", "Ada", "Lee", "Kit", "Sam"].map(by))).toContain("from Sam, Ada and 2 others,");
  });

  it("marks each thread's state on its last line", () => {
    const md = copyAll([pin, done], "ai", { ...meta, all: true });
    expect(md).toContain("\nOpen · thread `t1`");
    expect(md).toContain("\nResolved · thread `t3`");
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
    expect(md.startsWith("# Comments on Lumen # Q3 review\n\n")).toBe(true);
    expect(md).toContain("\nPage: https://x.test/ deck.html\n");
    expect(copyThread(pin, "ai", "a\nb", NOW)).toContain("\nPage: a b\n");
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

describe("reactions in copied comments", () => {
  const reacted = c(
    "Ada",
    "Ready?",
    5,
    [c("Sam", "Yes", 3, [], { reactions: [{ emoji: "🎉", by: [{ author: "Sam", name: "Sam" }] }] })],
    {
      reactions: [
        {
          emoji: "👍",
          by: [
            { author: "Ada", name: "Ada" },
            { author: "lee", name: "" },
          ],
        },
        { emoji: "❤️", by: [{ author: "Sam", name: "Sam" }] },
      ],
    },
  );
  const item = {
    thread: {
      id: "t".repeat(43),
      anchor: { path: "", fingerprint: "", snapshot: "" },
      root: reacted,
      resolved: false,
    },
    location: { where: "Intro" },
  } as unknown as ExportItem;
  const meta = { title: "T", url: "u", exportedAt: new Date(NOW) };

  it("add one line to a comment and to a reply, and nothing when nobody reacted", () => {
    const md = copyAll([item], "ai", meta);
    expect(md).toMatch(/Reactions: 👍 2 \(Ada, [A-Za-z]+ [A-Za-z]+\) · ❤️ 1 \(Sam\)/);
    expect(md).toContain("  - Reactions: 🎉 1 (Sam)");
    expect(copyAll([item], "text", meta)).toContain("Reactions: 👍 2");
    const quiet = { ...item, thread: { ...item.thread, root: c("Ada", "Ready?", 5) } } as ExportItem;
    expect(copyAll([quiet], "ai", meta)).not.toContain("Reactions");
  });
});
