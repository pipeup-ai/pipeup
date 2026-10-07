import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { sign, verify } from "../src/crypto/identity";
import { OpLog } from "../src/model/log";
import type { SignedOp } from "../src/model/types";
import { IndexedDbStore } from "../src/storage/indexeddb";
import { loadOrCreateProfile, MemoryStore, type OpStore } from "../src/storage/store";
import { utf8 } from "../src/util/encoding";

const ANCHOR = { path: "", fingerprint: "00000000", snapshot: "x" };
let n = 0;
const stores: Array<[string, () => Promise<OpStore>]> = [
  ["MemoryStore", async () => new MemoryStore()],
  ["IndexedDbStore", () => IndexedDbStore.open(`pipeup-test-${++n}`)],
];

describe.each(stores)("%s", (_name, make) => {
  it("stores ops per document, without duplicates", async () => {
    const store = await make();
    const profile = await loadOrCreateProfile(store, "Sam");
    const log = new OpLog("doc-a");
    const op = await log.append(profile.identity, profile.name, {
      kind: "create",
      text: "hi",
      anchor: ANCHOR,
    });
    await store.append("doc-a", [op]);
    await store.append("doc-a", [op]);
    expect(await store.load("doc-a")).toEqual([op]);
    expect(await store.load("doc-b")).toEqual([]);
  });

  it("creates a profile once and keeps a working, private signing key", async () => {
    const store = await make();
    const first = await loadOrCreateProfile(store, "Sam");
    const again = await loadOrCreateProfile(store, "Someone else");
    expect(again.name).toBe("Sam");
    expect(again.identity.publicKey).toBe(first.identity.publicKey);
    expect(again.identity.privateKey.extractable).toBe(false);
    const sig = await sign(again.identity, utf8("x"));
    expect(await verify(first.identity.publicKey, utf8("x"), sig)).toBe(true);
  });

  it("creates a profile with no name, and treats the old default name as none", async () => {
    const store = await make();
    expect((await loadOrCreateProfile(store)).name).toBe("");
    const old = await make();
    const legacy = await loadOrCreateProfile(old, "Reviewer");
    const again = await loadOrCreateProfile(old);
    expect(again.name).toBe("");
    expect(again.identity.publicKey).toBe(legacy.identity.publicKey);
  });

  it("keeps one identity when two callers race to create a profile", async () => {
    const store = await make();
    const [a, b] = await Promise.all([loadOrCreateProfile(store, "A"), loadOrCreateProfile(store, "B")]);
    expect(a.identity.publicKey).toBe(b.identity.publicKey);
    expect((await store.loadProfile())?.identity.publicKey).toBe(a.identity.publicKey);
  });
});

describe("IndexedDbStore", () => {
  it("lets another tab upgrade the database instead of blocking it", async () => {
    const name = `pipeup-test-upgrade-${++n}`;
    await IndexedDbStore.open(name);
    await new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 2);
      r.onsuccess = () => {
        r.result.close();
        resolve(undefined);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("blocked"));
    });
  });

  it("aborts the whole write when one op cannot be stored", async () => {
    const store = await IndexedDbStore.open(`pipeup-test-abort-${++n}`);
    const profile = await loadOrCreateProfile(store, "Sam");
    const log = new OpLog("doc");
    const good = await log.append(profile.identity, "Sam", {
      kind: "create",
      text: "hi",
      anchor: ANCHOR,
    });
    const bad = {
      ...good,
      body: { ...good.body, id: "U".repeat(43) },
      extra: () => 1,
    } as unknown as SignedOp;
    await expect(store.append("doc", [good, bad])).rejects.toThrow();
    expect(await store.load("doc")).toEqual([]);
    await store.append("doc", [good]);
    expect(await store.load("doc")).toEqual([good]);
  });

  it("persists across reopening", async () => {
    const name = `pipeup-test-persist-${++n}`;
    const first = await IndexedDbStore.open(name);
    const profile = await loadOrCreateProfile(first, "Sam");
    const log = new OpLog("doc");
    const op = await log.append(profile.identity, "Sam", {
      kind: "create",
      text: "hi",
      anchor: ANCHOR,
    });
    await first.append("doc", [op]);
    first.close();
    const second = await IndexedDbStore.open(name);
    expect(await second.load("doc")).toEqual([op]);
    expect((await second.loadProfile())?.identity.publicKey).toBe(profile.identity.publicKey);
  });
});
