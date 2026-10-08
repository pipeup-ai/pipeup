import type { SignedOp } from "pipeup";
import { describe, expect, it } from "vitest";
import { derivedRoom, ladder } from "../src/derive";
import { fromText, open, seal, toText } from "../src/envelope";

const S = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const make = async (doc = "aaaaaaaaaaaaaaaa") => ladder(doc, await derivedRoom(doc, S));
const fake = (n: number, v = 1): SignedOp[] =>
  Array.from({ length: n }, (_, i) => ({ body: { v, id: `id${i}` } as never, sig: "s" }));

describe("the sealed envelope", () => {
  it("round-trips a batch, and what it holds is a valid unsealed feedback file", async () => {
    const l = await make();
    const sealed = await seal(l, "share", fake(3));
    expect(sealed[0]).toBe(1);
    const got = await open(l, "share", sealed);
    expect(got?.ops).toHaveLength(3);
    expect(got?.newer).toBe(0);
  });

  it("refuses another purpose, another document, a flipped byte and truncation as if nothing came", async () => {
    const l = await make();
    const sealed = await seal(l, "share", fake(1));
    expect(await open(l, "live", sealed)).toBeNull();
    expect(await open(await make("bbbbbbbbbbbbbbbb"), "share", sealed)).toBeNull();
    const flipped = sealed.slice();
    flipped[flipped.length - 1]! ^= 1;
    expect(await open(l, "share", flipped)).toBeNull();
    expect(await open(l, "share", sealed.slice(0, 20))).toBeNull();
    expect(await open(l, "share", new Uint8Array(100))).toBeNull();
  });

  it("counts ops from a newer Pipeup instead of dropping them silently", async () => {
    const l = await make();
    const got = await open(l, "share", await seal(l, "share", [...fake(2), ...fake(3, 2)]));
    expect(got?.newer).toBe(3);
  });

  it("refuses batches over 1,000 ops and ones that inflate past 1 MB", async () => {
    const l = await make();
    expect(await open(l, "share", await seal(l, "share", fake(1001)))).toBeNull();
    const huge = [{ body: { v: 1, id: "x", text: "a".repeat(1_200_000) } as never, sig: "s" }];
    expect(await open(l, "share", await seal(l, "share", huge))).toBeNull();
  });

  it("has a text form that survives the wire and refuses junk", async () => {
    const l = await make();
    const sealed = await seal(l, "live", fake(1));
    const text = toText(sealed);
    expect(text.startsWith("pu1.")).toBe(true);
    expect(fromText(text)).toEqual(sealed);
    expect(fromText("pu1.")).toBeNull();
    expect(fromText("nope")).toBeNull();
    expect(fromText("pu1.***")).toBeNull();
  });
});
