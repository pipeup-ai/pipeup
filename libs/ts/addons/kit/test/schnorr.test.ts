import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { publicKey, sign } from "../src/schnorr";

const unhex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex").toUpperCase();

// The official BIP-340 vectors (bips/bip-0340/test-vectors.csv). Only the rows with a secret key sign.
const rows = readFileSync(new URL("bip340-vectors.csv", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => l.split(","))
  .filter((c) => c[1]);

describe("BIP-340 signer", () => {
  it("has the signing vectors", () => expect(rows.length).toBe(8));
  for (const [i, sk, pk, aux, msg, sig] of rows)
    it(`vector ${i}: public key and signature`, async () => {
      expect(hex(publicKey(unhex(sk!)))).toBe(pk);
      expect(hex(await sign(unhex(msg!), unhex(sk!), unhex(aux!)))).toBe(sig);
    });

  it("refuses a secret key outside the curve order", async () => {
    await expect(sign(new Uint8Array(32), new Uint8Array(32))).rejects.toThrow();
    await expect(sign(new Uint8Array(32), new Uint8Array(32).fill(255))).rejects.toThrow();
  });

  it("signs differently each time without fixed randomness, and the public key is x-only", async () => {
    const sk = crypto.getRandomValues(new Uint8Array(32));
    const msg = crypto.getRandomValues(new Uint8Array(32));
    const [a, b] = [await sign(msg, sk), await sign(msg, sk)];
    expect(a).toHaveLength(64);
    expect(hex(a)).not.toBe(hex(b));
    expect(publicKey(sk)).toHaveLength(32);
  });
});
