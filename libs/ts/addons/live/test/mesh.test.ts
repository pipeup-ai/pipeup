import type { Listener, SignedOp } from "pipeup";
import { derivedRoom, ladder, randomBytes, type Ladder } from "@pipeup/kit";
import { describe, expect, it } from "vitest";
import { loopback, Mesh } from "../src/headless";

const op = (id: string): SignedOp => ({ body: { v: 1, id, author: "x", doc: "d" } as never, sig: "s" });

/** A document stand-in that keeps what a verifier would: anything but ids starting "junk". */
function fakeDoc() {
  const ops = new Map<string, SignedOp>();
  const listeners = new Set<Listener>();
  return {
    ops: () => [...ops.values()],
    ids: () => [...ops.keys()].sort(),
    onChange: (fn: Listener) => (listeners.add(fn), () => listeners.delete(fn)),
    merge: async (incoming: readonly unknown[]) => {
      const added = (incoming as SignedOp[]).filter(
        (o) => !o.body.id.startsWith("junk") && !ops.has(o.body.id),
      );
      for (const o of added) ops.set(o.body.id, o);
      if (added.length) for (const fn of listeners) fn([], added, "live");
      return added.length;
    },
    write(o: SignedOp) {
      ops.set(o.body.id, o);
      for (const fn of listeners) fn([], [o], "local");
    },
  };
}

let lad: Promise<Ladder> | undefined;
const room = () => (lad ??= derivedRoom("d", randomBytes(32)).then((r) => ladder("d", r)));
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

async function node() {
  const doc = fakeDoc();
  const mesh = new Mesh({ ops: doc.ops, onChange: doc.onChange, merge: doc.merge }, await room());
  mesh.start();
  return { doc, mesh };
}

describe("reconcile on connect", () => {
  it("two peers with different comments end with the same set", async () => {
    const [a, b] = [await node(), await node()];
    a.doc.write(op("a1"));
    a.doc.write(op("a2"));
    b.doc.write(op("b1"));
    await loopback(a.mesh, b.mesh);
    await settle();
    expect(a.doc.ids()).toEqual(["a1", "a2", "b1"]);
    expect(b.doc.ids()).toEqual(["a1", "a2", "b1"]);
  });

  it("equal sets send no id list and no ops", async () => {
    const [a, b] = [await node(), await node()];
    for (const n of [a, b]) n.doc.write(op("same"));
    const frames: string[] = [];
    const orig = a.mesh.receive.bind(a.mesh);
    a.mesh.receive = async (id, raw) => (frames.push(raw), orig(id, raw));
    await loopback(a.mesh, b.mesh);
    await settle();
    expect(frames.map((f) => JSON.parse(f).t)).toEqual(["d"]);
  });

  it("a new comment goes to the peer within a moment, and an echo does not come back", async () => {
    const [a, b] = [await node(), await node()];
    await loopback(a.mesh, b.mesh);
    const frames: string[] = [];
    const orig = a.mesh.receive.bind(a.mesh);
    a.mesh.receive = async (id, raw) => (frames.push(raw), orig(id, raw));
    a.doc.write(op("new1"));
    await settle(200);
    expect(b.doc.ids()).toEqual(["new1"]);
    // b merged it with source "live" and must not send it back to a.
    expect(frames).toEqual([]);
  });
});

describe("forwarding", () => {
  it("passes an op on to a peer that lacks it: a pair that can't connect converges through a third", async () => {
    const [a, b, c] = [await node(), await node(), await node()];
    // a - b - c in a line; a and c never connect.
    await loopback(a.mesh, b.mesh, ["a", "b"]);
    await loopback(b.mesh, c.mesh, ["b", "c"]);
    a.doc.write(op("from-a"));
    await settle(400);
    expect(c.doc.ids()).toEqual(["from-a"]);
    c.doc.write(op("from-c"));
    await settle(400);
    expect(a.doc.ids()).toEqual(["from-a", "from-c"]);
  });
});

describe("rejected ids", () => {
  it("an op the core refuses is remembered, left out of digests and never forwarded", async () => {
    const [a, b, c] = [await node(), await node(), await node()];
    await loopback(a.mesh, b.mesh, ["a", "b"]);
    await loopback(b.mesh, c.mesh, ["b", "c"]);
    // a holds a junk op by force (as a bug would) and sends it.
    a.doc.write(op("junk1"));
    await settle(400);
    expect(b.doc.ids()).toEqual([]);
    expect(b.mesh.rejected.has("junk1")).toBe(true);
    expect(c.doc.ids()).toEqual([]);
    expect(c.mesh.rejected.has("junk1")).toBe(false);
  });

  it("garbage that does not open is dropped as if nothing came", async () => {
    const [a, b] = [await node(), await node()];
    await loopback(a.mesh, b.mesh);
    for (const raw of [
      '{"t":"o","b":"pu1.AAAA"}',
      '{"t":"o","b":5}',
      "not json",
      '{"t":"i","i":[1,2,{}]}',
      '{"t":"zzz"}',
    ])
      await b.mesh.receive("a", raw).catch(() => {});
    await settle(200);
    expect(b.doc.ids()).toEqual([]);
  });

  it("frames from an unknown peer are ignored", async () => {
    const b = await node();
    expect(await b.mesh.receive("nobody", '{"t":"d","d":"0.x"}')).toBe(false);
  });
});
