import { describe, expect, it, vi } from "vitest";
import { PipeupDocument } from "../src/document";
import { createIdentity } from "../src/crypto/identity";
import { computeOpId } from "../src/model/opid";
import { isWellFormed, MAX_OP, MAX_TEXT, signOp } from "../src/model/ops";
import { loadOrCreateProfile, MemoryStore } from "../src/storage/store";
import type { OpBody, SignedOp } from "../src/model/types";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

async function reviewer(name: string, doc = "doc") {
  const store = new MemoryStore();
  const profile = await loadOrCreateProfile(store, name);
  return { d: await PipeupDocument.open({ doc, key: null, store, identity: profile.identity, name }), store };
}

describe("the data slots add-ons use", () => {
  it("ops() lists every verified op as {body, sig}, and a merge hears the source and the added ops", async () => {
    const { d: ada } = await reviewer("Ada");
    const { d: sam } = await reviewer("Sam");
    await ada.comment(ANCHOR, "From Ada");
    expect(ada.ops()).toHaveLength(1);
    expect(Object.keys(ada.ops()[0]!).sort()).toEqual(["body", "sig"]);
    const heard = vi.fn();
    sam.onChange(heard);
    expect(await sam.merge(ada.ops(), "share")).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
    const [threads, added, source] = heard.mock.calls[0]!;
    expect(threads[0].root.text).toBe("From Ada");
    expect(added).toHaveLength(1);
    expect(source).toBe("share");
    // A second merge of the same ops adds nothing and says nothing.
    expect(await sam.merge(ada.ops(), "share")).toBe(0);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("tells listeners about its own writes as local, a rename with no ops, and an import as file", async () => {
    const { d } = await reviewer("Sam");
    const heard: Array<[number, string]> = [];
    d.onChange((_t, added, source) => heard.push([added.length, source]));
    await d.comment(ANCHOR, "Mine");
    d.name = "Samuel";
    const { d: other } = await reviewer("Ada");
    await other.comment(ANCHOR, "Hers");
    await d.importFile(await other.exportFile());
    expect(heard).toEqual([
      [1, "local"],
      [0, ""],
      [1, "file"],
    ]);
  });

  it("an old one-argument listener still works", async () => {
    const { d } = await reviewer("Sam");
    const seen: number[] = [];
    d.onChange((threads) => seen.push(threads.length));
    await d.comment(ANCHOR, "x");
    expect(seen).toEqual([1]);
  });

  it("refuses to merge more than 5,000 ops in one call", async () => {
    const { d } = await reviewer("Sam");
    await expect(d.merge(new Array(5001).fill(null), "share")).rejects.toThrow(RangeError);
    expect(await d.merge(new Array(5000).fill(null), "share")).toBe(0);
  });

  it("stores {body, sig} only: an unsigned extra field never survives, in the log, the store or an export", async () => {
    const { d: ada } = await reviewer("Ada");
    await ada.comment(ANCHOR, "From Ada");
    const op = { ...ada.ops()[0]!, junk: "x".repeat(100_000) };
    const { d: sam, store } = await reviewer("Sam");
    expect(await sam.merge([op], "share")).toBe(1);
    expect(Object.keys(sam.ops()[0]!).sort()).toEqual(["body", "sig"]);
    expect(JSON.stringify(await store.load("doc"))).not.toContain("junk");
    expect(await sam.exportFile()).not.toContain("junk");
  });

  it("bounds each op: the largest legal comment fits, a bigger one is refused", async () => {
    const me = await createIdentity();
    const body: OpBody = {
      v: 1,
      id: "",
      kind: "create",
      doc: "doc",
      thread: "",
      text: "\u0000".repeat(MAX_TEXT),
      anchor: {
        id: "i".repeat(200),
        path: "p".repeat(2000),
        fingerprint: "00000000",
        snapshot: "s".repeat(500),
        quote: { exact: "\u0001".repeat(10_000), prefix: "\u0002".repeat(64), suffix: "\u0003".repeat(64) },
        point: { x: 0.123456789, y: 0.987654321 },
        view: Object.fromEntries(
          Array.from({ length: 16 }, (_, i) => [`k${i}`.padEnd(64, "k"), "\u0004".repeat(200)]),
        ),
      },
      author: me.publicKey,
      name: "N".repeat(80),
      clock: 1,
      at: 1,
    };
    body.id = await computeOpId(body);
    body.thread = body.id;
    const legal = await signOp(body, me);
    expect(JSON.stringify(legal).length).toBeLessThan(MAX_OP);
    expect(isWellFormed(legal)).toBe(true);
    expect(isWellFormed({ ...legal, body: { ...legal.body, extra: "e".repeat(MAX_OP) } })).toBe(false);
  });

  it("signs for a purpose only, in a form that can never verify as an op", async () => {
    const { d } = await reviewer("Sam");
    const sig = await d.sign("live/hello", "topic:1");
    expect(sig).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(await d.sign("live/hello", "topic:1")).toBe(sig);
    expect(await d.sign("live/hello", "topic:2")).not.toBe(sig);
    for (const bad of ["hello", "Live/hello", "live/", "live/Hello", "x/y", "live/hello/extra"])
      expect(() => d.sign(bad, "x")).toThrow(/signing purpose/);
  });

  it("an op from another document is still refused, whatever brought it", async () => {
    const { d: a } = await reviewer("Ada", "doc-a");
    const { d: b } = await reviewer("Sam", "doc-b");
    await a.comment(ANCHOR, "x");
    expect(await b.merge(a.ops() as SignedOp[], "share")).toBe(0);
  });
});
