import { describe, expect, it } from "vitest";
import { parseShare } from "../src/address";
import { KEY } from "./helpers";

const off = (v: string | null | undefined, local = false) => {
  const a = parseShare(v, local);
  return a.kind === "off" ? a.reason : a.kind;
};

describe("parseShare", () => {
  it("nothing set is off, in words", () => {
    expect(off(null)).toBe("sharing isn't set up for this page");
    expect(off("  ")).toBe("sharing isn't set up for this page");
  });

  it("an https paste with ?id#key is PrivateBin", () => {
    const a = parseShare(`https://paste.example.org/bin/?f468483c313401e8#${KEY}`);
    expect(a).toMatchObject({
      kind: "privatebin",
      base: "https://paste.example.org/bin/",
      paste: "f468483c313401e8",
    });
    expect((a as { key: Uint8Array }).key).toHaveLength(32);
  });

  it("#pm1.<key> and #pm1.<key>.<token> are a mailbox; the token is separate from the key", () => {
    const m = "https://share.example.com/pipeup/m/" + "a".repeat(22);
    expect(parseShare(`${m}#pm1.${KEY}`)).toMatchObject({ kind: "mailbox", mailbox: m });
    const t = parseShare(`${m}#pm1.${KEY}.tok_en-1`);
    expect(t).toMatchObject({ kind: "mailbox", mailbox: m, token: "tok_en-1" });
  });

  it("anything else is not a sharing address", () => {
    const bad = "data-pipeup-share isn't a sharing address";
    expect(off(`http://paste.example.org/?f468483c313401e8#${KEY}`)).toBe(bad);
    expect(off(`ftp://paste.example.org/?f468483c313401e8#${KEY}`)).toBe(bad);
    expect(off("not a url")).toBe(bad);
    expect(off(`https://paste.example.org/#${KEY}`)).toBe(bad); // no paste id
    expect(off("https://paste.example.org/?f468483c313401e8")).toBe(bad); // no key
    expect(off("https://paste.example.org/?f468483c313401e8#short")).toBe(bad);
    expect(off(`https://x.example.com/m/${"a".repeat(22)}#pm1.short`)).toBe(bad);
    expect(off(`https://x.example.com/other#pm1.${KEY}`)).toBe(bad); // not a mailbox path
    expect(off(`https://x.example.com/m/${"a".repeat(22)}#pm1.${KEY}.a.b`)).toBe(bad);
  });

  it("http is refused unless it is local (the command line and tests)", () => {
    const m = `http://127.0.0.1:8080/m/${"a".repeat(22)}#pm1.${KEY}`;
    expect(off(m)).not.toBe("mailbox");
    expect(off(m, true)).toBe("mailbox");
    expect(off(`http://example.com/m/${"a".repeat(22)}#pm1.${KEY}`, true)).not.toBe("mailbox");
  });
});
