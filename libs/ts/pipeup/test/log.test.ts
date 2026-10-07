import { describe, expect, it } from "vitest";
import { createIdentity } from "../src/crypto/identity";
import { OpLog } from "../src/model/log";
import { computeOpId } from "../src/model/opid";
import { MAX_CLOCK, signOp } from "../src/model/ops";
import type { OpBody } from "../src/model/types";
import { randomId } from "../src/util/encoding";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

describe("OpLog", () => {
  it("appends signed ops and folds them", async () => {
    const me = await createIdentity();
    const log = new OpLog("doc");
    const create = await log.append(me, "Sam", {
      kind: "create",
      text: "hi",
      anchor: ANCHOR,
    });
    const reply = await log.append(me, "Sam", {
      kind: "reply",
      thread: create.body.id,
      target: create.body.id,
      text: "again",
    });
    expect(reply.body.clock).toBe(2);
    expect(log.threads()[0]?.root.replies[0]?.text).toBe("again");
  });

  it("merges another log, skipping duplicates, other documents and forgeries", async () => {
    const amy = await createIdentity();
    const ben = await createIdentity();
    const a = new OpLog("doc");
    const b = new OpLog("doc");
    const create = await a.append(amy, "Amy", {
      kind: "create",
      text: "hi",
      anchor: ANCHOR,
    });
    expect(await b.add(a.all())).toHaveLength(1);
    expect(await b.add(a.all())).toHaveLength(0);

    const elsewhere = new OpLog("other");
    const stray = await elsewhere.append(ben, "Ben", {
      kind: "create",
      text: "x",
      anchor: ANCHOR,
    });
    const forged = {
      ...create,
      body: { ...create.body, id: "F".repeat(43), thread: "F".repeat(43), text: "forged" },
    };
    expect(await b.add([stray, forged, { junk: true }])).toHaveLength(0);
    expect(b.size).toBe(1);
  });

  it("keeps the Lamport clock ahead of everything it has seen", async () => {
    const amy = await createIdentity();
    const a = new OpLog("doc");
    const first = await a.append(amy, "Amy", { kind: "create", text: "x", anchor: ANCHOR });
    for (let i = 1; i < 5; i++) await a.append(amy, "Amy", { kind: "create", text: "x", anchor: ANCHOR });
    const b = new OpLog("doc");
    await b.add(a.all());
    const next = await b.append(amy, "Amy", { kind: "resolve", thread: first.body.id });
    expect(next.body.clock).toBe(6);
  });

  it("drops an op whose clock would overflow the Lamport clock", async () => {
    const eve = await createIdentity();
    const me = await createIdentity();
    const hostile = await createSignedBy(eve, { text: "x", clock: Number.MAX_SAFE_INTEGER });
    const log = new OpLog("doc");
    expect(await log.add([hostile])).toEqual([]);
    // Control: the same op with a sane clock is accepted, so the clock was the reason for rejection.
    const sane = await createSignedBy(eve, { text: "x", clock: 1 });
    expect(await log.add([sane])).toHaveLength(1);
    const fresh = new OpLog("doc");
    expect(await fresh.add([hostile])).toEqual([]);
    const next = await fresh.append(me, "Sam", { kind: "create", text: "hi", anchor: ANCHOR });
    expect(next.body.clock).toBe(1);
  });

  it("keeps accepting new changes after a peer's clock reaches the cap", async () => {
    const eve = await createIdentity();
    const me = await createIdentity();
    const saturated = await createSignedBy(eve, { text: "x", clock: MAX_CLOCK });
    const log = new OpLog("doc");
    expect(await log.add([saturated])).toHaveLength(1);
    const next = await log.append(me, "Sam", { kind: "create", text: "hi", anchor: ANCHOR });
    expect(next.body.clock).toBe(MAX_CLOCK);
    expect(log.size).toBe(2);
  });

  it("gives each of a writer's changes a later time than the last, without following others", async () => {
    const me = await createIdentity();
    const eve = await createIdentity();
    const log = new OpLog("doc");
    const future = Date.now() + 1e9;
    expect(await log.add([await createSignedBy(eve, { text: "x", clock: 1, at: future })])).toHaveLength(1);
    const ats: number[] = [];
    for (let i = 0; i < 20; i++) {
      ats.push((await log.append(me, "Sam", { kind: "create", text: "same", anchor: ANCHOR })).body.at);
    }
    for (let i = 1; i < ats.length; i++) expect(ats[i]!).toBeGreaterThan(ats[i - 1]!);
    expect(ats.at(-1)!).toBeLessThan(future);
  });

  it("keeps a writer's times ahead of their own ops learned from elsewhere", async () => {
    const me = await createIdentity();
    const log = new OpLog("doc");
    const ahead = Date.now() + 60_000;
    expect(await log.add([await createSignedBy(me, { text: "x", clock: 1, at: ahead })])).toHaveLength(1);
    const next = await log.append(me, "Sam", { kind: "create", text: "y", anchor: ANCHOR });
    expect(next.body.at).toBe(ahead + 1);
  });

  it("derives each op's id from its content", async () => {
    const me = await createIdentity();
    const log = new OpLog("doc");
    const create = await log.append(me, "Sam", { kind: "create", text: "same", anchor: ANCHOR });
    const again = await log.append(me, "Sam", { kind: "create", text: "same", anchor: ANCHOR });
    expect(create.body.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(create.body.thread).toBe(create.body.id);
    expect(create.body.id).toBe(await computeOpId(create.body));
    expect(again.body.id).not.toBe(create.body.id);
    const reply = await log.append(me, "Sam", {
      kind: "reply",
      thread: create.body.id,
      target: create.body.id,
      text: "same",
    });
    expect(reply.body.id).toBe(await computeOpId(reply.body));
  });

  it("never lets another writer take over an op's id with different words", async () => {
    const victim = await createIdentity();
    const mallory = await createIdentity();
    const origin = new OpLog("doc");
    const real = await origin.append(victim, "Vic", { kind: "create", text: "victim text", anchor: ANCHOR });
    const copy = await signOp(
      { ...real.body, author: mallory.publicKey, name: "Mal", text: "mallory text" },
      mallory,
    );
    const sawCopyFirst = new OpLog("doc");
    expect(await sawCopyFirst.add([copy])).toEqual([]);
    expect(await sawCopyFirst.add([real])).toHaveLength(1);
    const sawRealFirst = new OpLog("doc");
    expect(await sawRealFirst.add([real])).toHaveLength(1);
    expect(await sawRealFirst.add([copy])).toEqual([]);
    for (const peer of [sawCopyFirst, sawRealFirst]) {
      expect(peer.threads().map((t) => t.root.text)).toEqual(["victim text"]);
    }
  });

  it("drops an authentic op whose id was swapped for another, even when re-signed by its author", async () => {
    const me = await createIdentity();
    const log = new OpLog("doc");
    const create = await log.append(me, "Sam", { kind: "create", text: "hi", anchor: ANCHOR });
    const reply = await log.append(me, "Sam", {
      kind: "reply",
      thread: create.body.id,
      target: create.body.id,
      text: "again",
    });
    const id = randomId();
    const createSwapped = await signOp({ ...create.body, id, thread: id }, me);
    const replySwapped = await signOp({ ...reply.body, id: randomId() }, me);
    const fresh = new OpLog("doc");
    expect(await fresh.add([createSwapped, replySwapped])).toEqual([]);
    expect(await fresh.add([create, reply])).toHaveLength(2);
  });
});

/** A create op signed by `who` with a correct content-derived id, bypassing OpLog.append's checks. */
async function createSignedBy(
  who: Awaited<ReturnType<typeof createIdentity>>,
  fields: { text: string; clock: number; at?: number },
) {
  const body: OpBody = {
    v: 1,
    id: "",
    kind: "create",
    doc: "doc",
    thread: "",
    anchor: ANCHOR,
    author: who.publicKey,
    name: "Eve",
    at: 1,
    ...fields,
  };
  body.id = body.thread = await computeOpId(body);
  return signOp(body, who);
}
