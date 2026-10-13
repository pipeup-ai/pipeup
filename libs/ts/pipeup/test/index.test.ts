import { describe, expect, it } from "vitest";
import * as pipeup from "../src/index";

describe("public API", () => {
  it("exports the core surface", () => {
    for (const name of [
      "PipeupDocument",
      "MemoryStore",
      "IndexedDbStore",
      "loadOrCreateProfile",
      "createIdentity",
      "newDocumentAttribute",
      "parseDocumentAttribute",
      "describeRange",
      "describeElement",
      "resolveAnchor",
      "locate",
      "labelOf",
      "copyThread",
      "copyAll",
      "formatAgo",
      "animalName",
      "nameOf",
      "setViewState",
      "onReveal",
    ]) {
      expect(typeof (pipeup as Record<string, unknown>)[name], name).toBe("function");
    }
    expect(pipeup.VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
  });
});

describe("the age line", () => {
  it("is a date, and the version it was made with", async () => {
    const { BUILT, VERSION } = await import("../src/core");
    expect(BUILT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(Number.isNaN(Date.parse(BUILT))).toBe(false);
  });
});
