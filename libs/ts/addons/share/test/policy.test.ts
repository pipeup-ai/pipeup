import { describe, expect, it } from "vitest";
import { Policy } from "../src/policy";
import { anchor, reviewer } from "./helpers";

const A = anchor;
async function setup() {
  const me = await reviewer("Sam");
  const other = await reviewer("Ada");
  return { me, other };
}

describe("send policy", () => {
  it("sends only my own comments, never someone else's that arrived by file or live", async () => {
    const { me, other } = await setup();
    const a = await other.comment(A, "from Ada");
    const mine = await me.comment(A, "from Sam");
    await me.merge(other.ops(), "file");
    const p = new Policy(me.me);
    p.hold([]);
    const ids = me
      .ops()
      .filter((o) => p.sendable(o))
      .map((o) => o.body.id);
    expect(ids).toEqual([mine]);
    expect(ids).not.toContain(a);
  });

  it("sends an op received from the shared copy (so a rollover or a new address carries it)", async () => {
    const { me, other } = await setup();
    const a = await other.comment(A, "from Ada");
    const p = new Policy(me.me);
    await me.merge(other.ops(), "share");
    expect(p.sendable(me.ops()[0]!)).toBe(false);
    p.recv.add(a);
    expect(p.sendable(me.ops()[0]!)).toBe(true);
  });

  it("holds earlier comments until the reviewer chooses; a reply in a held thread is held too", async () => {
    const { me } = await setup();
    const early = await me.comment(A, "early");
    const p = new Policy(me.me);
    p.hold(me.ops());
    expect(p.held.has(early)).toBe(true);
    const reply = await me.reply(early, "more");
    await me.edit(early, "edited");
    const sendable = me.ops().filter((o) => p.sendable(o));
    expect(sendable).toEqual([]);
    expect(p.held.has(reply)).toBe(true);
    p.decide(true);
    expect(me.ops().filter((o) => p.sendable(o))).toHaveLength(3);
    const later = await me.comment(A, "later");
    expect(p.sendable(me.ops().find((o) => o.body.id === later)!)).toBe(true);
    expect(p.noted).toBe(true);
  });

  it("keeping earlier comments keeps them out for good, including later edits and replies", async () => {
    const { me } = await setup();
    const early = await me.comment(A, "early");
    const p = new Policy(me.me);
    p.hold(me.ops());
    p.decide(false);
    await me.edit(early, "edited later");
    await me.reply(early, "a reply");
    await me.resolve(early);
    expect(me.ops().filter((o) => p.sendable(o))).toEqual([]);
    expect(p.kept.size).toBe(4);
  });

  it("with Send my comments off, new comments and their edits stay private; turning it on sends only later ones", async () => {
    const { me } = await setup();
    const p = new Policy(me.me);
    p.hold([]);
    p.send = false;
    const c1 = await me.comment(A, "private");
    expect(p.sendable(me.ops()[0]!)).toBe(false);
    p.send = true;
    await me.edit(c1, "still private");
    const ops = me.ops();
    expect(ops.filter((o) => p.sendable(o))).toEqual([]);
    const c2 = await me.comment(A, "public");
    expect(
      me
        .ops()
        .filter((o) => p.sendable(o))
        .map((o) => o.body.id),
    ).toEqual([c2]);
  });

  it("holds only once per document, and round-trips through save", async () => {
    const { me } = await setup();
    await me.comment(A, "early");
    const p = new Policy(me.me);
    p.hold(me.ops());
    const q = new Policy(me.me, { ...p });
    await me.comment(A, "new");
    q.hold(me.ops());
    expect(q.held.size).toBe(1);
  });
});
