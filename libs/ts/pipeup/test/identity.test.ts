import { describe, expect, it, vi } from "vitest";
import { createIdentity, sign, verify, verifyKeyCacheSize } from "../src/crypto/identity";
import { fromB64u, toB64u, utf8 } from "../src/util/encoding";

describe("identity", () => {
  it("signs and verifies", async () => {
    const me = await createIdentity();
    expect(me.publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const data = utf8("hello");
    const sig = await sign(me, data);
    expect(sig).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(await verify(me.publicKey, data, sig)).toBe(true);
  });

  it("rejects altered data, other keys and garbage", async () => {
    const me = await createIdentity();
    const other = await createIdentity();
    const sig = await sign(me, utf8("hello"));
    expect(await verify(me.publicKey, utf8("hellO"), sig)).toBe(false);
    expect(await verify(other.publicKey, utf8("hello"), sig)).toBe(false);
    expect(await verify("not-a-key", utf8("hello"), sig)).toBe(false);
    expect(await verify(me.publicKey, utf8("hello"), "AAAA")).toBe(false);
  });

  it("keeps the private key non-extractable", async () => {
    const me = await createIdentity();
    expect(me.privateKey.extractable).toBe(false);
  });

  it("caps the verify-key cache", async () => {
    const data = utf8("x");
    const sig = await sign(await createIdentity(), data);
    for (let i = 0; i < 600; i++) await verify((await createIdentity()).publicKey, data, sig);
    expect(verifyKeyCacheSize()).toBeLessThanOrEqual(512);
  });

  it("rejects non-canonical aliases of a real key", async () => {
    const me = await createIdentity();
    const data = utf8("hello");
    const sig = await sign(me, data);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = alphabet.indexOf(me.publicKey.slice(-1));
    const alias = me.publicKey.slice(0, -1) + alphabet[last ^ 1];
    expect(alias).not.toBe(me.publicKey);
    expect(fromB64u(alias)).toEqual(fromB64u(me.publicKey));
    expect(toB64u(fromB64u(alias))).toBe(me.publicKey);
    expect(await verify(me.publicKey, data, sig)).toBe(true);
    expect(await verify(alias, data, sig)).toBe(false);
  });

  it("does not cache keys that fail to import", async () => {
    // Fresh module state so the cache starts empty and the size is exact.
    vi.resetModules();
    const fresh = await import("../src/crypto/identity");
    const me = await fresh.createIdentity();
    const data = utf8("x");
    const sig = await fresh.sign(me, data);
    expect(await fresh.verify(me.publicKey, data, sig)).toBe(true);
    expect(fresh.verifyKeyCacheSize()).toBe(1);
    // Node's WebCrypto accepts every 32-byte string as a raw Ed25519 key, so force the rejection.
    const spy = vi.spyOn(crypto.subtle, "importKey").mockRejectedValue(new Error("bad point"));
    try {
      expect(await fresh.verify("A".repeat(43), data, sig)).toBe(false);
      await Promise.resolve();
      expect(fresh.verifyKeyCacheSize()).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
