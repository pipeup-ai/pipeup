import { describe, expect, it } from "vitest";
import { createIdentity, sign, verify } from "../src/crypto/identity";
import { codeOf, identityFromCode, makePortable } from "../src/crypto/portable";
import { utf8 } from "../src/util/encoding";

describe("a portable identity", () => {
  it("has a recovery code that brings the same identity back, on another browser", async () => {
    const { identity, code } = await makePortable();
    expect(code).toMatch(/^PU1(-[0-9A-Z]{4}){14}$/);
    expect(await codeOf(identity)).toBe(code);
    const back = await identityFromCode(code);
    expect("identity" in back && back.identity.publicKey).toBe(identity.publicKey);
    // It signs as the same person: what the restored key signs verifies under the old public key.
    const data = utf8("hello");
    if (!("identity" in back)) throw new Error("not restored");
    expect(await verify(identity.publicKey, data, await sign(back.identity, data))).toBe(true);
  });

  it("is read forgivingly: spaces, lower case, and look-alike letters", async () => {
    const { identity, code } = await makePortable();
    const loose = code.toLowerCase().replace(/-/g, " ");
    const back = await identityFromCode(`  ${loose}\n`);
    expect("identity" in back && back.identity.publicKey).toBe(identity.publicKey);
  });

  it("refuses a code with a mistake, or that isn't a code, in words the screen can use", async () => {
    const { code } = await makePortable();
    const chars = code.split("");
    const at = chars.findIndex((c, i) => i > 6 && c !== "-");
    chars[at] = chars[at] === "A" ? "B" : "A";
    expect(await identityFromCode(chars.join(""))).toEqual({ problem: "mistake" });
    expect(await identityFromCode("not a code")).toEqual({ problem: "shape" });
    expect(await identityFromCode("")).toEqual({ problem: "shape" });
    expect(await identityFromCode(code.slice(0, -5))).toEqual({ problem: "shape" });
  });

  it("is never offered for an ordinary identity, whose key can't leave the browser", async () => {
    expect(await codeOf(await createIdentity())).toBeNull();
  });

  it("makes a different identity each time", async () => {
    const a = await makePortable();
    const b = await makePortable();
    expect(a.code).not.toBe(b.code);
    expect(a.identity.publicKey).not.toBe(b.identity.publicKey);
  });
});
