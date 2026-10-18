import { describe, expect, it } from "vitest";
import { codeOf, keyFromCode, keyOf, makePortable } from "../src/code";

const pub = async (key: CryptoKey) => (await crypto.subtle.exportKey("jwk", key)).x;
const seedOf = async (key: CryptoKey) =>
  Uint8Array.from(
    atob((await crypto.subtle.exportKey("jwk", key)).d!.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );

describe("a portable identity", () => {
  it("has a recovery code that brings the same identity back, on another browser", async () => {
    const { key, code } = await makePortable();
    expect(code).toMatch(/^PU1(-[0-9A-Z]{4}){14}$/);
    expect(codeOf(await seedOf(key))).toBe(code);
    const back = await keyFromCode(code);
    if (!("key" in back)) throw new Error("not restored");
    expect(await pub(back.key)).toBe(await pub(key));
    // It signs as the same person: what the restored key signs verifies under the old public key.
    const data = new TextEncoder().encode("hello");
    const sig = await crypto.subtle.sign({ name: "Ed25519" }, back.key, data);
    const verifier = await crypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: await pub(key) },
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    expect(await crypto.subtle.verify({ name: "Ed25519" }, verifier, sig, data)).toBe(true);
  });

  it("is read forgivingly: spaces, lower case, and look-alike letters", async () => {
    const { key, code } = await makePortable();
    const back = await keyFromCode(`  ${code.toLowerCase().replace(/-/g, " ")}\n`);
    expect("key" in back && (await pub(back.key))).toBe(await pub(key));
  });

  it("refuses a code with a mistake, or that isn't a code, in words the screen can use", async () => {
    const { code } = await makePortable();
    const chars = code.split("");
    const at = chars.findIndex((c, i) => i > 6 && c !== "-");
    chars[at] = chars[at] === "A" ? "B" : "A";
    expect(await keyFromCode(chars.join(""))).toEqual({ problem: "mistake" });
    expect(await keyFromCode("not a code")).toEqual({ problem: "shape" });
    expect(await keyFromCode("")).toEqual({ problem: "shape" });
    expect(await keyFromCode(code.slice(0, -5))).toEqual({ problem: "shape" });
  });

  it("makes a different identity each time, and keys stay extractable so they can be backed up again", async () => {
    const a = await makePortable();
    const b = await makePortable();
    expect(a.code).not.toBe(b.code);
    expect(await pub(a.key)).not.toBe(await pub(b.key));
    expect((await keyOf(new Uint8Array(32))).extractable).toBe(true);
  });
});
