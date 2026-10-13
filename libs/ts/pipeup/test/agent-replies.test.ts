// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { copyAll, type ExportItem } from "../src/export/format";
import { foldThreads } from "../src/model/fold";
import { isWellFormed } from "../src/model/ops";
import type { OpBody, SignedOp } from "../src/model/types";

const A = "A".repeat(43);
const B = "B".repeat(43);
const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };
const id = (n: string) => n.padEnd(43, "_");
let clock = 0;

function op(kind: OpBody["kind"], over: Partial<OpBody>): SignedOp {
  clock += 1;
  return {
    sig: "",
    body: {
      v: 1,
      id: id(`op${clock}`),
      kind,
      doc: "d",
      thread: id("t1"),
      author: A,
      name: "Amy",
      clock,
      at: clock,
      ...over,
    },
  };
}
const create = () => op("create", { id: id("t1"), thread: id("t1"), text: "root", anchor: ANCHOR });
const addressed = (text = "addressed in r2") =>
  op("addressed", { author: B, name: "AI assistant · Claude", text });

describe("addressed", () => {
  it("is a note on an open thread, not a resolve", () => {
    const [t] = foldThreads([create(), addressed()]);
    expect(t?.resolved).toBe(false);
    expect(t?.addressed).toMatchObject({ text: "addressed in r2", name: "AI assistant · Claude" });
  });

  it("is cleared when a person reopens the thread", () => {
    const [t] = foldThreads([create(), addressed(), op("resolve", {}), op("reopen", {})]);
    expect(t?.resolved).toBe(false);
    expect(t?.addressed).toBeUndefined();
  });

  it("needs words, and is ignored for a thread that isn't there", () => {
    expect(isWellFormed(addressed())).toBe(true);
    expect(isWellFormed({ ...addressed(), body: { ...addressed().body, text: undefined } })).toBe(false);
    expect(foldThreads([addressed()])).toEqual([]);
  });
});

describe("copy for AI with addressed threads", () => {
  const item = (over = {}): ExportItem => {
    const [thread] = foldThreads([create(), addressed()]);
    return { thread: { ...thread!, ...over }, location: { where: "Intro" } as ExportItem["location"] };
  };
  const meta = { title: "T", url: "u", exportedAt: new Date(5) };

  it("says a thread is addressed, with the note, and tells the agent never to resolve", () => {
    const md = copyAll([item()], "ai", meta);
    expect(md).toContain("· open, addressed");
    expect(md).toContain("- **Addressed:** addressed in r2 (Claude");
    expect(md).toContain("never resolve it");
  });

  it("can include resolved threads when asked", () => {
    const done = item({ resolved: true });
    expect(copyAll([done], "ai", meta)).toContain("**Open threads:** 0");
    expect(copyAll([done], "ai", { ...meta, all: true })).toContain("· resolved");
  });
});

describe("reactions", () => {
  const C = "C".repeat(43);
  const react = (kind: "react" | "unreact", author: string, text = "👍", name = "") =>
    op(kind, { author, name, text, target: id("t1") });

  it("are counted once per person and emoji, in the order they first appeared", () => {
    const [t] = foldThreads([
      create(),
      react("react", A, "👍", "Amy"),
      react("react", B, "❤️"),
      react("react", B, "👍"),
      react("react", B, "👍"),
    ]);
    expect(t!.root.reactions).toEqual([
      {
        emoji: "👍",
        by: [
          { author: A, name: "Amy" },
          { author: B, name: "" },
        ],
      },
      { emoji: "❤️", by: [{ author: B, name: "" }] },
    ]);
  });

  it("can be taken back, by their own giver only, and the emoji goes when nobody has it", () => {
    const [t] = foldThreads([
      create(),
      react("react", A),
      react("react", B),
      react("unreact", C),
      react("unreact", A),
    ]);
    expect(t!.root.reactions).toEqual([{ emoji: "👍", by: [{ author: B, name: "" }] }]);
    expect(foldThreads([create(), react("react", A), react("unreact", A)])[0]!.root.reactions).toEqual([]);
  });

  it("fill in a name the person gave later, like comments do", () => {
    const [t] = foldThreads([
      create(),
      react("react", B),
      op("reply", { author: B, name: "Bo", text: "hi" }),
    ]);
    expect(t!.root.reactions[0]!.by[0]!.name).toBe("Bo");
  });

  it("stop at 12 different emoji on one comment", () => {
    const many = ["😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆", "😉", "😊", "😋", "😎", "😍", "😘"];
    const [t] = foldThreads([create(), ...many.map((e) => react("react", A, e))]);
    expect(t!.root.reactions.map((r) => r.emoji)).toEqual(many.slice(0, 12));
  });

  it("go when the comment is deleted, and are ignored on a comment that isn't there", () => {
    const [t] = foldThreads([create(), react("react", B), op("delete", { author: A, target: id("t1") })]);
    expect(t!.root.reactions).toEqual([]);
    expect(
      foldThreads([create(), op("react", { author: B, text: "👍", target: id("nope") })])[0]!.root.reactions,
    ).toEqual([]);
  });

  it("are the same whatever order the ops arrive in", () => {
    const ops = [create(), react("react", A), react("react", B), react("unreact", A), react("react", A)];
    expect(foldThreads([...ops].reverse())).toEqual(foldThreads(ops));
  });
});
