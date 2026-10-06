import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  fingerprint,
  fromB64u,
  normalizeText,
  randomId,
  toB64u,
  utf8,
} from "../src/util/encoding";

describe("encoding", () => {
  it("round-trips base64url without padding", () => {
    for (const n of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = crypto.getRandomValues(new Uint8Array(n));
      const text = toB64u(bytes);
      expect(text).not.toMatch(/[+/=]/);
      expect(fromB64u(text)).toEqual(bytes);
    }
  });

  it("makes url-safe random ids of the requested size", () => {
    expect(randomId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomId(12)).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(randomId()).not.toBe(randomId());
  });

  it("serialises objects with sorted keys and without undefined fields", () => {
    expect(canonicalJson({ b: 1, a: [true, { d: null, c: "x" }], z: undefined })).toBe(
      '{"a":[true,{"c":"x","d":null}],"b":1}',
    );
  });

  it("encodes utf8", () => {
    expect([...utf8("é")]).toEqual([0xc3, 0xa9]);
  });

  it("fingerprints text independent of whitespace", () => {
    expect(fingerprint("Hello   world\n")).toBe(fingerprint(" Hello world"));
    expect(fingerprint("Hello world")).not.toBe(fingerprint("Hello there"));
    expect(fingerprint("x")).toMatch(/^[0-9a-f]{8}$/);
    expect(normalizeText("  a \n b ")).toBe("a b");
  });
});
