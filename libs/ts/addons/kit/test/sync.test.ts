// @vitest-environment jsdom
import type { Listener, SignedOp } from "pipeup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { idDigest, SyncEngine } from "../src/sync";
import { RetryAfter, type Transport } from "../src/transport";

const op = (id: string, author = "me"): SignedOp => ({ body: { v: 1, id, author } as never, sig: "s" });

/** A document stand-in: ops, a listener set, and a merge that keeps what a verifier would (anything but "junk"). */
function fakeDoc() {
  const ops = new Map<string, SignedOp>();
  const listeners = new Set<Listener>();
  return {
    ops: () => [...ops.values()],
    onChange: (fn: Listener) => (listeners.add(fn), () => listeners.delete(fn)),
    merge: vi.fn(async (incoming: readonly unknown[]) => {
      const added = (incoming as SignedOp[]).filter((o) => o.body.id !== "junk" && !ops.has(o.body.id));
      for (const o of added) ops.set(o.body.id, o);
      if (added.length) for (const fn of listeners) fn([], added, "share");
      return added.length;
    }),
    write(o: SignedOp) {
      ops.set(o.body.id, o);
      for (const fn of listeners) fn([], [o], "local");
    },
  };
}

function fakeTransport(remote: string[] = []) {
  const sent: SignedOp[][] = [];
  let deliver: (ops: unknown[]) => void = () => {};
  let failures: unknown[] = [];
  const t: Transport & { push(ops: unknown[]): void; fail(...e: unknown[]): void; sent: SignedOp[][] } = {
    id: "share",
    sent,
    start: async (d) => void (deliver = d),
    send: async (ops) => {
      const f = failures.shift();
      if (f) throw f;
      sent.push([...ops]);
    },
    remoteIds: async () => new Set(remote),
    stop: () => {},
    push: (ops) => deliver(ops),
    fail: (...e) => void (failures = e),
  };
  return t;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const engine = (
  doc: ReturnType<typeof fakeDoc>,
  transport: Transport,
  sendable = (o: SignedOp) => o.body.author === "me",
) =>
  new SyncEngine({
    id: "share",
    document: doc,
    merge: (o) => doc.merge(o),
    transport,
    sendable,
    signal: new AbortController().signal,
  });

describe("the sync engine", () => {
  it("sends only what the policy allows, and not what the remote already holds", async () => {
    const doc = fakeDoc();
    for (const o of [op("a"), op("b"), op("c", "ada")]) doc.write(o);
    const t = fakeTransport(["a"]);
    await engine(doc, t).start();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.sent.flat().map((o) => o.body.id)).toEqual(["b"]);
  });

  it("sends a change made later, once, and never an op it received from the remote", async () => {
    const doc = fakeDoc();
    const t = fakeTransport();
    await engine(doc, t).start();
    doc.write(op("a"));
    t.push([op("theirs", "ada")]);
    await vi.advanceTimersByTimeAsync(300);
    expect(t.sent.flat().map((o) => o.body.id)).toEqual(["a"]);
    expect(
      doc
        .ops()
        .map((o) => o.body.id)
        .sort(),
    ).toEqual(["a", "theirs"]);
  });

  it("batches inbound ops for 100 ms and merges them through the core's checks, remembering what was refused", async () => {
    const doc = fakeDoc();
    const t = fakeTransport();
    const e = engine(doc, t);
    await e.start();
    t.push([op("x", "ada")]);
    t.push([op("junk", "ada"), op("y", "ada")]);
    expect(doc.merge).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(doc.merge).toHaveBeenCalledTimes(1);
    expect([...e.rejected]).toEqual(["junk"]);
  });

  it("backs off after a failure, waits what a rate limit asks, and keeps working offline", async () => {
    const doc = fakeDoc();
    const t = fakeTransport();
    const e = engine(doc, t);
    await e.start();
    t.fail(new Error("offline"), new RetryAfter(30));
    doc.write(op("a"));
    await vi.advanceTimersByTimeAsync(10);
    expect(e.state).toBe("offline");
    expect(e.waiting).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(e.state).toBe("limited");
    await vi.advanceTimersByTimeAsync(40_000);
    expect(t.sent.flat().map((o) => o.body.id)).toEqual(["a"]);
    expect(e.state).toBe("idle");
    expect(e.waiting).toBe(0);
  });

  it("works the outbox out again after the send policy changes", async () => {
    const doc = fakeDoc();
    doc.write(op("a"));
    const t = fakeTransport();
    let allowed = false;
    const e = engine(doc, t, () => allowed);
    await e.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.sent).toHaveLength(0);
    allowed = true;
    e.rescan();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.sent.flat().map((o) => o.body.id)).toEqual(["a"]);
  });
});

describe("id digests", () => {
  it("do not depend on order, and differ when the sets do", async () => {
    expect(await idDigest(["b", "a"])).toBe(await idDigest(["a", "b"]));
    expect(await idDigest(["a"])).not.toBe(await idDigest(["a", "b"]));
    expect((await idDigest(["a", "b"])).startsWith("2.")).toBe(true);
  });
});
