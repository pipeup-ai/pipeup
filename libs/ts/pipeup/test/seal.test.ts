import { describe, expect, it } from "vitest";
import { newDocumentAttribute, parseDocumentAttribute, seal, unseal } from "../src/crypto/seal";

describe("document key and sealing", () => {
  it("makes and parses data-pipeup-doc values", async () => {
    const attr = newDocumentAttribute();
    expect(attr).toMatch(/^[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{43}$/);
    const doc = await parseDocumentAttribute(attr);
    expect(doc.id).toBe(attr.split(":")[0]);
    expect(doc.key.extractable).toBe(false);
  });

  it("rejects malformed attributes", async () => {
    await expect(parseDocumentAttribute("nope")).rejects.toThrow(/data-pipeup-doc/);
    await expect(parseDocumentAttribute("abc:def")).rejects.toThrow(/data-pipeup-doc/);
  });

  it("round-trips sealed text", async () => {
    const { key } = await parseDocumentAttribute(newDocumentAttribute());
    const sealed = await seal(key, "secret words", "ctx");
    expect(sealed.data).not.toContain("secret");
    expect(await unseal(key, sealed, "ctx")).toBe("secret words");
  });

  it("refuses the wrong key, the wrong context and tampering", async () => {
    const { key } = await parseDocumentAttribute(newDocumentAttribute());
    const { key: other } = await parseDocumentAttribute(newDocumentAttribute());
    const sealed = await seal(key, "secret", "ctx");
    await expect(unseal(other, sealed, "ctx")).rejects.toThrow(/could not be opened/);
    await expect(unseal(key, sealed, "other")).rejects.toThrow(/could not be opened/);
    const flipped = { ...sealed, data: (sealed.data[0] === "A" ? "B" : "A") + sealed.data.slice(1) };
    await expect(unseal(key, flipped, "ctx")).rejects.toThrow(/could not be opened/);
  });
});
