// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { authorContext, safeUrl } from "../src/addon";
import { compare, decide, inRange, type UpdateList } from "../src/decide";
// @ts-expect-error: the maintainer's tooling is plain JavaScript
import { newKey, signList } from "../../../../../tools/updates.mjs";
import { check } from "../src/verify";

describe("versions", () => {
  it("compare as numbers, with a pre-release before its release", () => {
    expect(compare("0.6.0", "0.10.0")).toBeLessThan(0);
    expect(compare("1.0.0", "0.9.9")).toBeGreaterThan(0);
    expect(compare("0.7.0-beta.1", "0.7.0")).toBeLessThan(0);
    expect(compare("0.7.0-beta.2", "0.7.0-beta.10")).toBeLessThan(0);
    expect(compare("0.7.0", "0.7.0")).toBe(0);
  });

  it("fall in a range of comparisons, or a list of exact versions", () => {
    expect(inRange("0.6.0", "<0.6.1")).toBe(true);
    expect(inRange("0.6.1", "<0.6.1")).toBe(false);
    expect(inRange("0.5.5", ">=0.5.0 <0.6.1")).toBe(true);
    expect(inRange("0.4.9", ">=0.5.0 <0.6.1")).toBe(false);
    expect(inRange("0.6.0", "0.5.0, 0.6.0")).toBe(true);
    expect(inRange("0.6.0", "0.5.0")).toBe(false);
  });
});

const list = (over: Partial<UpdateList> = {}): UpdateList => ({
  v: 1,
  at: "2026-10-12T00:00:00Z",
  expires: "2099-01-01T00:00:00Z",
  latest: "0.7.0",
  minimum: "0.5.0",
  versions: {
    "0.7.0": {
      date: "2026-10-12",
      integrity: "sha384-x",
      notes: "https://github.com/pipeup-ai/pipeup/releases/tag/v0.7.0",
    },
  },
  advisories: [],
  sig: { key: "k1", value: "" },
  ...over,
});

describe("what the author is told", () => {
  it("nothing when this is the latest", () => {
    expect(decide(list(), "0.7.0")).toBeNull();
    expect(decide(list(), "0.8.0")).toBeNull();
  });

  it("a console line for a patch or minor within the same line, a menu marker for a bigger step", () => {
    expect(decide(list({ latest: "0.7.2" }), "0.7.0")).toMatchObject({ level: "info", id: "latest-0.7.2" });
    expect(decide(list(), "0.6.0")).toMatchObject({ level: "recommended" });
    expect(decide(list({ latest: "2.0.0" }), "1.3.0")).toMatchObject({ level: "recommended" });
    expect(decide(list({ latest: "1.1.0" }), "1.0.0")).toMatchObject({ level: "info" });
  });

  it("a security notice for a matching advisory, or for a version below the minimum, naming the fix", () => {
    const advisory = {
      id: "PIPEUP-2026-001",
      severity: "security" as const,
      affects: "<0.6.1",
      fixed: "0.6.1",
      summary: "Fix X.",
      url: "https://github.com/pipeup-ai/pipeup/security/advisories/1",
    };
    expect(decide(list({ advisories: [advisory] }), "0.6.0")).toMatchObject({
      level: "security",
      id: "PIPEUP-2026-001",
      text: expect.stringContaining("Fixed in Pipeup 0.6.1"),
    });
    expect(decide(list({ advisories: [advisory] }), "0.7.0")).toBeNull();
    expect(decide(list({ minimum: "0.6.0" }), "0.5.1")).toMatchObject({
      level: "security",
      id: "minimum-0.6.0",
    });
  });

  it("never tells a pre-release to go back to an older stable", () => {
    expect(decide(list({ latest: "0.6.0", versions: {} }), "0.7.0-beta.1")).toBeNull();
  });
});

describe("the signed list", () => {
  const keys = (id = "k1") => {
    const { privateKey, publicKey } = newKey();
    return { privateKey, keys: [{ id, key: publicKey }] };
  };

  it("is accepted when a known key signed it and it has not expired", async () => {
    const { privateKey, keys: k } = keys();
    const signed = signList(list(), privateKey, "k1");
    expect(await check(JSON.stringify(signed), k)).toMatchObject({ latest: "0.7.0" });
  });

  it("is refused when anything was changed, the key is unknown, or it is out of date", async () => {
    const { privateKey, keys: k } = keys();
    const signed = signList(list(), privateKey, "k1");
    expect(await check(JSON.stringify({ ...signed, latest: "9.9.9" }), k)).toBeNull();
    expect(await check(JSON.stringify(signed), keys("k1").keys)).toBeNull();
    expect(await check(JSON.stringify(signed), [{ id: "other", key: k[0]!.key }])).toBeNull();
    expect(await check(JSON.stringify(signed), k, Date.parse("2100-01-01"))).toBeNull();
    expect(await check("not json", k)).toBeNull();
    expect(await check(JSON.stringify({ ...signed, v: 2 }), k)).toBeNull();
  });
});

describe("where it runs", () => {
  const at = (protocol: string, hostname: string, attr?: string) => {
    const html = document.createElement("html");
    if (attr) html.setAttribute("data-pipeup-updates", attr);
    return authorContext({ protocol, hostname }, html);
  };
  it("is the author's: a file, this computer, or where they asked; never a reviewer's page by default", () => {
    expect(at("file:", "")).toBe(true);
    expect(at("http:", "localhost")).toBe(true);
    expect(at("http:", "127.0.0.1")).toBe(true);
    expect(at("https:", "docs.example.test")).toBe(true);
    expect(at("https:", "pipeup-ai.github.io")).toBe(false);
    expect(at("https:", "pipeup-ai.github.io", "on")).toBe(true);
    expect(at("file:", "", "off")).toBe(false);
  });
});

describe("links in a notice", () => {
  it("go only to the project's own addresses", () => {
    expect(safeUrl("https://github.com/pipeup-ai/pipeup/releases/tag/v1")).toBeTruthy();
    expect(safeUrl("https://pipeup-ai.github.io/pipeup/")).toBeTruthy();
    for (const bad of [
      "https://evil.test/",
      "http://github.com/pipeup-ai/x",
      "https://github.com.evil.test/pipeup-ai/",
      "https://github.com/other/pipeup",
      "javascript:alert(1)",
      "not a url",
    ])
      expect(safeUrl(bad)).toBeNull();
  });
});
