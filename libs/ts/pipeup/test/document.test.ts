import { describe, expect, it, vi } from "vitest";
import { newDocumentAttribute, parseDocumentAttribute } from "../src/crypto/seal";
import { PipeupDocument, UnsavedChangeError } from "../src/document";
import { loadOrCreateProfile, MemoryStore } from "../src/storage/store";
import { createIdentity } from "../src/crypto/identity";
import { computeOpId } from "../src/model/opid";
import { MAX_AT, MAX_CLOCK, MAX_TEXT, signOp } from "../src/model/ops";
import type { OpBody, SignedOp } from "../src/model/types";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };

async function reviewer(name: string, doc: string, key: CryptoKey | null) {
  const store = new MemoryStore();
  const profile = await loadOrCreateProfile(store, name);
  return PipeupDocument.open({ doc, key, store, identity: profile.identity, name });
}

/** An op by a fresh identity, with a correct content id; a create at the clock cap by default. */
async function foreign(over: Partial<OpBody> = {}): Promise<SignedOp> {
  const eve = await createIdentity();
  const body: OpBody = {
    v: 1,
    id: "",
    kind: "create",
    doc: "doc",
    thread: "",
    anchor: ANCHOR,
    text: "x",
    author: eve.publicKey,
    name: "Eve",
    clock: MAX_CLOCK,
    at: 1,
    ...over,
  };
  body.id = await computeOpId(body);
  if (body.kind === "create") body.thread = body.id;
  return signOp(body, eve);
}
const capOp = () => foreign();
const fileOf = (ops: SignedOp[]) => JSON.stringify({ pipeup: 1, doc: "doc", sealed: false, ops });

/** Opens a document that has already seen another writer's op at the clock cap. */
async function saturated(name = "Sam", op?: SignedOp) {
  const store = new MemoryStore();
  const profile = await loadOrCreateProfile(store, name);
  const d = await PipeupDocument.open({ doc: "doc", key: null, store, identity: profile.identity, name });
  const file = JSON.stringify({ pipeup: 1, doc: "doc", sealed: false, ops: [op ?? (await capOp())] });
  expect(await d.importFile(file)).toBe(1);
  return { d, store };
}

class FlakyStore extends MemoryStore {
  failures = 1;
  override async append(doc: string, ops: SignedOp[]): Promise<void> {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error("disk full");
    }
    await super.append(doc, ops);
  }
}

async function flaky(doc: string) {
  const store = new FlakyStore();
  const profile = await loadOrCreateProfile(store, "Sam");
  const open = () => PipeupDocument.open({ doc, key: null, store, identity: profile.identity, name: "Sam" });
  return { store, open, d: await open() };
}

describe("PipeupDocument", () => {
  it("comments, replies one level under the comment, resolves and reopens", async () => {
    const d = await reviewer("Sam", "doc", null);
    const t = await d.comment(ANCHOR, "  Is 20% realistic?  ");
    const r = await d.reply(t, "Fair point");
    await d.reply(r, "Answering the reply");
    await d.reply(t, "Back to the comment");
    const thread = d.threads()[0]!;
    expect(thread.root.text).toBe("Is 20% realistic?");
    expect(thread.root.replies.map((c) => c.text)).toEqual([
      "Fair point",
      "Answering the reply",
      "Back to the comment",
    ]);
    await d.resolve(t);
    expect(d.threads()[0]?.resolved).toBe(true);
    await d.reopen(t);
    expect(d.threads()[0]?.resolved).toBe(false);
  });

  it("notifies listeners and stops when unsubscribed", async () => {
    const d = await reviewer("Sam", "doc", null);
    const fn = vi.fn();
    const off = d.onChange(fn);
    await d.comment(ANCHOR, "one");
    off();
    await d.comment(ANCHOR, "two");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejects empty and over-long comments", async () => {
    const d = await reviewer("Sam", "doc", null);
    await expect(d.comment(ANCHOR, "   ")).rejects.toThrow(/some words/);
    await expect(d.comment(ANCHOR, "x".repeat(10_001))).rejects.toThrow(/10000 characters/);
  });

  it("lets only the writer edit or delete", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const amy = await reviewer("Amy", doc.id, doc.key);
    const ben = await reviewer("Ben", doc.id, doc.key);
    const t = await amy.comment(ANCHOR, "original");
    await ben.importFile(await amy.exportFile());
    await expect(ben.edit(t, "hijack")).rejects.toThrow(/only the writer/);
    await amy.edit(t, "better");
    expect(amy.threads()[0]?.root.text).toBe("better");
    expect(amy.threads()[0]?.root.edited).toBe(true);
    await amy.remove(t);
    expect(amy.threads()[0]?.root.deleted).toBe(true);
  });

  it("merges feedback files both ways and persists what it learns", async () => {
    const doc = await parseDocumentAttribute(newDocumentAttribute());
    const store = new MemoryStore();
    const profile = await loadOrCreateProfile(store, "Sam");
    const author = await PipeupDocument.open({
      doc: doc.id,
      key: doc.key,
      store,
      identity: profile.identity,
      name: "Sam",
    });
    const reviewerA = await reviewer("Amy", doc.id, doc.key);
    const reviewerB = await reviewer("Ben", doc.id, doc.key);
    await reviewerA.comment(ANCHOR, "From Amy");
    await reviewerB.comment(ANCHOR, "From Ben");
    expect(await author.importFile(await reviewerA.exportFile())).toBe(1);
    expect(await author.importFile(await reviewerB.exportFile())).toBe(1);
    expect(await author.importFile(await reviewerA.exportFile())).toBe(0);
    expect(
      author
        .threads()
        .map((t) => t.root.text)
        .sort(),
    ).toEqual(["From Amy", "From Ben"]);

    const reopened = await PipeupDocument.open({
      doc: doc.id,
      key: doc.key,
      store,
      identity: profile.identity,
      name: "Sam",
    });
    expect(reopened.threads()).toHaveLength(2);
  });

  it("drops forged ops inside an imported file", async () => {
    const amy = await reviewer("Amy", "doc", null);
    await amy.comment(ANCHOR, "real");
    const file = JSON.parse(await amy.exportFile());
    file.ops[0].body.text = "forged";
    const sam = await reviewer("Sam", "doc", null);
    expect(await sam.importFile(JSON.stringify(file))).toBe(0);
    expect(sam.threads()).toEqual([]);
  });

  it("uses the current name on new comments", async () => {
    const d = await reviewer("Sam", "doc", null);
    d.name = "Kev";
    await d.comment(ANCHOR, "hi");
    expect(d.threads()[0]?.root.name).toBe("Kev");
    expect(() => {
      d.name = "  ";
    }).toThrow(/a name/);
  });

  it("comments without a name, and shows the name added later on those comments", async () => {
    const d = await reviewer("", "doc", null);
    expect(d.name).toBe("");
    await d.comment(ANCHOR, "hi");
    expect(d.threads()[0]?.root.name).toBe("");
    const seen = vi.fn();
    d.onChange(seen);
    d.name = "Sam";
    expect(seen).toHaveBeenCalledTimes(1);
    expect(d.threads()[0]?.root.name).toBe("Sam");
  });

  it("shows the current name on your unnamed comments, even after an older name of yours", async () => {
    const d = await reviewer("", "doc", null);
    const id = await d.comment(ANCHOR, "unnamed");
    d.name = "Old";
    await d.reply(id, "as Old");
    d.name = "New";
    const root = d.threads()[0]!.root;
    expect(root.name).toBe("New");
    expect(root.replies[0]!.name).toBe("Old");
  });

  it("keeps a name on one line: pasted newlines and runs of spaces become one space", async () => {
    const d = await reviewer("", "doc", null);
    d.name = " Sam\n\t Lee ";
    expect(d.name).toBe("Sam Lee");
  });

  it("refuses a document id that no change could be recorded under", async () => {
    const store = new MemoryStore();
    const profile = await loadOrCreateProfile(store, "Sam");
    for (const doc of ["", "x".repeat(65)]) {
      await expect(
        PipeupDocument.open({ doc, key: null, store, identity: profile.identity, name: "Sam" }),
      ).rejects.toThrow(/pipeup: .*document id/);
    }
  });

  it("keeps a change that failed to save, tells listeners, and saves it on flush", async () => {
    const { store, open, d } = await flaky("doc");
    const fn = vi.fn();
    d.onChange(fn);
    await expect(d.comment(ANCHOR, "kept")).rejects.toBeInstanceOf(UnsavedChangeError);
    expect(d.threads()).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await store.load("doc")).toHaveLength(0);
    await d.flush();
    expect(await store.load("doc")).toHaveLength(1);
    expect((await open()).threads()[0]?.root.text).toBe("kept");
  });

  it("rethrows from flush while the store still fails, then recovers", async () => {
    const { store, d } = await flaky("doc");
    store.failures = 2;
    await expect(d.comment(ANCHOR, "kept")).rejects.toBeInstanceOf(UnsavedChangeError);
    await expect(d.flush()).rejects.toThrow("disk full");
    await d.flush();
    expect(await store.load("doc")).toHaveLength(1);
  });

  it("saves unsaved imported changes on flush", async () => {
    const amy = await reviewer("Amy", "doc", null);
    await amy.comment(ANCHOR, "from Amy");
    const { store, d } = await flaky("doc");
    const err = await d.importFile(await amy.exportFile()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsavedChangeError);
    expect((err as UnsavedChangeError).id).toBe(d.threads()[0]?.id);
    expect((err as UnsavedChangeError).count).toBe(1);
    expect((err as UnsavedChangeError).cause).toEqual(new Error("disk full"));
    expect(d.threads()).toHaveLength(1);
    await d.flush();
    expect(await store.load("doc")).toHaveLength(1);
  });

  it("reports an import that changed nothing as 0 even while earlier changes are unsaved", async () => {
    const amy = await reviewer("Amy", "doc", null);
    await amy.comment(ANCHOR, "from Amy");
    const file = await amy.exportFile();
    const { store, d } = await flaky("doc");
    await expect(d.importFile(file)).rejects.toBeInstanceOf(UnsavedChangeError);
    store.failures = 0;
    expect(await d.importFile(file)).toBe(0);
    expect(await store.load("doc")).toHaveLength(1);
  });

  it("applies simultaneous writes in call order with distinct clocks", async () => {
    const store = new MemoryStore();
    const profile = await loadOrCreateProfile(store, "Sam");
    const o = { doc: "doc", key: null, store, identity: profile.identity, name: "Sam" };
    const d = await PipeupDocument.open(o);
    const t = await d.comment(ANCHOR, "x");
    await Promise.all([d.resolve(t), d.reopen(t)]);
    expect(d.threads()[0]?.resolved).toBe(false);
    const clocks = (await store.load("doc")).map((op) => op.body.clock);
    expect(new Set(clocks).size).toBe(3);
    expect((await PipeupDocument.open(o)).threads()[0]?.resolved).toBe(false);
  });

  it("does not double count the same file imported twice at once", async () => {
    const amy = await reviewer("Amy", "doc", null);
    await amy.comment(ANCHOR, "a");
    await amy.comment(ANCHOR, "b");
    const file = await amy.exportFile();
    const d = await reviewer("Sam", "doc", null);
    const counts = await Promise.all([d.importFile(file), d.importFile(file)]);
    expect(counts[0]! + counts[1]!).toBe(2);
  });

  it("keeps writing and notifying when a listener throws", async () => {
    const store = new MemoryStore();
    const profile = await loadOrCreateProfile(store, "Sam");
    const d = await PipeupDocument.open({
      doc: "doc",
      key: null,
      store,
      identity: profile.identity,
      name: "Sam",
    });
    const after = vi.fn();
    d.onChange(() => {
      throw new Error("listener broke");
    });
    d.onChange(after);
    const id = await d.comment(ANCHOR, "still saved");
    expect(after).toHaveBeenCalledTimes(1);
    expect((await store.load("doc")).map((op) => op.body.id)).toEqual([id]);
  });

  it("reports a listener's error to the host page without stopping", async () => {
    const reportError = vi.fn();
    vi.stubGlobal("reportError", reportError);
    try {
      const d = await reviewer("Sam", "doc", null);
      const broke = new Error("listener broke");
      d.onChange(() => {
        throw broke;
      });
      await d.comment(ANCHOR, "x");
      expect(reportError).toHaveBeenCalledWith(broke);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps one writer's edits in order once the clock is at the cap", async () => {
    for (let i = 0; i < 20; i++) {
      const { d } = await saturated();
      const t = await d.comment(ANCHOR, "v1");
      await d.edit(t, "v2");
      await d.edit(t, "v3");
      expect(d.threads().find((x) => x.id === t)?.root.text).toBe("v3");
    }
  });

  it("keeps resolve then reopen in order once the clock is at the cap", async () => {
    for (let i = 0; i < 20; i++) {
      const { d } = await saturated();
      const t = await d.comment(ANCHOR, "x");
      await d.resolve(t);
      await d.reopen(t);
      expect(d.threads().find((x) => x.id === t)?.resolved).toBe(false);
    }
  });

  it("records the same change twice at once when the clock is at the cap", async () => {
    const { d, store } = await saturated();
    const t = await d.comment(ANCHOR, "x");
    await Promise.all([d.resolve(t), d.resolve(t)]);
    const resolves = (await store.load("doc")).filter((op) => op.body.kind === "resolve");
    expect(resolves).toHaveLength(2);
    expect(new Set(resolves.map((op) => op.body.id)).size).toBe(2);
  });

  it("keeps a reply and resolve after the comment they answer when the writer's clock is behind", async () => {
    for (let i = 0; i < 20; i++) {
      const cap = await capOp();
      const { d: sam } = await saturated("Sam", cap);
      const { d: bob } = await saturated("Bob", cap);
      const t = await sam.comment(ANCHOR, "Sam's comment");
      await bob.importFile(await sam.exportFile());
      const real = Date.now();
      const behind = vi.spyOn(Date, "now").mockReturnValue(real - 5000);
      try {
        await bob.reply(t, "Bob's reply");
        await bob.resolve(t);
      } finally {
        behind.mockRestore();
      }
      await sam.importFile(await bob.exportFile());
      for (const view of [bob, sam]) {
        const thread = view.threads().find((x) => x.id === t);
        expect(thread?.root.replies.map((r) => r.text)).toEqual(["Bob's reply"]);
        expect(thread?.resolved).toBe(true);
      }
    }
  });

  it("keeps a thread writable after someone posts in it at the time cap", async () => {
    const d = await reviewer("Sam", "doc", null);
    const t = await d.comment(ANCHOR, "Sam's comment");
    const hostile = await foreign({
      kind: "reply",
      thread: t,
      target: t,
      anchor: undefined,
      clock: 5,
      at: MAX_AT,
    });
    expect(await d.importFile(fileOf([hostile]))).toBe(1);
    await d.reply(t, "still here");
    await d.resolve(t);
    const thread = d.threads().find((x) => x.id === t);
    expect(thread?.root.replies.map((r) => r.text)).toContain("still here");
    expect(thread?.resolved).toBe(true);
    const other = await d.comment(ANCHOR, "elsewhere");
    await d.reply(other, "fine");
    expect(d.threads().find((x) => x.id === other)?.root.replies[0]?.at).toBeLessThan(MAX_AT);
  });

  it("treats an identical change at both caps as already recorded", async () => {
    const d = await reviewer("Sam", "doc", null);
    const t = await d.comment(ANCHOR, "Sam's comment");
    const hostile = await foreign({
      kind: "reply",
      thread: t,
      target: t,
      anchor: undefined,
      clock: MAX_CLOCK,
      at: MAX_AT,
    });
    expect(await d.importFile(fileOf([hostile]))).toBe(1);
    await d.resolve(t);
    await expect(d.resolve(t)).resolves.toBeUndefined();
    const resolves = JSON.parse(await d.exportFile()).ops.filter((o: SignedOp) => o.body.kind === "resolve");
    expect(resolves).toHaveLength(1);
    expect(d.threads().find((x) => x.id === t)?.resolved).toBe(true);
  });
});

describe("changes the store could not save", () => {
  async function flaky() {
    const inner = new MemoryStore();
    let failNext = false;
    const store = Object.create(inner) as MemoryStore;
    store.append = async (...a: Parameters<MemoryStore["append"]>) => {
      if (failNext) {
        failNext = false;
        throw new Error("disk full");
      }
      return inner.append(...a);
    };
    const profile = await loadOrCreateProfile(inner, "Ann");
    const doc = await PipeupDocument.open({
      doc: "doc",
      key: null,
      store,
      identity: profile.identity,
      name: "Ann",
    });
    return { doc, fail: () => (failNext = true) };
  }

  it("a comment that could not be saved is reported with its id, and is shown", async () => {
    const { doc, fail } = await flaky();
    fail();
    const err = await doc.comment(ANCHOR, "hello").catch((e) => e);
    expect(err).toBeInstanceOf(UnsavedChangeError);
    expect(doc.threads().map((t) => t.id)).toEqual([err.id]);
  });

  it("a reply that could not be saved is reported with its id", async () => {
    const { doc, fail } = await flaky();
    const root = await doc.comment(ANCHOR, "hello");
    fail();
    const err = await doc.reply(root, "again").catch((e) => e);
    expect(err).toBeInstanceOf(UnsavedChangeError);
    expect(doc.threads()[0]!.root.replies.map((r) => r.id)).toEqual([err.id]);
  });

  it("a comment that is not valid fails with the plain error", async () => {
    const { doc } = await flaky();
    const err = await doc.comment(ANCHOR, "x".repeat(MAX_TEXT + 1)).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(UnsavedChangeError);
    expect(doc.threads()).toHaveLength(0);
  });
});
