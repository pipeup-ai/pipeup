// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { findWork, inboxId, keyFrom, open, seal, signedBy, b64u } from "../src/crypto";
import { safeLink, serviceOf } from "../src/addon";

// The server's own implementation of the address and the proof of work: the two must agree.
// @ts-expect-error: plain JavaScript
import { inboxId as serverInboxId, work as serverWork } from "../../../../../services/mailbox/src/inbox.mjs";

const ed = async () => {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const sign = async (purpose: string, data: string) =>
    b64u(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          pair.privateKey,
          new TextEncoder().encode(`pipeup:${purpose}\n${data}`),
        ),
      ),
    );
  return { pub, sign };
};

describe("an inbox address", () => {
  it("is the same here and on the server, 26 characters from a public key", async () => {
    const a = await ed();
    const id = await inboxId(a.pub);
    expect(id).toMatch(/^[0-9A-Z]{26}$/);
    expect(id).toBe(serverInboxId(a.pub));
    expect(await inboxId((await ed()).pub)).not.toBe(id);
  });
});

describe("the proof of work", () => {
  it("is found here and accepted by the server's check", async () => {
    const a = await ed();
    const id = await inboxId(a.pub);
    const ct = "pi1.abc";
    const nonce = await findWork(id, ct, 8);
    expect(serverWork(id, ct, nonce, 8)).toBe(true);
    expect(serverWork(id, ct, `${nonce}x`, 12)).toBe(false);
  });
});

describe("the encryption key made from an identity", () => {
  it("is the same every time for the same signature, and different for another identity", async () => {
    const a = await ed();
    const s1 = await a.sign("inbox/seed", "x25519");
    expect(s1).toBe(await a.sign("inbox/seed", "x25519"));
    const k1 = await keyFrom(s1);
    const k2 = await keyFrom(s1);
    expect(k1.publicKey).toBe(k2.publicKey);
    expect(k1.publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await keyFrom(await (await ed()).sign("inbox/seed", "x25519"))).publicKey).not.toBe(k1.publicKey);
  });
});

describe("a sealed note", () => {
  it("is opened by the person it was sealed to, and by nobody else", async () => {
    const sam = await keyFrom(await (await ed()).sign("inbox/seed", "x25519"));
    const eve = await keyFrom(await (await ed()).sign("inbox/seed", "x25519"));
    const ct = await seal(sam.publicKey, "Hi @Sam, ready? 👍");
    expect(ct).toMatch(/^pi1\.[A-Za-z0-9_-]+$/);
    // The words are not in it, whichever way it is read (a short word could turn up in base64 by chance).
    expect(ct).not.toContain("Hi @Sam");
    expect(atob(ct.slice(4).replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("Hi @Sam");
    expect(await open(sam, ct)).toBe("Hi @Sam, ready? 👍");
    expect(await open(eve, ct)).toBeNull();
  });

  it("is refused when it has been changed, and two seals of one text differ", async () => {
    const sam = await keyFrom(await (await ed()).sign("inbox/seed", "x25519"));
    const ct = await seal(sam.publicKey, "x");
    const changed = `${ct.slice(0, -4)}${ct.slice(-4) === "AAAA" ? "BBBB" : "AAAA"}`;
    expect(await open(sam, changed)).toBeNull();
    expect(await seal(sam.publicKey, "x")).not.toBe(ct);
    expect(await open(sam, "pi1.")).toBeNull();
  });
});

describe("who a note is from", () => {
  it("is checked against the sender's own signature on the framed text", async () => {
    const a = await ed();
    const sig = await a.sign("inbox/note", "text");
    expect(await signedBy(a.pub, "inbox/note", "text", sig)).toBe(true);
    expect(await signedBy(a.pub, "inbox/note", "other", sig)).toBe(false);
    expect(await signedBy(a.pub, "inbox/delete", "text", sig)).toBe(false);
    expect(await signedBy((await ed()).pub, "inbox/note", "text", sig)).toBe(false);
  });
});

describe("the service and the links", () => {
  it("is https, or http only on this computer", () => {
    const html = document.createElement("html");
    const at = (v: string) => (html.setAttribute("data-pipeup-inbox", v), serviceOf(html));
    expect(at("https://inbox.example.org/pipeup")).toBe("https://inbox.example.org/pipeup");
    expect(at("http://localhost:8787")).toBe("http://localhost:8787");
    expect(at("http://127.0.0.1:1")).toBe("http://127.0.0.1:1");
    for (const bad of ["http://inbox.example.org", "javascript:alert(1)", "", "not a url", "ftp://x.test"])
      expect(at(bad)).toBe("");
  });

  it("in a note are opened only if ordinary web or file addresses", () => {
    expect(safeLink("https://x.test/p")).toBeTruthy();
    expect(safeLink("file:///a/b.html")).toBeTruthy();
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "not a link"])
      expect(safeLink(bad)).toBeNull();
  });
});
