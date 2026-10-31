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

  it("says why one of my comments isn't in the shared copy: held, kept while not sending, by choice, or its thread", async () => {
    const { me, other } = await setup();
    const early = await me.comment(A, "early");
    const theirs = await other.comment(A, "from Ada");
    await me.merge(other.ops(), "share");
    const p = new Policy(me.me);
    p.hold(me.ops().filter((o) => o.body.id === early));
    p.recv.add(theirs);
    const op = (id: string) => me.ops().find((o) => o.body.id === id)!;
    const placed = (id: string) => (p.sendable(op(id)), p.local(op(id)));
    expect(p.local(op(early))).toBe("held");
    expect(p.local(op(theirs))).toBeNull();
    const later = await me.reply(early, "more on it");
    expect(placed(later)).toBe("thread");
    const sent = await me.comment(A, "sent");
    expect(placed(sent)).toBeNull();
    p.send = false;
    // Sent before sending was turned off: reading never places it again, so it stays unmarked.
    expect(p.local(op(sent))).toBeNull();
    const quiet = await me.comment(A, "while not sending");
    expect(placed(quiet)).toBe("kept");
    const reply = await me.reply(theirs, "my reply in Ada's thread");
    expect(placed(reply)).toBe("kept");
    p.decide(false);
    expect(p.local(op(early))).toBe("chosen");
    expect(p.local(op(later))).toBe("thread");
  });

  it("an earlier comment shared by choice is no longer local", async () => {
    const { me } = await setup();
    await me.comment(A, "early");
    const p = new Policy(me.me);
    p.hold(me.ops());
    expect(p.local(me.ops()[0]!)).toBe("held");
    p.decide(true);
    expect(p.local(me.ops()[0]!)).toBeNull();
  });

  it("comments kept by an earlier version that didn't say why get a reason that is true either way", async () => {
    const { me } = await setup();
    const kept = await me.comment(A, "kept before");
    const p = new Policy(me.me, {
      init: true,
      held: [],
      kept: [kept],
      recv: [],
      send: true,
      noted: false,
      gen: null,
    });
    expect(p.local(me.ops()[0]!)).toBe("unknown");
    // Saved and loaded again, the reason stays unknown rather than turning into "while not sending".
    const again = new Policy(me.me, structuredClone(p.saved()));
    expect(again.local(me.ops()[0]!)).toBe("unknown");
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
    const q = new Policy(me.me, p.saved());
    await me.comment(A, "new");
    q.hold(me.ops());
    expect(q.held.size).toBe(1);
  });

  it("passes on a listed agent's replies while sending, never an unlisted writer's, and holds them with an unshared comment", async () => {
    const { me } = await setup();
    const muse = await reviewer("Muse");
    const lee = await reviewer("Lee");
    const early = await me.comment(A, "early");
    const p = new Policy(me.me, undefined, () => [muse.me]);
    p.hold(me.ops());
    const later = await me.comment(A, "later");
    for (const w of [muse, lee]) await w.merge(me.ops(), "file");
    const onLater = await muse.reply(later, "Done.");
    const onEarly = await muse.reply(early, "Done too.");
    const byLee = await lee.reply(later, "Me too.");
    await me.merge([...muse.ops(), ...lee.ops()], "agents");
    const sent = () =>
      me
        .ops()
        .filter((o) => p.sendable(o))
        .map((o) => o.body.id);
    expect(sent()).toEqual(expect.arrayContaining([later, onLater]));
    expect(sent()).not.toContain(onEarly);
    expect(sent()).not.toContain(byLee);
    // Sharing the earlier comments lets the agent's answer to them go too.
    p.decide(true);
    expect(sent()).toContain(onEarly);
    // Not sending: nothing of the agent's goes either, and it isn't kept as mine.
    p.send = false;
    expect(sent()).not.toContain(onLater);
    expect(p.kept.has(onLater)).toBe(false);
  });

  it("is saved as plain data the store can clone, even with the page's agents to ask", async () => {
    const { me } = await setup();
    await me.comment(A, "mine");
    const p = new Policy(me.me, undefined, () => ["agent-key"]);
    p.hold(me.ops());
    const again = new Policy(me.me, structuredClone(p.saved()));
    expect([...again.held]).toEqual([...p.held]);
  });
});
