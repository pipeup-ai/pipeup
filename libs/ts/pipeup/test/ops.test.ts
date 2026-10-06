import { describe, expect, it } from "vitest";
import { createIdentity } from "../src/crypto/identity";
import {
  compareOps,
  isAuthentic,
  isWellFormed,
  LIMITS,
  MAX_AT,
  MAX_CLOCK,
  MAX_TEXT,
  signOp,
} from "../src/model/ops";
import type { OpBody, SignedOp } from "../src/model/types";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

async function body(
  over: Partial<OpBody> = {},
): Promise<{ body: OpBody; me: Awaited<ReturnType<typeof createIdentity>> }> {
  const me = await createIdentity();
  const id = "A".repeat(43);
  return {
    me,
    body: {
      v: 1,
      id,
      kind: "create",
      doc: "doc",
      thread: id,
      text: "hi",
      anchor: ANCHOR,
      author: me.publicKey,
      name: "Kev",
      clock: 1,
      at: 1,
      ...over,
    },
  };
}

describe("ops", () => {
  it("signs a body by its author and verifies it", async () => {
    const { me, body: b } = await body();
    const op = await signOp(b, me);
    expect(isWellFormed(op)).toBe(true);
    expect(await isAuthentic(op)).toBe(true);
  });

  it("refuses to sign for someone else", async () => {
    const { body: b } = await body();
    const stranger = await createIdentity();
    await expect(signOp(b, stranger)).rejects.toThrow(/signed by its author/);
  });

  it("detects altered text", async () => {
    const { me, body: b } = await body();
    const op = await signOp(b, me);
    const forged: SignedOp = { ...op, body: { ...op.body, text: "changed" } };
    expect(await isAuthentic(forged)).toBe(false);
  });

  it("rejects malformed ops", async () => {
    const { me, body: b } = await body();
    const ok = await signOp(b, me);
    const bad = (patch: Record<string, unknown>) => ({ ...ok, body: { ...ok.body, ...patch } });
    expect(isWellFormed(null)).toBe(false);
    expect(isWellFormed({ body: ok.body })).toBe(false);
    expect(isWellFormed(bad({ v: 2 }))).toBe(false);
    expect(isWellFormed(bad({ kind: "explode" }))).toBe(false);
    expect(isWellFormed(bad({ text: "   " }))).toBe(false);
    expect(isWellFormed(bad({ text: "x".repeat(MAX_TEXT + 1) }))).toBe(false);
    expect(isWellFormed(bad({ thread: "B".repeat(43) }))).toBe(false);
    expect(isWellFormed(bad({ anchor: undefined }))).toBe(false);
    expect(isWellFormed(bad({ kind: "reply", target: undefined }))).toBe(false);
    expect(isWellFormed(bad({ clock: 0 }))).toBe(false);
    expect(isWellFormed(bad({ name: "n".repeat(81) }))).toBe(false);
    expect(isWellFormed(bad({ name: "  " }))).toBe(false);
    expect(isWellFormed(bad({ name: " Kev " }))).toBe(false);
  });

  it("accepts an op from someone who has not added a name", async () => {
    const { me, body: b } = await body();
    const ok = await signOp({ ...b, name: "" }, me);
    expect(isWellFormed(ok)).toBe(true);
  });

  it("rejects ops with out-of-bounds fields", async () => {
    const { me, body: b } = await body();
    const ok = await signOp(b, me);
    const bad = (patch: Record<string, unknown>) => ({ ...ok, body: { ...ok.body, ...patch } });
    const anchor = (patch: Record<string, unknown>) => bad({ anchor: { ...ANCHOR, ...patch } });
    expect(isWellFormed(bad({ text: " hi " }))).toBe(false);
    expect(isWellFormed(bad({ at: NaN }))).toBe(false);
    expect(isWellFormed(bad({ at: Infinity }))).toBe(false);
    expect(isWellFormed(bad({ at: -1 }))).toBe(false);
    expect(isWellFormed(bad({ at: 1.5 }))).toBe(false);
    expect(isWellFormed(bad({ at: 2 ** 60 }))).toBe(false);
    expect(isWellFormed(bad({ at: 0 }))).toBe(true);
    expect(isWellFormed(bad({ at: MAX_AT }))).toBe(true);
    expect(isWellFormed(bad({ at: MAX_AT + 1 }))).toBe(false);
    expect(isWellFormed(bad({ clock: MAX_CLOCK + 1 }))).toBe(false);
    expect(isWellFormed(bad({ doc: "" }))).toBe(false);
    expect(isWellFormed(bad({ doc: "d".repeat(LIMITS.doc + 1) }))).toBe(false);
    expect(isWellFormed(anchor({ fingerprint: "xyz" }))).toBe(false);
    expect(isWellFormed(anchor({ snapshot: undefined }))).toBe(false);
    expect(isWellFormed(anchor({ snapshot: "s".repeat(LIMITS.snapshot + 1) }))).toBe(false);
    expect(isWellFormed(anchor({ quote: 5 }))).toBe(false);
    expect(isWellFormed(anchor({ quote: { exact: "", prefix: "", suffix: "" } }))).toBe(false);
    expect(isWellFormed(anchor({ quote: { exact: "a", prefix: "p".repeat(65), suffix: "" } }))).toBe(false);
    expect(isWellFormed(anchor({ point: { x: 2, y: 0 } }))).toBe(false);
    expect(isWellFormed(anchor({ point: { x: NaN, y: 0 } }))).toBe(false);
    expect(isWellFormed(anchor({ view: ["a"] }))).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, "v"]));
    expect(isWellFormed(anchor({ view: many }))).toBe(false);
    expect(isWellFormed(anchor({ view: { slide: 3 } }))).toBe(false);
    expect(isWellFormed(anchor({ id: "" }))).toBe(false);
    expect(isWellFormed(anchor({ path: "p".repeat(LIMITS.path + 1) }))).toBe(false);
    expect(isWellFormed(anchor({ id: "i".repeat(LIMITS.anchorId + 1) }))).toBe(false);
    expect(isWellFormed(anchor({ view: { ["k".repeat(65)]: "v" } }))).toBe(false);
    expect(isWellFormed(anchor({ view: { k: "v".repeat(201) } }))).toBe(false);
    expect(
      isWellFormed(anchor({ quote: { exact: "e".repeat(LIMITS.quote + 1), prefix: "", suffix: "" } })),
    ).toBe(false);
    expect(isWellFormed(anchor({ point: { x: 0, y: 1.5 } }))).toBe(false);
    expect(isWellFormed(anchor({ point: { x: -0.1, y: 0 } }))).toBe(false);
  });

  it("takes only full-length ids for id, thread and target", async () => {
    const T = "T".repeat(43);
    const { me, body: b } = await body({
      kind: "reply",
      id: "R".repeat(43),
      thread: T,
      target: T,
      anchor: undefined,
    });
    const ok = await signOp(b, me);
    const bad = (patch: Record<string, unknown>) => ({ ...ok, body: { ...ok.body, ...patch } });
    expect(isWellFormed(ok)).toBe(true);
    expect(isWellFormed(bad({ id: "R".repeat(22) }))).toBe(false);
    expect(isWellFormed(bad({ thread: "T".repeat(22) }))).toBe(false);
    expect(isWellFormed(bad({ target: "T".repeat(22) }))).toBe(false);
    expect(isWellFormed(bad({ target: "T".repeat(44) }))).toBe(false);
  });

  it("accepts a fully populated anchor", async () => {
    const { me, body: b } = await body({
      anchor: {
        ...ANCHOR,
        id: "hero",
        quote: { exact: "hello", prefix: "oh ", suffix: " there" },
        point: { x: 0.5, y: 0.06 },
        view: { slide: "3" },
      },
    });
    expect(isWellFormed(await signOp(b, me))).toBe(true);
  });

  it("orders by clock, then time, then author, then id", () => {
    const op = (clock: number, at: number, author: string, id: string) =>
      ({ body: { clock, at, author, id } as OpBody, sig: "" }) as SignedOp;
    const sorted = [
      op(2, 0, "a", "x"),
      op(1, 5, "a", "x"),
      op(1, 3, "b", "x"),
      op(1, 3, "a", "y"),
      op(1, 3, "a", "x"),
    ].sort(compareOps);
    expect(sorted.map((o) => `${o.body.clock}${o.body.at}${o.body.author}${o.body.id}`)).toEqual([
      "13ax",
      "13ay",
      "13bx",
      "15ax",
      "20ax",
    ]);
  });
});
