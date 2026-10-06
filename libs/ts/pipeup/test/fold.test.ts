import { describe, expect, it } from "vitest";
import { foldThreads } from "../src/model/fold";
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
const create = (over: Partial<OpBody> = {}) =>
  op("create", { id: id("t1"), thread: id("t1"), text: "root", anchor: ANCHOR, ...over });

describe("foldThreads", () => {
  it("builds a thread from a create op", () => {
    const [t] = foldThreads([create()]);
    expect(t?.id).toBe(id("t1"));
    expect(t?.root.text).toBe("root");
    expect(t?.resolved).toBe(false);
  });

  it("puts every reply one level under the comment, in order, whatever it answered", () => {
    const ops = [
      create(),
      op("reply", { id: id("r1"), target: id("t1"), text: "reply" }),
      op("reply", { id: id("n1"), target: id("r1"), text: "nested", author: B, name: "Ben" }),
      op("reply", { id: id("n2"), target: id("n1"), text: "nested again" }),
    ];
    const [t] = foldThreads(ops);
    expect(t?.root.replies.map((r) => r.text)).toEqual(["reply", "nested", "nested again"]);
    expect(t?.root.replies.every((r) => r.replies.length === 0)).toBe(true);
  });

  it("gives the same result whatever order ops arrive in", () => {
    const ops = [create(), op("reply", { id: id("r1"), target: id("t1"), text: "a" }), op("resolve", {})];
    expect(foldThreads([...ops].reverse())).toEqual(foldThreads(ops));
  });

  it("lets only the writer edit or delete", () => {
    const ops = [
      create(),
      op("edit", { target: id("t1"), text: "hijacked", author: B }),
      op("edit", { target: id("t1"), text: "fixed" }),
      op("reply", { id: id("r1"), target: id("t1"), text: "mine", author: B }),
      op("delete", { target: id("r1") }),
    ];
    const [t] = foldThreads(ops);
    expect(t?.root.text).toBe("fixed");
    expect(t?.root.edited).toBe(true);
    expect(t?.root.replies[0]?.deleted).toBe(false);
  });

  it("deletes by the writer and ignores edits after deletion", () => {
    const ops = [
      create(),
      op("delete", { target: id("t1") }),
      op("edit", { target: id("t1"), text: "back" }),
    ];
    const [t] = foldThreads(ops);
    expect(t?.root.deleted).toBe(true);
    expect(t?.root.text).toBe("");
  });

  it("applies resolve and reopen in clock order, by anyone", () => {
    const [t1] = foldThreads([create(), op("resolve", { author: B })]);
    expect(t1?.resolved).toBe(true);
    const [t2] = foldThreads([create(), op("resolve", {}), op("reopen", { author: B })]);
    expect(t2?.resolved).toBe(false);
  });

  it("ignores ops for unknown threads, unknown targets and cross-thread targets", () => {
    const ops = [
      create(),
      create({ id: id("t2"), thread: id("t2"), text: "other" }),
      op("reply", { id: id("x1"), target: id("nope"), text: "lost" }),
      op("reply", { id: id("x2"), thread: id("t2"), target: id("t1"), text: "cross" }),
      op("resolve", { thread: id("ghost") }),
    ];
    const threads = foldThreads(ops);
    expect(threads.map((t) => t.root.replies.length)).toEqual([0, 0]);
  });

  it("shows an unnamed comment with the name its writer added later, else no name", () => {
    const t = create({ name: "" });
    const r1 = op("reply", { author: B, name: "", target: id("t1"), text: "first" });
    const r2 = op("reply", { name: "", target: id("t1"), text: "second" });
    const named = op("reply", { name: "Amy", target: id("t1"), text: "now named" });
    const [th] = foldThreads([t, r1, r2, named]);
    expect(th?.root.name).toBe("Amy");
    expect(th?.root.replies.map((c) => c.name)).toEqual(["", "Amy", "Amy"]);
  });

  it("ignores a second create with the same id", () => {
    const threads = foldThreads([create(), create({ text: "duplicate" })]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.root.text).toBe("root");
  });
});
